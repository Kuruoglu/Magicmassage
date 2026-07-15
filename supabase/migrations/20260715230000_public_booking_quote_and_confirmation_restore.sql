-- Make the held quote authoritative in the browser and allow a confirmed
-- appointment to be restored after the confirmation HTTP response is lost.

create or replace function public.public_booking_bump_selection_version()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.status = 'active'
    and new.status = 'active'
    and (
      new.price_variant_id is distinct from old.price_variant_id
      or new.service_slug is distinct from old.service_slug
      or new.starts_on is distinct from old.starts_on
      or new.starts_at is distinct from old.starts_at
      or new.duration_minutes is distinct from old.duration_minutes
      or new.buffer_minutes is distinct from old.buffer_minutes
      or new.price_cents is distinct from old.price_cents
      or new.currency is distinct from old.currency
    ) then
    new.selection_version := old.selection_version + 1;
  else
    new.selection_version := old.selection_version;
  end if;

  return new;
end;
$$;

create function public.public_booking_create_hold_v4(
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
  result := public.public_booking_create_hold_v3(
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

  return result || jsonb_build_object(
    'currency', hold.currency,
    'durationMinutes', hold.duration_minutes,
    'priceCents', hold.price_cents
  );
end;
$$;

create function public.public_booking_restore_session_hold_v4(
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
  result := public.public_booking_restore_session_hold_v3(
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

  return result || jsonb_build_object(
    'currency', hold.currency,
    'durationMinutes', hold.duration_minutes,
    'priceCents', hold.price_cents
  );
end;
$$;

create function public.public_booking_confirm_session_v4(
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
  result jsonb;
  appointment public.admin_appointments%rowtype;
begin
  result := public.public_booking_confirm_session_v3(
    p_session_key_hash,
    p_selection_id,
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

  select appointment_row.* into appointment
  from public.admin_appointments appointment_row
  join public.public_booking_holds hold
    on hold.id = appointment_row.public_booking_hold_id
  where appointment_row.public_booking_idempotency_key_hash = p_idempotency_key_hash
    and hold.session_key_hash = p_session_key_hash
    and hold.id = p_selection_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  return result || jsonb_build_object(
    'durationMinutes', appointment.duration_minutes,
    'serviceName', appointment.service_name
  );
end;
$$;

create function public.public_booking_restore_session_confirmation(
  p_session_key_hash text
)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  appointment public.admin_appointments%rowtype;
begin
  if coalesce(p_session_key_hash, '') !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  select appointment_row.* into appointment
  from public.admin_appointments appointment_row
  join public.public_booking_holds hold
    on hold.id = appointment_row.public_booking_hold_id
  where hold.session_key_hash = p_session_key_hash
    and hold.status = 'confirmed'
    and appointment_row.status = 'confirmed'
  order by hold.confirmed_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'currency', appointment.currency_snapshot,
    'date', appointment.starts_on,
    'durationMinutes', appointment.duration_minutes,
    'priceCents', appointment.price_cents_snapshot,
    'priceVariantId', appointment.price_variant_id,
    'publicReference', appointment.public_reference,
    'serviceName', appointment.service_name,
    'serviceSlug', appointment.service_slug,
    'status', appointment.status,
    'time', to_char(appointment.starts_at, 'HH24:MI')
  );
end;
$$;

revoke all on function public.public_booking_create_hold_v4(
  text, text, text, date, time without time zone
) from public, anon, authenticated;
revoke all on function public.public_booking_restore_session_hold_v4(text, text)
  from public, anon, authenticated;
revoke all on function public.public_booking_confirm_session_v4(
  text, uuid, integer, text, text, text, text, text, text, text, text, boolean
) from public, anon, authenticated;
revoke all on function public.public_booking_restore_session_confirmation(text)
  from public, anon, authenticated;

grant execute on function public.public_booking_create_hold_v4(
  text, text, text, date, time without time zone
) to service_role;
grant execute on function public.public_booking_restore_session_hold_v4(text, text)
  to service_role;
grant execute on function public.public_booking_confirm_session_v4(
  text, uuid, integer, text, text, text, text, text, text, text, text, boolean
) to service_role;
grant execute on function public.public_booking_restore_session_confirmation(text)
  to service_role;
