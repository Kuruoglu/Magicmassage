-- Public booking uses stable public slugs. Internal specialist/auth UUIDs never
-- leave the service-role RPC boundary.

create function public.public_booking_get_options_v2(p_locale text)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
begin
  result := public.public_booking_get_options(p_locale);

  return jsonb_set(
    result,
    '{services}',
    coalesce((
      select jsonb_agg(
        service - 'specialists' || jsonb_build_object(
          'specialists',
          coalesce((
            select jsonb_agg(
              specialist - 'id' || jsonb_build_object('id', specialist_row.public_slug)
              order by specialist_order.ordinality
            )
            from jsonb_array_elements(service -> 'specialists') with ordinality
              as specialist_order(specialist, ordinality)
            join public.admin_specialists specialist_row
              on specialist_row.id = (specialist_order.specialist ->> 'id')::uuid
          ), '[]'::jsonb)
        )
        order by service_order.ordinality
      )
      from jsonb_array_elements(result -> 'services') with ordinality
        as service_order(service, ordinality)
    ), '[]'::jsonb),
    true
  );
end;
$$;

create function public.public_booking_get_availability_v3(
  p_price_variant_id text,
  p_from date,
  p_days integer,
  p_specialist_slug text default null
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  requested_specialist_id uuid;
  result jsonb;
begin
  if p_specialist_slug is not null then
    select specialist.id into requested_specialist_id
    from public.admin_specialists specialist
    where specialist.public_slug = btrim(p_specialist_slug);

    if not found then
      raise exception using errcode = '22023', message = 'invalid_request';
    end if;
  end if;

  result := public.public_booking_get_availability_v2(
    p_price_variant_id,
    p_from,
    p_days,
    requested_specialist_id
  );

  return result - 'specialistId' || jsonb_build_object(
    'specialistId', case when p_specialist_slug is null then null else btrim(p_specialist_slug) end
  );
end;
$$;

create function public.public_booking_create_hold_v6(
  p_token_hash text,
  p_session_key_hash text,
  p_price_variant_id text,
  p_starts_on date,
  p_starts_at time without time zone,
  p_specialist_slug text default null
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  requested_specialist_id uuid;
  assigned_specialist_slug text;
  result jsonb;
begin
  if p_specialist_slug is not null then
    select specialist.id into requested_specialist_id
    from public.admin_specialists specialist
    where specialist.public_slug = btrim(p_specialist_slug);

    if not found then
      raise exception using errcode = '22023', message = 'invalid_request';
    end if;
  end if;

  result := public.public_booking_create_hold_v5(
    p_token_hash,
    p_session_key_hash,
    p_price_variant_id,
    p_starts_on,
    p_starts_at,
    requested_specialist_id
  );

  select specialist.public_slug into assigned_specialist_slug
  from public.admin_specialists specialist
  where specialist.id = (result ->> 'specialistId')::uuid;

  if not found then
    raise exception using errcode = 'P0001', message = 'booking_unavailable';
  end if;

  return result - 'specialistId' || jsonb_build_object('specialistId', assigned_specialist_slug);
end;
$$;

create function public.public_booking_restore_session_hold_v6(
  p_session_key_hash text,
  p_token_hash text
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  assigned_specialist_slug text;
  result jsonb;
begin
  result := public.public_booking_restore_session_hold_v5(p_session_key_hash, p_token_hash);
  if result is null then return null; end if;

  select specialist.public_slug into assigned_specialist_slug
  from public.admin_specialists specialist
  where specialist.id = (result ->> 'specialistId')::uuid;

  if not found then
    raise exception using errcode = 'P0001', message = 'booking_unavailable';
  end if;

  return result - 'specialistId' || jsonb_build_object('specialistId', assigned_specialist_slug);
end;
$$;

create or replace function public.public_booking_restore_session_confirmation(
  p_session_key_hash text
)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  appointment public.admin_appointments%rowtype;
  specialist_name text;
  specialist_slug text;
begin
  if coalesce(p_session_key_hash, '') !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  select appointment_row.* into appointment
  from public.admin_appointments appointment_row
  join public.public_booking_holds hold on hold.id = appointment_row.public_booking_hold_id
  where hold.session_key_hash = p_session_key_hash
    and hold.status = 'confirmed'
    and appointment_row.status = 'confirmed'
  order by hold.confirmed_at desc
  limit 1;

  if not found then return null; end if;

  select specialist.display_name, specialist.public_slug
  into specialist_name, specialist_slug
  from public.admin_specialists specialist
  where specialist.id = appointment.specialist_id;

  return jsonb_build_object(
    'currency', appointment.currency_snapshot,
    'date', appointment.starts_on,
    'durationMinutes', appointment.duration_minutes,
    'priceCents', appointment.price_cents_snapshot,
    'priceVariantId', appointment.price_variant_id,
    'publicReference', appointment.public_reference,
    'serviceName', appointment.service_name,
    'serviceSlug', appointment.service_slug,
    'specialistId', specialist_slug,
    'specialistName', specialist_name,
    'status', appointment.status,
    'time', to_char(appointment.starts_at, 'HH24:MI')
  );
end;
$$;

revoke all on function public.public_booking_get_options_v2(text)
  from public, anon, authenticated;
revoke all on function public.public_booking_get_availability_v3(text, date, integer, text)
  from public, anon, authenticated;
revoke all on function public.public_booking_create_hold_v6(
  text, text, text, date, time without time zone, text
) from public, anon, authenticated;
revoke all on function public.public_booking_restore_session_hold_v6(text, text)
  from public, anon, authenticated;

grant execute on function public.public_booking_get_options_v2(text) to service_role;
grant execute on function public.public_booking_get_availability_v3(text, date, integer, text)
  to service_role;
grant execute on function public.public_booking_create_hold_v6(
  text, text, text, date, time without time zone, text
) to service_role;
grant execute on function public.public_booking_restore_session_hold_v6(text, text)
  to service_role;
