-- Let public clients choose an eligible specialist while keeping contact data
-- completely unavailable to specialist accounts.

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
      or new.specialist_id is distinct from old.specialist_id
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

create or replace function public.public_booking_get_options(p_locale text)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  settings public.admin_site_settings%rowtype;
begin
  if p_locale is null or p_locale not in ('bg', 'ru', 'ua', 'en') then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  select * into settings from public.admin_site_settings where id = 'site';
  if not found then
    raise exception using errcode = 'P0001', message = 'booking_unavailable';
  end if;

  return jsonb_build_object(
    'enabled', settings.public_booking_enabled,
    'timezone', settings.timezone,
    'dailyLimit', settings.public_booking_daily_limit,
    'slotStepMinutes', settings.booking_slot_step_minutes,
    'minLeadMinutes', settings.booking_min_lead_minutes,
    'horizonDays', settings.booking_horizon_days,
    'holdMinutes', settings.booking_hold_minutes,
    'bufferMinutes', settings.booking_buffer_minutes,
    'services', case when settings.public_booking_enabled then coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'slug', service.slug,
          'category', service.category,
          'title', coalesce(nullif(btrim(translation.title), ''), service.name),
          'specialists', (
            select coalesce(jsonb_agg(
              jsonb_build_object(
                'id', specialist.id,
                'displayName', specialist.display_name
              ) order by specialist.display_order, specialist.display_name, specialist.id
            ), '[]'::jsonb)
            from public.admin_specialist_services assignment
            join public.admin_specialists specialist on specialist.id = assignment.specialist_id
            where assignment.service_slug = service.slug
              and specialist.status = 'active'
              and specialist.public_booking_enabled
          ),
          'variants', (
            select coalesce(jsonb_agg(
              jsonb_build_object(
                'id', price.id,
                'durationMinutes', price.duration_minutes,
                'priceCents', price.price_cents,
                'currency', price.currency
              ) order by price.display_order, price.duration_minutes, price.id
            ), '[]'::jsonb)
            from public.admin_price_variants price
            where price.service_slug = service.slug and price.status = 'active'
          )
        ) order by service.display_order, service.slug
      )
      from public.admin_services service
      left join public.admin_service_translations translation
        on translation.service_slug = service.slug
       and translation.locale = p_locale
       and translation.status = 'published'
      where service.status = 'published'
        and exists (
          select 1 from public.admin_price_variants price
          where price.service_slug = service.slug and price.status = 'active'
        )
        and exists (
          select 1
          from public.admin_specialist_services assignment
          join public.admin_specialists specialist on specialist.id = assignment.specialist_id
          where assignment.service_slug = service.slug
            and specialist.status = 'active'
            and specialist.public_booking_enabled
        )
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

create function public.public_booking_get_availability_v2(
  p_price_variant_id text,
  p_from date,
  p_days integer,
  p_specialist_id uuid default null
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  settings public.admin_site_settings%rowtype;
  variant record;
  local_today date := (now() at time zone 'Europe/Sofia')::date;
begin
  if nullif(btrim(p_price_variant_id), '') is null or p_days not between 1 and 31 or p_from is null then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  update public.public_booking_holds set status = 'expired'
  where status = 'active' and expires_at <= now();

  select * into settings from public.admin_site_settings where id = 'site';
  if not found then
    raise exception using errcode = 'P0001', message = 'booking_unavailable';
  end if;
  if not settings.public_booking_enabled then
    return jsonb_build_object('enabled', false, 'timezone', settings.timezone, 'days', '[]'::jsonb);
  end if;
  if p_from < local_today or p_from > local_today + settings.booking_horizon_days then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  select price.id, price.service_slug, price.duration_minutes into variant
  from public.admin_price_variants price
  join public.admin_services service on service.slug = price.service_slug
  where price.id = p_price_variant_id and price.status = 'active' and service.status = 'published';
  if not found then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  if p_specialist_id is not null and not exists (
    select 1
    from public.admin_specialists specialist
    join public.admin_specialist_services assignment on assignment.specialist_id = specialist.id
    where specialist.id = p_specialist_id
      and specialist.status = 'active'
      and specialist.public_booking_enabled
      and assignment.service_slug = variant.service_slug
  ) then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  return jsonb_build_object(
    'enabled', true,
    'timezone', settings.timezone,
    'priceVariantId', variant.id,
    'specialistId', p_specialist_id,
    'from', p_from,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', candidate.day,
        'capReached', not exists (
          select 1 from public.admin_specialists specialist
          join public.admin_specialist_services assignment
            on assignment.specialist_id = specialist.id and assignment.service_slug = variant.service_slug
          where specialist.status = 'active'
            and specialist.public_booking_enabled
            and (p_specialist_id is null or specialist.id = p_specialist_id)
            and (
              select count(*) from public.admin_appointments appointment
              where appointment.specialist_id = specialist.id
                and appointment.starts_on = candidate.day and appointment.status <> 'cancelled'
            ) + (
              select count(*) from public.public_booking_holds hold
              where hold.specialist_id = specialist.id and hold.starts_on = candidate.day
                and hold.status = 'active' and hold.expires_at > now()
            ) < specialist.public_daily_limit
        ),
        'slots', coalesce((
          select jsonb_agg(to_char(slot.slot_time, 'HH24:MI') order by slot.slot_time)
          from (
            select make_time(slot_minute / 60, slot_minute % 60, 0) as slot_time
            from generate_series(
              lower(public.public_booking_working_minutes(settings.working_hours)),
              upper(public.public_booking_working_minutes(settings.working_hours)) - variant.duration_minutes,
              settings.booking_slot_step_minutes
            ) slot_minute
          ) slot
          where public.public_booking_slot_in_schedule(
            candidate.day, slot.slot_time, variant.duration_minutes,
            settings.working_days, settings.working_hours, settings.booking_slot_step_minutes,
            settings.booking_min_lead_minutes, settings.booking_horizon_days
          ) and exists (
            select 1 from public.admin_specialists specialist
            where (p_specialist_id is null or specialist.id = p_specialist_id)
              and public.public_booking_specialist_available(
                specialist.id, variant.service_slug, candidate.day, slot.slot_time,
                variant.duration_minutes, settings.booking_buffer_minutes, null
              )
          )
        ), '[]'::jsonb)
      ) order by candidate.day)
      from (
        select generated.day::date as day
        from generate_series(
          p_from,
          least(p_from + (p_days - 1), local_today + settings.booking_horizon_days),
          interval '1 day'
        ) generated(day)
      ) candidate
    ), '[]'::jsonb)
  );
end;
$$;

create function public.public_booking_create_hold_v5(
  p_token_hash text,
  p_session_key_hash text,
  p_price_variant_id text,
  p_starts_on date,
  p_starts_at time without time zone,
  p_specialist_id uuid default null
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  settings public.admin_site_settings%rowtype;
  variant record;
  existing_session_hold public.public_booking_holds%rowtype;
  hold public.public_booking_holds%rowtype;
  assigned_specialist record;
begin
  if coalesce(p_token_hash, '') !~ '^[a-f0-9]{64}$'
    or coalesce(p_session_key_hash, '') !~ '^[a-f0-9]{64}$'
    or nullif(btrim(p_price_variant_id), '') is null
    or p_starts_on is null or p_starts_at is null then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public-booking-session:' || p_session_key_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('public-booking:' || p_starts_on::text, 0));
  update public.public_booking_holds set status = 'expired'
  where status = 'active' and expires_at <= now();

  select * into existing_session_hold from public.public_booking_holds
  where session_key_hash = p_session_key_hash and status = 'active' for update;
  select * into settings from public.admin_site_settings where id = 'site';
  if not found or not settings.public_booking_enabled then
    raise exception using errcode = 'P0001', message = 'booking_unavailable';
  end if;

  select price.id, price.service_slug, price.duration_minutes, price.price_cents, price.currency into variant
  from public.admin_price_variants price
  join public.admin_services service on service.slug = price.service_slug
  where price.id = p_price_variant_id and price.status = 'active' and service.status = 'published';
  if not found or not public.public_booking_slot_in_schedule(
    p_starts_on, p_starts_at, variant.duration_minutes,
    settings.working_days, settings.working_hours, settings.booking_slot_step_minutes,
    settings.booking_min_lead_minutes, settings.booking_horizon_days
  ) then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  select specialist.id, specialist.display_name into assigned_specialist
  from public.admin_specialists specialist
  where (p_specialist_id is null or specialist.id = p_specialist_id)
    and public.public_booking_specialist_available(
      specialist.id, variant.service_slug, p_starts_on, p_starts_at,
      variant.duration_minutes, settings.booking_buffer_minutes, existing_session_hold.id
    )
  order by (
    select count(*) from public.admin_appointments appointment
    where appointment.specialist_id = specialist.id
      and appointment.starts_on = p_starts_on and appointment.status <> 'cancelled'
  ) + (
    select count(*) from public.public_booking_holds active_hold
    where active_hold.specialist_id = specialist.id
      and active_hold.starts_on = p_starts_on
      and active_hold.status = 'active'
      and active_hold.expires_at > now()
      and (existing_session_hold.id is null or active_hold.id <> existing_session_hold.id)
  ), specialist.display_order, specialist.id
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  if existing_session_hold.id is null then
    insert into public.public_booking_holds (
      token_hash, session_key_hash, price_variant_id, service_slug, specialist_id,
      starts_on, starts_at, duration_minutes, buffer_minutes, price_cents, currency, expires_at
    ) values (
      p_token_hash, p_session_key_hash, variant.id, variant.service_slug, assigned_specialist.id,
      p_starts_on, p_starts_at, variant.duration_minutes, settings.booking_buffer_minutes,
      variant.price_cents, variant.currency, now() + make_interval(mins => settings.booking_hold_minutes)
    ) returning * into hold;
  else
    update public.public_booking_holds set
      token_hash = p_token_hash,
      price_variant_id = variant.id,
      service_slug = variant.service_slug,
      specialist_id = assigned_specialist.id,
      starts_on = p_starts_on,
      starts_at = p_starts_at,
      duration_minutes = variant.duration_minutes,
      buffer_minutes = settings.booking_buffer_minutes,
      price_cents = variant.price_cents,
      currency = variant.currency,
      expires_at = now() + make_interval(mins => settings.booking_hold_minutes)
    where id = existing_session_hold.id returning * into hold;
  end if;

  return jsonb_build_object(
    'priceVariantId', hold.price_variant_id,
    'date', hold.starts_on,
    'time', to_char(hold.starts_at, 'HH24:MI'),
    'expiresAt', hold.expires_at,
    'specialistId', assigned_specialist.id,
    'specialistName', assigned_specialist.display_name,
    'currency', hold.currency,
    'durationMinutes', hold.duration_minutes,
    'priceCents', hold.price_cents,
    'selectionId', hold.id,
    'selectionVersion', hold.selection_version
  );
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
end;
$$;

create function public.public_booking_restore_session_hold_v5(
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
  specialist_name text;
begin
  result := public.public_booking_restore_session_hold_v4(p_session_key_hash, p_token_hash);
  if result is null then return null; end if;

  select hold_row.* into hold
  from public.public_booking_holds hold_row
  where hold_row.session_key_hash = p_session_key_hash and hold_row.status = 'active';
  if not found then return null; end if;
  select specialist.display_name into specialist_name
  from public.admin_specialists specialist where specialist.id = hold.specialist_id;

  return result || jsonb_build_object(
    'specialistId', hold.specialist_id,
    'specialistName', specialist_name
  );
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
  select specialist.display_name into specialist_name
  from public.admin_specialists specialist where specialist.id = appointment.specialist_id;

  return jsonb_build_object(
    'currency', appointment.currency_snapshot,
    'date', appointment.starts_on,
    'durationMinutes', appointment.duration_minutes,
    'priceCents', appointment.price_cents_snapshot,
    'priceVariantId', appointment.price_variant_id,
    'publicReference', appointment.public_reference,
    'serviceName', appointment.service_name,
    'serviceSlug', appointment.service_slug,
    'specialistId', appointment.specialist_id,
    'specialistName', specialist_name,
    'status', appointment.status,
    'time', to_char(appointment.starts_at, 'HH24:MI')
  );
end;
$$;

create or replace function public.admin_reveal_appointment_contact(
  p_actor_user_id uuid,
  p_appointment_id text,
  p_purpose text
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  appointment public.admin_appointments%rowtype;
  client public.admin_clients%rowtype;
begin
  if p_actor_user_id is null or nullif(btrim(p_appointment_id), '') is null
    or char_length(btrim(coalesce(p_purpose, ''))) not between 3 and 200 then
    raise exception using errcode = '22023', message = 'invalid_contact_reveal';
  end if;

  if not exists (
    select 1 from public.admin_profiles profile
    where profile.user_id = p_actor_user_id
      and profile.status = 'active'
      and profile.role::text in ('owner', 'administrator')
  ) then
    raise exception using errcode = '42501', message = 'contact_reveal_forbidden';
  end if;

  select * into appointment from public.admin_appointments where id = p_appointment_id;
  if not found then raise exception using errcode = 'P0002', message = 'appointment_not_found'; end if;
  select * into client from public.admin_clients where id = appointment.client_id;

  insert into public.admin_audit_log (actor_user_id, action, entity_table, entity_id, metadata)
  values (
    p_actor_user_id,
    'client.contact.reveal',
    'admin_appointments',
    appointment.id,
    jsonb_build_object('purpose', btrim(p_purpose), 'specialist_id', appointment.specialist_id)
  );

  return jsonb_build_object(
    'phone', coalesce(nullif(appointment.public_phone_snapshot, ''), client.phone, ''),
    'email', coalesce(nullif(appointment.public_email_snapshot, ''), client.email, ''),
    'preferredContact', coalesce(appointment.public_contact_preference_snapshot, client.preferred_contact, 'phone')
  );
end;
$$;

revoke all on function public.public_booking_get_availability_v2(text, date, integer, uuid)
  from public, anon, authenticated;
revoke all on function public.public_booking_create_hold_v5(text, text, text, date, time without time zone, uuid)
  from public, anon, authenticated;
revoke all on function public.public_booking_restore_session_hold_v5(text, text)
  from public, anon, authenticated;

grant execute on function public.public_booking_get_availability_v2(text, date, integer, uuid)
  to service_role;
grant execute on function public.public_booking_create_hold_v5(text, text, text, date, time without time zone, uuid)
  to service_role;
grant execute on function public.public_booking_restore_session_hold_v5(text, text)
  to service_role;

comment on function public.public_booking_get_availability_v2(text, date, integer, uuid) is
  'Returns public slots for any eligible specialist or one explicitly selected specialist.';
comment on function public.admin_reveal_appointment_contact(uuid, text, text) is
  'Owner/administrator-only audited contact access. Specialist accounts are always denied.';
