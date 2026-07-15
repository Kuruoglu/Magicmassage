-- Pair the monotonic version with the hold UUID so a new hold created after an
-- expired one cannot accidentally reuse the stale tab's selection identity.

create function public.public_booking_create_hold_v3(
  p_token_hash text,
  p_session_key_hash text,
  p_price_variant_id text,
  p_starts_on date,
  p_starts_at time without time zone
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
  hold public.public_booking_holds%rowtype;
begin
  result := public.public_booking_create_hold_v2(
    p_token_hash,
    p_session_key_hash,
    p_price_variant_id,
    p_starts_on,
    p_starts_at
  );

  select * into hold
  from public.public_booking_holds
  where session_key_hash = p_session_key_hash
    and status = 'active';

  if not found then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  return result || jsonb_build_object('selectionId', hold.id);
end;
$$;

create function public.public_booking_restore_session_hold_v3(
  p_session_key_hash text,
  p_token_hash text
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
  hold public.public_booking_holds%rowtype;
begin
  result := public.public_booking_restore_session_hold_v2(
    p_session_key_hash,
    p_token_hash
  );

  if result is null then
    return null;
  end if;

  select * into hold
  from public.public_booking_holds
  where session_key_hash = p_session_key_hash
    and status = 'active';

  if not found then
    return null;
  end if;

  return result || jsonb_build_object('selectionId', hold.id);
end;
$$;

create function public.public_booking_confirm_session_v3(
  p_session_key_hash text,
  p_selection_id uuid,
  p_selection_version integer,
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
  current_selection_id uuid;
  current_selection_version integer;
begin
  if coalesce(p_session_key_hash, '') !~ '^[a-f0-9]{64}$'
    or coalesce(p_idempotency_key_hash, '') !~ '^[a-f0-9]{64}$'
    or p_selection_id is null
    or p_selection_version is null
    or p_selection_version < 1 then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('public-booking-session:' || p_session_key_hash, 0)
  );

  select hold.id, hold.selection_version
  into current_selection_id, current_selection_version
  from public.admin_appointments appointment
  join public.public_booking_holds hold
    on hold.id = appointment.public_booking_hold_id
  where appointment.public_booking_idempotency_key_hash = p_idempotency_key_hash
    and hold.session_key_hash = p_session_key_hash;

  if not found then
    select hold.id, hold.selection_version
    into current_selection_id, current_selection_version
    from public.public_booking_holds hold
    where hold.session_key_hash = p_session_key_hash
      and hold.status = 'active';
  end if;

  if current_selection_id is distinct from p_selection_id
    or current_selection_version is distinct from p_selection_version then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  return public.public_booking_confirm_session_v2(
    p_session_key_hash,
    p_selection_version,
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

revoke all on function public.public_booking_create_hold_v3(
  text, text, text, date, time without time zone
) from public, anon, authenticated;
revoke all on function public.public_booking_restore_session_hold_v3(text, text)
  from public, anon, authenticated;
revoke all on function public.public_booking_confirm_session_v3(
  text, uuid, integer, text, text, text, text, text, text, text, text, boolean
) from public, anon, authenticated;

grant execute on function public.public_booking_create_hold_v3(
  text, text, text, date, time without time zone
) to service_role;
grant execute on function public.public_booking_restore_session_hold_v3(text, text)
  to service_role;
grant execute on function public.public_booking_confirm_session_v3(
  text, uuid, integer, text, text, text, text, text, text, text, text, boolean
) to service_role;
