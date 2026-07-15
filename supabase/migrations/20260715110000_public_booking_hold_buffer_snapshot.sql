-- Preserve the buffer captured by the hold when the owner changes the default.
-- The appointment insert already snapshots hold.buffer_minutes.

create or replace function public.public_booking_confirm(
  p_token_hash text,
  p_idempotency_key_hash text,
  p_full_name text,
  p_phone text,
  p_phone_normalized text,
  p_email text,
  p_locale text,
  p_public_note text,
  p_privacy_accepted boolean
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  settings public.admin_site_settings%rowtype;
  hold public.public_booking_holds%rowtype;
  variant record;
  client_id text;
  appointment public.admin_appointments%rowtype;
  appointment_id text;
  public_reference text;
  slot_range tsrange;
begin
  if coalesce(p_token_hash, '') !~ '^[a-f0-9]{64}$'
    or coalesce(p_idempotency_key_hash, '') !~ '^[a-f0-9]{64}$'
    or p_locale is null
    or p_locale not in ('bg', 'ru', 'ua', 'en')
    or p_privacy_accepted is not true
    or char_length(btrim(coalesce(p_full_name, ''))) not between 2 and 100
    or coalesce(p_phone_normalized, '') !~ '^[0-9]{7,15}$'
    or regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') <> p_phone_normalized
    or char_length(coalesce(p_phone, '')) not between 7 and 32
    or char_length(coalesce(p_email, '')) > 254
    or (
      nullif(btrim(coalesce(p_email, '')), '') is not null
      and p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
    or char_length(coalesce(p_public_note, '')) > 1000 then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  select * into hold
  from public.public_booking_holds
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  select * into appointment
  from public.admin_appointments
  where public_booking_idempotency_key_hash = p_idempotency_key_hash;

  if found then
    if appointment.public_booking_hold_id <> hold.id then
      raise exception using errcode = '22023', message = 'invalid_request';
    end if;
    return jsonb_build_object(
      'publicReference', appointment.public_reference,
      'status', appointment.status,
      'date', appointment.starts_on,
      'time', to_char(appointment.starts_at, 'HH24:MI'),
      'serviceSlug', appointment.service_slug,
      'priceVariantId', appointment.price_variant_id,
      'priceCents', appointment.price_cents_snapshot,
      'currency', appointment.currency_snapshot
    );
  end if;

  if hold.status <> 'active' or hold.expires_at <= now() then
    if hold.status = 'active' then
      update public.public_booking_holds set status = 'expired' where id = hold.id;
    end if;
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public-booking:' || hold.starts_on::text, 0));

  select * into settings
  from public.admin_site_settings
  where id = 'site';

  if not found or not settings.public_booking_enabled then
    raise exception using errcode = 'P0001', message = 'booking_unavailable';
  end if;

  update public.public_booking_holds
  set status = 'expired'
  where status = 'active' and expires_at <= now() and id <> hold.id;

  select
    price.id,
    price.service_slug,
    price.duration_minutes,
    price.price_cents,
    price.currency,
    coalesce(nullif(btrim(translation.title), ''), service.name) as service_name
  into variant
  from public.admin_price_variants price
  join public.admin_services service on service.slug = price.service_slug
  left join public.admin_service_translations translation
    on translation.service_slug = service.slug
   and translation.locale = p_locale
   and translation.status = 'published'
  where price.id = hold.price_variant_id
    and price.status = 'active'
    and service.status = 'published';

  if not found
    or variant.service_slug <> hold.service_slug
    or variant.duration_minutes <> hold.duration_minutes
    or not public.public_booking_slot_in_schedule(
      hold.starts_on,
      hold.starts_at,
      hold.duration_minutes,
      settings.working_days,
      settings.working_hours,
      settings.booking_slot_step_minutes,
      0,
      settings.booking_horizon_days
    )
    or hold.starts_on + hold.starts_at
      < (hold.created_at at time zone 'Europe/Sofia')
        + make_interval(mins => settings.booking_min_lead_minutes) then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  if (
    select count(*)
    from public.admin_appointments existing_appointment
    where existing_appointment.starts_on = hold.starts_on
      and existing_appointment.status <> 'cancelled'
  ) >= settings.public_booking_daily_limit then
    raise exception using errcode = 'P0001', message = 'cap_reached';
  end if;

  slot_range := tsrange(
    hold.starts_on + hold.starts_at,
    hold.starts_on + hold.starts_at
      + make_interval(mins => hold.duration_minutes + hold.buffer_minutes),
    '[)'
  );

  if exists (
    select 1
    from public.admin_calendar_blocks block
    where block.block_date = hold.starts_on
      and slot_range && tsrange(block.block_date + block.starts_at, block.block_date + block.ends_at, '[)')
  ) or exists (
    select 1
    from public.admin_appointments existing_appointment
    where existing_appointment.starts_on = hold.starts_on
      and existing_appointment.status in ('confirmed', 'pending', 'request')
      and slot_range && tsrange(
        existing_appointment.starts_on + existing_appointment.starts_at,
        existing_appointment.starts_on + existing_appointment.starts_at
          + make_interval(mins => existing_appointment.duration_minutes + existing_appointment.buffer_minutes),
        '[)'
      )
  ) or exists (
    select 1
    from public.public_booking_holds existing_hold
    where existing_hold.id <> hold.id
      and existing_hold.starts_on = hold.starts_on
      and existing_hold.status = 'active'
      and existing_hold.expires_at > now()
      and slot_range && tsrange(
        existing_hold.starts_on + existing_hold.starts_at,
        existing_hold.starts_on + existing_hold.starts_at
          + make_interval(mins => existing_hold.duration_minutes + existing_hold.buffer_minutes),
        '[)'
      )
  ) then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  insert into public.admin_clients (
    id,
    full_name,
    phone,
    phone_normalized,
    email,
    locale,
    preferred_contact,
    status,
    gdpr_consent
  ) values (
    'client-public-' || gen_random_uuid()::text,
    btrim(p_full_name),
    btrim(p_phone),
    p_phone_normalized,
    nullif(lower(btrim(p_email)), ''),
    p_locale,
    'phone',
    'new',
    jsonb_build_object(
      'public_booking',
      jsonb_build_object('accepted', true, 'accepted_at', now())
    )
  )
  on conflict (phone_normalized) do update
  set gdpr_consent = coalesce(public.admin_clients.gdpr_consent, '{}'::jsonb)
    || jsonb_build_object(
      'public_booking',
      jsonb_build_object('accepted', true, 'accepted_at', now())
    )
  returning id into client_id;

  appointment_id := 'appointment-public-' || gen_random_uuid()::text;
  public_reference := 'MMN-' || to_char(hold.starts_on, 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  begin
    insert into public.admin_appointments (
      id,
      client_id,
      client_name_snapshot,
      starts_on,
      starts_at,
      service_name,
      status,
      duration_minutes,
      buffer_minutes,
      internal_note,
      public_note,
      service_slug,
      price_variant_id,
      price_cents_snapshot,
      currency_snapshot,
      origin,
      locale,
      public_reference,
      public_booking_idempotency_key_hash,
      public_booking_hold_id,
      overlap_override
    ) values (
      appointment_id,
      client_id,
      btrim(p_full_name),
      hold.starts_on,
      hold.starts_at,
      variant.service_name,
      'confirmed',
      hold.duration_minutes,
      hold.buffer_minutes,
      '',
      btrim(coalesce(p_public_note, '')),
      variant.service_slug,
      variant.id,
      variant.price_cents,
      variant.currency,
      'public',
      p_locale,
      public_reference,
      p_idempotency_key_hash,
      hold.id,
      false
    )
    returning * into appointment;
  exception
    when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'slot_unavailable';
    when unique_violation then
      select * into appointment
      from public.admin_appointments
      where public_booking_idempotency_key_hash = p_idempotency_key_hash;
      if not found or appointment.public_booking_hold_id <> hold.id then
        raise exception using errcode = 'P0001', message = 'slot_unavailable';
      end if;
  end;

  update public.public_booking_holds
  set status = 'confirmed', confirmed_at = now()
  where id = hold.id;

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    null,
    'appointment.public_confirm',
    'admin_appointments',
    appointment.id,
    jsonb_build_object(
      'public_reference', appointment.public_reference,
      'service_slug', appointment.service_slug,
      'price_variant_id', appointment.price_variant_id,
      'starts_on', appointment.starts_on,
      'starts_at', appointment.starts_at
    )
  );

  return jsonb_build_object(
    'publicReference', appointment.public_reference,
    'status', appointment.status,
    'date', appointment.starts_on,
    'time', to_char(appointment.starts_at, 'HH24:MI'),
    'serviceSlug', appointment.service_slug,
    'priceVariantId', appointment.price_variant_id,
    'priceCents', appointment.price_cents_snapshot,
    'currency', appointment.currency_snapshot
  );
end;
$$;
