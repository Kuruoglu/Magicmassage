-- Harden multi-specialist authorization and serialize security-sensitive limits.

create or replace function public.admin_save_appointment_with_audit(
  p_record jsonb,
  p_actor_user_id uuid,
  p_action text,
  p_audit_metadata jsonb
)
returns void
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  actor_role text;
  actor_specialist_id uuid;
  appointment_id text;
  current_appointment public.admin_appointments%rowtype;
  current_exists boolean;
  effective_buffer_minutes integer;
  effective_duration_minutes integer;
  effective_service_name text;
  first_lock_date date;
  observed_exists boolean;
  observed_starts_on date;
  requested_buffer_minutes integer;
  requested_client_id text;
  requested_duration_minutes integer;
  requested_specialist_id uuid;
  requested_starts_at time without time zone;
  requested_starts_on date;
  requested_status text;
  requested_version integer;
  second_lock_date date;
  slot_range tsrange;
begin
  if jsonb_typeof(p_record) is distinct from 'object'
    or jsonb_typeof(p_audit_metadata) is distinct from 'object'
    or p_actor_user_id is null
    or p_action not in (
      'appointment.cancel', 'appointment.create', 'appointment.drag',
      'appointment.post_visit_comment', 'appointment.resize', 'appointment.update'
    ) then
    raise exception using errcode = '22023', message = 'invalid_admin_appointment';
  end if;

  select profile.role::text, profile.specialist_id
  into actor_role, actor_specialist_id
  from public.admin_profiles profile
  where profile.user_id = p_actor_user_id
    and profile.status = 'active'
    and profile.role::text in ('owner', 'administrator', 'specialist');

  if not found then
    raise exception using errcode = '42501', message = 'appointment_forbidden';
  end if;

  if coalesce((p_record ->> 'overlap_override')::boolean, false)
    and actor_role not in ('owner', 'administrator') then
    raise exception using errcode = '42501', message = 'appointment_overlap_forbidden';
  end if;

  appointment_id := p_record ->> 'id';
  requested_client_id := nullif(p_record ->> 'client_id', '');
  requested_starts_on := (p_record ->> 'starts_on')::date;
  requested_starts_at := (p_record ->> 'starts_at')::time;
  requested_duration_minutes := (p_record ->> 'duration_minutes')::integer;
  requested_buffer_minutes := (p_record ->> 'buffer_minutes')::integer;
  requested_status := p_record ->> 'status';
  requested_version := nullif(p_record ->> 'version', '')::integer;
  requested_specialist_id := nullif(p_record ->> 'specialist_id', '')::uuid;

  select appointment.starts_on into observed_starts_on
  from public.admin_appointments appointment
  where appointment.id = appointment_id;
  observed_exists := found;

  select * into current_appointment
  from public.admin_appointments appointment
  where appointment.id = appointment_id;
  current_exists := found;

  requested_specialist_id := coalesce(
    requested_specialist_id,
    case when current_exists then current_appointment.specialist_id end,
    actor_specialist_id,
    (select specialist.id from public.admin_specialists specialist where specialist.is_default limit 1)
  );

  if nullif(btrim(appointment_id), '') is null
    or requested_client_id is null
    or requested_starts_on is null
    or requested_starts_at is null
    or requested_duration_minutes <= 0
    or requested_buffer_minutes < 0
    or requested_specialist_id is null
    or requested_status not in ('confirmed', 'pending', 'request', 'cancelled', 'completed', 'no_show')
    or not exists (
      select 1 from public.admin_clients client where client.id = requested_client_id
    )
    or not exists (
      select 1 from public.admin_specialists specialist
      where specialist.id = requested_specialist_id and specialist.status = 'active'
    ) then
    raise exception using errcode = '22023', message = 'invalid_admin_appointment';
  end if;

  if actor_role = 'specialist' and (
    actor_specialist_id is null
    or requested_specialist_id <> actor_specialist_id
    or (current_exists and current_appointment.specialist_id <> actor_specialist_id)
  ) then
    raise exception using errcode = '42501', message = 'appointment_forbidden';
  end if;

  -- Manual appointment creation currently receives an existing client id in a
  -- separate request. Without same-transaction provenance, first-time client
  -- attachment by a specialist must fail closed. Owners can establish the first
  -- assignment; later specialist writes may use only that specialist's clients.
  if actor_role = 'specialist' and not exists (
    select 1
    from public.admin_appointments assigned_appointment
    where assigned_appointment.specialist_id = actor_specialist_id
      and assigned_appointment.client_id = requested_client_id
  ) then
    raise exception using errcode = '42501', message = 'appointment_client_forbidden';
  end if;

  first_lock_date := case when observed_exists then least(observed_starts_on, requested_starts_on) else requested_starts_on end;
  second_lock_date := case when observed_exists then greatest(observed_starts_on, requested_starts_on) else requested_starts_on end;
  perform pg_advisory_xact_lock(hashtextextended('public-booking:' || first_lock_date::text, 0));
  if second_lock_date <> first_lock_date then
    perform pg_advisory_xact_lock(hashtextextended('public-booking:' || second_lock_date::text, 0));
  end if;

  select * into current_appointment
  from public.admin_appointments appointment
  where appointment.id = appointment_id
  for update;
  current_exists := found;

  if current_exists is distinct from observed_exists
    or (current_exists and (
      current_appointment.starts_on is distinct from observed_starts_on
      or requested_version is null
      or requested_version <> current_appointment.version
    ))
    or (not current_exists and requested_version is not null) then
    raise exception using errcode = 'P0001', message = 'appointment_concurrent_update';
  end if;

  effective_duration_minutes := requested_duration_minutes;
  effective_buffer_minutes := case when current_exists then current_appointment.buffer_minutes else requested_buffer_minutes end;
  effective_service_name := case
    when current_exists and current_appointment.origin = 'public' then current_appointment.service_name
    else p_record ->> 'service_name'
  end;
  slot_range := tsrange(
    requested_starts_on + requested_starts_at,
    requested_starts_on + requested_starts_at + make_interval(mins => effective_duration_minutes + effective_buffer_minutes),
    '[)'
  );

  if requested_status in ('confirmed', 'pending', 'request') and exists (
    select 1 from public.admin_calendar_blocks block
    where block.specialist_id = requested_specialist_id
      and block.block_date = requested_starts_on
      and slot_range && tsrange(block.block_date + block.starts_at, block.block_date + block.ends_at, '[)')
  ) then
    raise exception using errcode = 'P0001', message = 'appointment_calendar_block_conflict';
  end if;

  if requested_status in ('confirmed', 'pending', 'request') and exists (
    select 1 from public.public_booking_holds hold
    where hold.specialist_id = requested_specialist_id
      and hold.starts_on = requested_starts_on
      and hold.status = 'active'
      and hold.expires_at > now()
      and slot_range && tsrange(
        hold.starts_on + hold.starts_at,
        hold.starts_on + hold.starts_at + make_interval(mins => hold.duration_minutes + hold.buffer_minutes),
        '[)'
      )
  ) then
    raise exception using errcode = 'P0001', message = 'appointment_public_hold_conflict';
  end if;

  if current_exists then
    update public.admin_appointments appointment
    set
      client_id = requested_client_id,
      client_name_snapshot = p_record ->> 'client_name_snapshot',
      specialist_id = requested_specialist_id,
      starts_on = requested_starts_on,
      starts_at = requested_starts_at,
      service_name = effective_service_name,
      status = requested_status,
      duration_minutes = effective_duration_minutes,
      buffer_minutes = effective_buffer_minutes,
      internal_note = p_record ->> 'internal_note',
      overlap_override = (p_record ->> 'overlap_override')::boolean,
      overlap_override_reason = p_record ->> 'overlap_override_reason',
      overlap_overridden_at = nullif(p_record ->> 'overlap_overridden_at', '')::timestamptz,
      overlap_overridden_by = nullif(p_record ->> 'overlap_overridden_by', '')::uuid,
      post_visit_comment = p_record ->> 'post_visit_comment',
      post_visit_commented_at = nullif(p_record ->> 'post_visit_commented_at', '')::timestamptz,
      post_visit_commented_by = case when btrim(coalesce(p_record ->> 'post_visit_comment', '')) <> '' then p_actor_user_id else null end,
      updated_by = p_actor_user_id
    where appointment.id = appointment_id;
  else
    insert into public.admin_appointments (
      id, client_id, client_name_snapshot, specialist_id, starts_on, starts_at,
      service_name, status, duration_minutes, buffer_minutes, internal_note,
      overlap_override, overlap_override_reason, overlap_overridden_at,
      overlap_overridden_by, post_visit_comment, post_visit_commented_at,
      post_visit_commented_by, created_by, updated_by, origin
    ) values (
      appointment_id, requested_client_id, p_record ->> 'client_name_snapshot',
      requested_specialist_id, requested_starts_on, requested_starts_at,
      p_record ->> 'service_name', requested_status, requested_duration_minutes,
      requested_buffer_minutes, p_record ->> 'internal_note',
      (p_record ->> 'overlap_override')::boolean, p_record ->> 'overlap_override_reason',
      nullif(p_record ->> 'overlap_overridden_at', '')::timestamptz,
      nullif(p_record ->> 'overlap_overridden_by', '')::uuid,
      p_record ->> 'post_visit_comment',
      nullif(p_record ->> 'post_visit_commented_at', '')::timestamptz,
      case when btrim(coalesce(p_record ->> 'post_visit_comment', '')) <> '' then p_actor_user_id else null end,
      p_actor_user_id, p_actor_user_id, 'admin'
    );
  end if;

  insert into public.admin_audit_log (actor_user_id, action, entity_table, entity_id, metadata)
  values (
    p_actor_user_id,
    p_action,
    'admin_appointments',
    appointment_id,
    p_audit_metadata || jsonb_build_object('specialist_id', requested_specialist_id)
  );
exception
  when exclusion_violation then
    raise exception using errcode = '23P01', message = 'appointment_overlap_conflict';
end;
$$;

-- The site setting is canonical. Active specialist rows mirror it so every
-- availability path observes the same owner-configured cap.
create or replace function public.admin_lock_public_daily_limit()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('admin-public-daily-limit', 0));
  return null;
end;
$$;

drop trigger if exists lock_public_daily_limit_on_specialist_insert on public.admin_specialists;
create trigger lock_public_daily_limit_on_specialist_insert
before insert on public.admin_specialists
for each statement execute function public.admin_lock_public_daily_limit();

drop trigger if exists lock_public_daily_limit_on_specialist_update on public.admin_specialists;
create trigger lock_public_daily_limit_on_specialist_update
before update of status, public_daily_limit on public.admin_specialists
for each statement execute function public.admin_lock_public_daily_limit();

drop trigger if exists lock_public_daily_limit_on_settings_update on public.admin_site_settings;
create trigger lock_public_daily_limit_on_settings_update
before update of public_booking_daily_limit on public.admin_site_settings
for each statement execute function public.admin_lock_public_daily_limit();

create or replace function public.admin_enforce_specialist_daily_limit()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  canonical_daily_limit integer;
begin
  if new.status = 'active' then
    select settings.public_booking_daily_limit into canonical_daily_limit
    from public.admin_site_settings settings
    where settings.id = 'site';

    if not found then
      raise exception using errcode = '23514', message = 'booking_settings_not_found';
    end if;
    new.public_daily_limit := canonical_daily_limit;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_specialist_daily_limit_on_insert on public.admin_specialists;
create trigger enforce_specialist_daily_limit_on_insert
before insert on public.admin_specialists
for each row execute function public.admin_enforce_specialist_daily_limit();

drop trigger if exists enforce_specialist_daily_limit_on_update on public.admin_specialists;
create trigger enforce_specialist_daily_limit_on_update
before update of status, public_daily_limit on public.admin_specialists
for each row execute function public.admin_enforce_specialist_daily_limit();

create or replace function public.admin_sync_public_daily_limit()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  update public.admin_specialists specialist
  set public_daily_limit = new.public_booking_daily_limit,
      updated_at = now()
  where specialist.status = 'active'
    and specialist.public_daily_limit is distinct from new.public_booking_daily_limit;
  return new;
end;
$$;

drop trigger if exists sync_public_daily_limit on public.admin_site_settings;
create trigger sync_public_daily_limit
after update of public_booking_daily_limit on public.admin_site_settings
for each row
when (old.public_booking_daily_limit is distinct from new.public_booking_daily_limit)
execute function public.admin_sync_public_daily_limit();

update public.admin_specialists specialist
set public_daily_limit = settings.public_booking_daily_limit,
    updated_at = now()
from public.admin_site_settings settings
where settings.id = 'site'
  and specialist.status = 'active'
  and specialist.public_daily_limit is distinct from settings.public_booking_daily_limit;

-- Specialists use an all-services eligibility model. Extend that model when a
-- new service is inserted, but only for active, publicly bookable specialists.
create or replace function public.admin_assign_new_service_to_specialists()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('admin-specialist-services', 0));
  insert into public.admin_specialist_services (specialist_id, service_slug)
  select specialist.id, new.slug
  from public.admin_specialists specialist
  where specialist.status = 'active'
    and specialist.public_booking_enabled
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists assign_new_service_to_specialists on public.admin_services;
create trigger assign_new_service_to_specialists
after insert on public.admin_services
for each row execute function public.admin_assign_new_service_to_specialists();

create or replace function public.admin_assign_specialist_to_services()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'active' and new.public_booking_enabled then
    perform pg_advisory_xact_lock(hashtextextended('admin-specialist-services', 0));
    insert into public.admin_specialist_services (specialist_id, service_slug)
    select new.id, service.slug
    from public.admin_services service
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists assign_specialist_to_services_on_insert on public.admin_specialists;
create trigger assign_specialist_to_services_on_insert
after insert on public.admin_specialists
for each row execute function public.admin_assign_specialist_to_services();

drop trigger if exists assign_specialist_to_services_on_update on public.admin_specialists;
create trigger assign_specialist_to_services_on_update
after update of status, public_booking_enabled on public.admin_specialists
for each row
when (new.status = 'active' and new.public_booking_enabled)
execute function public.admin_assign_specialist_to_services();

create or replace function public.public_booking_create_hold(
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
  where public.public_booking_specialist_available(
    specialist.id, variant.service_slug, p_starts_on, p_starts_at,
    variant.duration_minutes, settings.booking_buffer_minutes, existing_session_hold.id
  )
  order by (
    select count(*) from public.admin_appointments appointment
    where appointment.specialist_id = specialist.id
      and appointment.starts_on = p_starts_on
      and appointment.status <> 'cancelled'
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
    'specialistName', assigned_specialist.display_name
  );
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
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
  actor_role text;
  actor_specialist_id uuid;
  appointment public.admin_appointments%rowtype;
  client public.admin_clients%rowtype;
  recent_reveals integer;
begin
  if p_actor_user_id is null or nullif(btrim(p_appointment_id), '') is null
    or char_length(btrim(coalesce(p_purpose, ''))) not between 3 and 200 then
    raise exception using errcode = '22023', message = 'invalid_contact_reveal';
  end if;

  select profile.role::text, profile.specialist_id into actor_role, actor_specialist_id
  from public.admin_profiles profile
  where profile.user_id = p_actor_user_id and profile.status = 'active'
    and profile.role::text in ('owner', 'administrator', 'specialist');
  if not found then raise exception using errcode = '42501', message = 'contact_reveal_forbidden'; end if;

  select * into appointment from public.admin_appointments where id = p_appointment_id;
  if not found then raise exception using errcode = 'P0002', message = 'appointment_not_found'; end if;

  -- Specialists need contact details only for live operational work. Preserve a
  -- short 48-hour history window and bound future exposure to 180 days.
  if actor_role = 'specialist' and (
    actor_specialist_id is null
    or appointment.specialist_id <> actor_specialist_id
    or appointment.status not in ('confirmed', 'pending', 'request')
    or appointment.starts_on + appointment.starts_at < (now() at time zone 'Europe/Sofia') - interval '48 hours'
    or appointment.starts_on + appointment.starts_at > (now() at time zone 'Europe/Sofia') + interval '180 days'
  ) then
    raise exception using errcode = '42501', message = 'contact_reveal_forbidden';
  end if;

  -- Serialize count, alert, and audit insertion for this actor. The rolling
  -- window allows 60 reveals and blocks the next request; warning is emitted as
  -- the twentieth successful reveal is recorded.
  perform pg_advisory_xact_lock(hashtextextended('admin-contact-reveal:' || p_actor_user_id::text, 0));
  select count(*) into recent_reveals from public.admin_audit_log audit
  where audit.actor_user_id = p_actor_user_id
    and audit.action = 'client.contact.reveal'
    and audit.created_at >= now() - interval '10 minutes';
  if recent_reveals >= 60 then
    raise exception using errcode = 'P0001', message = 'contact_reveal_rate_limited';
  end if;

  if recent_reveals >= 19 and not exists (
    select 1 from public.admin_security_alerts alert
    where alert.actor_user_id = p_actor_user_id
      and alert.alert_type = 'bulk_contact_reveal'
      and alert.created_at >= now() - interval '10 minutes'
  ) then
    insert into public.admin_security_alerts (actor_user_id, alert_type, severity, metadata)
    values (
      p_actor_user_id,
      'bulk_contact_reveal',
      'warning',
      jsonb_build_object('contactRevealCount', recent_reveals + 1, 'windowMinutes', 10)
    );
  end if;

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

create index if not exists admin_security_alerts_actor_type_idx
  on public.admin_security_alerts (actor_user_id, alert_type, created_at desc);

create or replace function public.admin_protect_last_active_owner()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.role::text = 'owner' and old.status = 'active'
    and (
      tg_op = 'DELETE'
      or new.role::text <> 'owner'
      or new.status <> 'active'
    ) then
    perform pg_advisory_xact_lock(hashtextextended('admin-active-owner', 0));
    if not exists (
      select 1
      from public.admin_profiles other_profile
      where other_profile.user_id <> old.user_id
        and other_profile.role::text = 'owner'
        and other_profile.status = 'active'
    ) then
      raise exception using errcode = '23514', message = 'last_active_owner_required';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Alert readers receive only explicit UI fields. Raw metadata and actor UUIDs
-- never leave this function; display name is the only joined staff identity.
create or replace function public.admin_list_security_alerts()
returns table (
  id uuid,
  alert_type text,
  severity text,
  created_at timestamptz,
  resolved_at timestamptz,
  actor_name text,
  event_count integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  trusted_service_call boolean := coalesce(auth.role(), '') = 'service_role';
begin
  -- The current server route calls with the service role only after validating
  -- the end-user token, AAL2, active profile, and owner/administrator role.
  -- Direct authenticated RPC calls must prove the same conditions here.
  if not trusted_service_call and (
    actor_user_id is null
    or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
    or not exists (
      select 1
      from public.admin_profiles profile
      where profile.user_id = actor_user_id
        and profile.status = 'active'
        and profile.role::text in ('owner', 'administrator')
    )
  ) then
    raise exception using errcode = '42501', message = 'security_alert_forbidden';
  end if;

  return query
  select
    alert.id,
    alert.alert_type,
    alert.severity,
    alert.created_at,
    alert.resolved_at,
    profile.display_name as actor_name,
    case
      when coalesce(
        alert.metadata ->> 'event_count',
        alert.metadata ->> 'eventCount',
        alert.metadata ->> 'contactRevealCount',
        ''
      ) ~ '^[0-9]{1,9}$' then coalesce(
        alert.metadata ->> 'event_count',
        alert.metadata ->> 'eventCount',
        alert.metadata ->> 'contactRevealCount'
      )::integer
      else null
    end as event_count
  from public.admin_security_alerts alert
  left join public.admin_profiles profile on profile.user_id = alert.actor_user_id
  where alert.resolved_at is null
  order by alert.created_at desc, alert.id;
end;
$$;

create or replace function public.admin_resolve_security_alert(
  p_alert_id uuid,
  p_actor_user_id uuid default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  authenticated_user_id uuid := auth.uid();
  actor_user_id uuid := coalesce(authenticated_user_id, p_actor_user_id);
  trusted_service_call boolean := coalesce(auth.role(), '') = 'service_role';
  resolved_alert_type text;
  resolved_event_count integer;
  resolved_severity text;
begin
  -- See admin_list_security_alerts(): the service-role server path performs
  -- end-user owner/administrator and AAL2 authorization before this call.
  if (
    actor_user_id is null
    or (not trusted_service_call and actor_user_id is distinct from authenticated_user_id)
    or (not trusted_service_call and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2')
    or not exists (
      select 1
      from public.admin_profiles profile
      where profile.user_id = actor_user_id
        and profile.status = 'active'
        and profile.role::text in ('owner', 'administrator')
    )
  ) then
    raise exception using errcode = '42501', message = 'security_alert_forbidden';
  end if;
  if p_alert_id is null then
    raise exception using errcode = '22023', message = 'invalid_security_alert';
  end if;

  update public.admin_security_alerts alert
  set resolved_at = now()
  where alert.id = p_alert_id
    and alert.resolved_at is null
  returning
    alert.alert_type,
    case
      when coalesce(
        alert.metadata ->> 'event_count',
        alert.metadata ->> 'eventCount',
        alert.metadata ->> 'contactRevealCount',
        ''
      ) ~ '^[0-9]{1,9}$' then coalesce(
        alert.metadata ->> 'event_count',
        alert.metadata ->> 'eventCount',
        alert.metadata ->> 'contactRevealCount'
      )::integer
      else null
    end,
    alert.severity
  into resolved_alert_type, resolved_event_count, resolved_severity;

  if not found then
    return false;
  end if;

  insert into public.admin_audit_log (actor_user_id, action, entity_table, entity_id, metadata)
  values (
    actor_user_id,
    'security_alert.resolve',
    'admin_security_alerts',
    p_alert_id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'alert_type', resolved_alert_type,
      'event_count', resolved_event_count,
      'severity', resolved_severity
    ))
  );

  return true;
end;
$$;

-- Preserve the server write boundary for sensitive operational tables.
revoke select on table public.admin_clients from authenticated;
revoke select on table public.admin_appointments from authenticated;
revoke select on table public.admin_profiles from authenticated;
revoke select on table public.admin_audit_log from authenticated;
revoke select on table public.public_booking_holds from authenticated;
revoke all on table public.admin_security_alerts from anon, authenticated;
grant select, insert, update, delete on table public.admin_security_alerts to service_role;

revoke all on function public.admin_enforce_specialist_daily_limit() from public;
revoke all on function public.admin_lock_public_daily_limit() from public;
revoke all on function public.admin_sync_public_daily_limit() from public;
revoke all on function public.admin_assign_new_service_to_specialists() from public;
revoke all on function public.admin_assign_specialist_to_services() from public;
revoke all on function public.admin_list_security_alerts() from public, anon, authenticated;
revoke all on function public.admin_resolve_security_alert(uuid, uuid) from public, anon, authenticated;

grant execute on function public.admin_list_security_alerts() to authenticated, service_role;
grant execute on function public.admin_resolve_security_alert(uuid, uuid) to authenticated, service_role;

comment on function public.admin_list_security_alerts() is
  'Lists unresolved security alerts for active owners and administrators without raw metadata or actor UUIDs.';
comment on function public.admin_resolve_security_alert(uuid, uuid) is
  'Resolves one open security alert for an active owner or administrator and records a sanitized audit event.';
