-- Restore an active hold after reload without persisting its bearer token in browser storage.

create function public.public_booking_restore_session_hold(
  p_session_key_hash text,
  p_token_hash text
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  hold public.public_booking_holds%rowtype;
  observed_starts_on date;
begin
  if coalesce(p_session_key_hash, '') !~ '^[a-f0-9]{64}$'
    or coalesce(p_token_hash, '') !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('public-booking-session:' || p_session_key_hash, 0)
  );

  update public.public_booking_holds
  set status = 'expired'
  where session_key_hash = p_session_key_hash
    and status = 'active'
    and expires_at <= now();

  select starts_on into observed_starts_on
  from public.public_booking_holds
  where session_key_hash = p_session_key_hash
    and status = 'active'
    and expires_at > now();

  if not found then
    return null;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('public-booking:' || observed_starts_on::text, 0)
  );

  select * into hold
  from public.public_booking_holds
  where session_key_hash = p_session_key_hash
    and status = 'active'
    and expires_at > now()
    and starts_on = observed_starts_on
  for update;

  if not found then
    return null;
  end if;

  update public.public_booking_holds
  set token_hash = p_token_hash
  where id = hold.id
  returning * into hold;

  return jsonb_build_object(
    'serviceSlug', hold.service_slug,
    'priceVariantId', hold.price_variant_id,
    'date', hold.starts_on,
    'time', to_char(hold.starts_at, 'HH24:MI'),
    'expiresAt', hold.expires_at
  );
end;
$$;

revoke all on function public.public_booking_restore_session_hold(text, text)
  from public, anon, authenticated;
grant execute on function public.public_booking_restore_session_hold(text, text)
  to service_role;

comment on function public.public_booking_restore_session_hold(text, text) is
  'Rotates and returns the active hold bearer token for a verified opaque browser session.';
