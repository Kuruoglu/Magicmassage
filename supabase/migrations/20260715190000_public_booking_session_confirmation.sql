-- Confirm through the signed browser session so concurrent hold-token rotations
-- cannot invalidate another tab that owns the same active hold.

create function public.public_booking_confirm_session(
  p_session_key_hash text,
  p_idempotency_key_hash text,
  p_full_name text,
  p_phone text,
  p_phone_normalized text,
  p_email text,
  p_locale text,
  p_contact_preference text,
  p_public_note text,
  p_privacy_accepted boolean
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  current_token_hash text;
begin
  if coalesce(p_session_key_hash, '') !~ '^[a-f0-9]{64}$'
    or coalesce(p_idempotency_key_hash, '') !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('public-booking-session:' || p_session_key_hash, 0)
  );

  select hold.token_hash into current_token_hash
  from public.admin_appointments appointment
  join public.public_booking_holds hold
    on hold.id = appointment.public_booking_hold_id
  where appointment.public_booking_idempotency_key_hash = p_idempotency_key_hash
    and hold.session_key_hash = p_session_key_hash;

  if not found then
    select hold.token_hash into current_token_hash
    from public.public_booking_holds hold
    where hold.session_key_hash = p_session_key_hash
      and hold.status = 'active';
  end if;

  if current_token_hash is null then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  return public.public_booking_confirm(
    current_token_hash,
    p_idempotency_key_hash,
    p_full_name,
    p_phone,
    p_phone_normalized,
    p_email,
    p_locale,
    p_contact_preference,
    p_public_note,
    p_privacy_accepted
  );
end;
$$;

revoke all on function public.public_booking_confirm_session(
  text, text, text, text, text, text, text, text, text, boolean
) from public, anon, authenticated;

grant execute on function public.public_booking_confirm_session(
  text, text, text, text, text, text, text, text, text, boolean
) to service_role;
