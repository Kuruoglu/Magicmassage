-- Close booking races, preserve CRM data, and add optimistic concurrency tokens.

alter table public.admin_appointments
  add column if not exists public_phone_snapshot text,
  add column if not exists public_email_snapshot text,
  add column if not exists public_contact_preference_snapshot text;

update public.admin_appointments appointment
set
  public_phone_snapshot = coalesce(appointment.public_phone_snapshot, client.phone),
  public_email_snapshot = coalesce(appointment.public_email_snapshot, client.email),
  public_contact_preference_snapshot = coalesce(
    appointment.public_contact_preference_snapshot,
    client.preferred_contact
  )
from public.admin_clients client
where appointment.origin = 'public'
  and client.id = appointment.client_id
  and (
    appointment.public_phone_snapshot is null
    or appointment.public_contact_preference_snapshot is null
  );

alter table public.admin_appointments
  drop constraint if exists admin_appointments_public_contact_snapshot_check,
  add constraint admin_appointments_public_contact_snapshot_check
    check (
      (
        origin = 'public'
        and char_length(btrim(coalesce(public_phone_snapshot, ''))) between 7 and 32
        and public_contact_preference_snapshot in ('phone', 'viber', 'telegram', 'email')
        and (public_email_snapshot is null or char_length(public_email_snapshot) <= 254)
      )
      or (
        origin <> 'public'
        and public_phone_snapshot is null
        and public_email_snapshot is null
        and public_contact_preference_snapshot is null
      )
    );

comment on column public.admin_appointments.public_phone_snapshot is
  'Phone submitted for this public booking. CRM client contact fields are not overwritten.';
comment on column public.admin_appointments.public_email_snapshot is
  'Optional email submitted for this public booking.';
comment on column public.admin_appointments.public_contact_preference_snapshot is
  'Preferred contact channel submitted for this public booking.';

alter table public.admin_calendar_blocks
  add column if not exists version integer not null default 1;

alter table public.admin_calendar_blocks
  drop constraint if exists admin_calendar_blocks_version_check,
  add constraint admin_calendar_blocks_version_check check (version > 0);

create or replace function public.admin_prepare_appointment_write()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  first_lock_date date;
  second_lock_date date;
  override_changed boolean;
  slot_range tsrange;
begin
  if tg_op = 'UPDATE' then
    first_lock_date := least(old.starts_on, new.starts_on);
    second_lock_date := greatest(old.starts_on, new.starts_on);

    if old.origin = 'public' and (
      new.service_name is distinct from old.service_name
      or new.duration_minutes is distinct from old.duration_minutes
      or new.buffer_minutes is distinct from old.buffer_minutes
      or new.price_cents_snapshot is distinct from old.price_cents_snapshot
      or new.currency_snapshot is distinct from old.currency_snapshot
      or new.origin is distinct from old.origin
      or new.locale is distinct from old.locale
      or new.public_reference is distinct from old.public_reference
      or new.public_booking_hold_id is distinct from old.public_booking_hold_id
      or new.public_booking_idempotency_key_hash is distinct from old.public_booking_idempotency_key_hash
      or new.service_slug is distinct from old.service_slug
      or new.price_variant_id is distinct from old.price_variant_id
      or new.public_phone_snapshot is distinct from old.public_phone_snapshot
      or new.public_email_snapshot is distinct from old.public_email_snapshot
      or new.public_contact_preference_snapshot is distinct from old.public_contact_preference_snapshot
    ) then
      raise exception using
        errcode = '23514',
        message = 'public_appointment_immutable';
    end if;

    if new.origin is distinct from old.origin then
      raise exception using
        errcode = '23514',
        message = 'appointment_origin_immutable';
    end if;
  else
    first_lock_date := new.starts_on;
    second_lock_date := new.starts_on;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('public-booking:' || first_lock_date::text, 0)
  );
  if second_lock_date <> first_lock_date then
    perform pg_advisory_xact_lock(
      hashtextextended('public-booking:' || second_lock_date::text, 0)
    );
  end if;

  slot_range := tsrange(
    new.starts_on + new.starts_at,
    new.starts_on + new.starts_at
      + make_interval(mins => new.duration_minutes + new.buffer_minutes),
    '[)'
  );

  if new.status in ('confirmed', 'pending', 'request') and exists (
    select 1
    from public.admin_calendar_blocks block
    where block.block_date = new.starts_on
      and slot_range && tsrange(
        block.block_date + block.starts_at,
        block.block_date + block.ends_at,
        '[)'
      )
  ) then
    raise exception using
      errcode = '23P01',
      message = 'appointment_calendar_block_conflict';
  end if;

  if new.status in ('confirmed', 'pending', 'request') and exists (
    select 1
    from public.public_booking_holds hold
    where hold.starts_on = new.starts_on
      and hold.status = 'active'
      and hold.expires_at > now()
      and (new.public_booking_hold_id is null or hold.id <> new.public_booking_hold_id)
      and slot_range && tsrange(
        hold.starts_on + hold.starts_at,
        hold.starts_on + hold.starts_at
          + make_interval(mins => hold.duration_minutes + hold.buffer_minutes),
        '[)'
      )
  ) then
    raise exception using
      errcode = '23P01',
      message = 'appointment_public_hold_conflict';
  end if;

  if tg_op = 'INSERT' then
    new.version := greatest(coalesce(new.version, 1), 1);
    new.updated_at := coalesce(new.updated_at, now());
    new.updated_by := coalesce(auth.uid(), new.updated_by, new.created_by);
    override_changed := new.overlap_override;
  else
    new.version := old.version + 1;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), new.updated_by, old.updated_by);
    override_changed := new.overlap_override
      and (
        not old.overlap_override
        or new.overlap_override_reason is distinct from old.overlap_override_reason
      );
  end if;

  if override_changed then
    if not public.admin_can_manage_operations()
      and current_user not in ('postgres', 'service_role', 'supabase_admin') then
      raise exception using
        errcode = '42501',
        message = 'Only owner or administrator roles may authorize appointment overlaps.';
    end if;

    if btrim(new.overlap_override_reason) = '' then
      raise exception using
        errcode = '23514',
        message = 'An overlap override reason is required.';
    end if;

    new.overlap_overridden_at := now();
    new.overlap_overridden_by := coalesce(auth.uid(), new.overlap_overridden_by);
  elsif not new.overlap_override then
    new.overlap_override_reason := '';
    new.overlap_overridden_at := null;
    new.overlap_overridden_by := null;
  end if;

  if btrim(new.post_visit_comment) <> ''
    and (
      tg_op = 'INSERT'
      or new.post_visit_comment is distinct from old.post_visit_comment
    ) then
    new.post_visit_commented_at := now();
    new.post_visit_commented_by := coalesce(auth.uid(), new.post_visit_commented_by);
  elsif btrim(new.post_visit_comment) = '' then
    new.post_visit_commented_at := null;
    new.post_visit_commented_by := null;
  end if;

  return new;
end;
$$;

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
  requested_duration_minutes integer;
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

  select profile.role::text into actor_role
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
  requested_starts_on := (p_record ->> 'starts_on')::date;
  requested_starts_at := (p_record ->> 'starts_at')::time;
  requested_duration_minutes := (p_record ->> 'duration_minutes')::integer;
  requested_buffer_minutes := (p_record ->> 'buffer_minutes')::integer;
  requested_status := p_record ->> 'status';
  requested_version := nullif(p_record ->> 'version', '')::integer;

  if nullif(btrim(appointment_id), '') is null
    or requested_starts_on is null
    or requested_starts_at is null
    or requested_duration_minutes <= 0
    or requested_buffer_minutes < 0
    or requested_status not in ('confirmed', 'pending', 'request', 'cancelled', 'completed', 'no_show') then
    raise exception using errcode = '22023', message = 'invalid_admin_appointment';
  end if;

  select appointment.starts_on into observed_starts_on
  from public.admin_appointments appointment
  where appointment.id = appointment_id;
  observed_exists := found;

  first_lock_date := case
    when observed_exists then least(observed_starts_on, requested_starts_on)
    else requested_starts_on
  end;
  second_lock_date := case
    when observed_exists then greatest(observed_starts_on, requested_starts_on)
    else requested_starts_on
  end;

  perform pg_advisory_xact_lock(
    hashtextextended('public-booking:' || first_lock_date::text, 0)
  );
  if second_lock_date <> first_lock_date then
    perform pg_advisory_xact_lock(
      hashtextextended('public-booking:' || second_lock_date::text, 0)
    );
  end if;

  select * into current_appointment
  from public.admin_appointments appointment
  where appointment.id = appointment_id
  for update;
  current_exists := found;

  if current_exists is distinct from observed_exists
    or (
      current_exists
      and (
        current_appointment.starts_on is distinct from observed_starts_on
        or requested_version is null
        or requested_version <> current_appointment.version
      )
    )
    or (not current_exists and requested_version is not null) then
    raise exception using errcode = 'P0001', message = 'appointment_concurrent_update';
  end if;

  effective_duration_minutes := case
    when current_exists and current_appointment.origin = 'public'
      then current_appointment.duration_minutes
    else requested_duration_minutes
  end;
  effective_buffer_minutes := case
    when current_exists then current_appointment.buffer_minutes
    else requested_buffer_minutes
  end;
  effective_service_name := case
    when current_exists and current_appointment.origin = 'public'
      then current_appointment.service_name
    else p_record ->> 'service_name'
  end;

  slot_range := tsrange(
    requested_starts_on + requested_starts_at,
    requested_starts_on + requested_starts_at
      + make_interval(mins => effective_duration_minutes + effective_buffer_minutes),
    '[)'
  );

  if requested_status in ('confirmed', 'pending', 'request') and exists (
    select 1
    from public.admin_calendar_blocks block
    where block.block_date = requested_starts_on
      and slot_range && tsrange(
        block.block_date + block.starts_at,
        block.block_date + block.ends_at,
        '[)'
      )
  ) then
    raise exception using errcode = 'P0001', message = 'appointment_calendar_block_conflict';
  end if;

  if requested_status in ('confirmed', 'pending', 'request') and exists (
    select 1
    from public.public_booking_holds hold
    where hold.starts_on = requested_starts_on
      and hold.status = 'active'
      and hold.expires_at > now()
      and slot_range && tsrange(
        hold.starts_on + hold.starts_at,
        hold.starts_on + hold.starts_at
          + make_interval(mins => hold.duration_minutes + hold.buffer_minutes),
        '[)'
      )
  ) then
    raise exception using errcode = 'P0001', message = 'appointment_public_hold_conflict';
  end if;

  if current_exists then
    update public.admin_appointments appointment
    set
      client_id = p_record ->> 'client_id',
      client_name_snapshot = p_record ->> 'client_name_snapshot',
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
      post_visit_commented_by = case
        when btrim(coalesce(p_record ->> 'post_visit_comment', '')) <> '' then p_actor_user_id
        else null
      end,
      updated_by = p_actor_user_id
    where appointment.id = appointment_id;
  else
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
      overlap_override,
      overlap_override_reason,
      overlap_overridden_at,
      overlap_overridden_by,
      post_visit_comment,
      post_visit_commented_at,
      post_visit_commented_by,
      created_by,
      updated_by,
      origin
    ) values (
      appointment_id,
      p_record ->> 'client_id',
      p_record ->> 'client_name_snapshot',
      requested_starts_on,
      requested_starts_at,
      p_record ->> 'service_name',
      requested_status,
      requested_duration_minutes,
      requested_buffer_minutes,
      p_record ->> 'internal_note',
      (p_record ->> 'overlap_override')::boolean,
      p_record ->> 'overlap_override_reason',
      nullif(p_record ->> 'overlap_overridden_at', '')::timestamptz,
      nullif(p_record ->> 'overlap_overridden_by', '')::uuid,
      p_record ->> 'post_visit_comment',
      nullif(p_record ->> 'post_visit_commented_at', '')::timestamptz,
      case
        when btrim(coalesce(p_record ->> 'post_visit_comment', '')) <> '' then p_actor_user_id
        else null
      end,
      p_actor_user_id,
      p_actor_user_id,
      'admin'
    );
  end if;

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    p_actor_user_id,
    p_action,
    'admin_appointments',
    appointment_id,
    p_audit_metadata
  );
exception
  when exclusion_violation then
    raise exception using errcode = '23P01', message = 'appointment_overlap_conflict';
end;
$$;

revoke all on function public.admin_mutate_calendar_block(
  text, uuid, date, time without time zone, time without time zone, text, text, uuid
) from public, anon, authenticated;
drop function public.admin_mutate_calendar_block(
  text, uuid, date, time without time zone, time without time zone, text, text, uuid
);

create function public.admin_mutate_calendar_block(
  p_action text,
  p_block_id uuid,
  p_block_date date,
  p_starts_at time without time zone,
  p_ends_at time without time zone,
  p_kind text,
  p_internal_note text,
  p_actor_user_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  audit_action text;
  block_exists boolean;
  block_id uuid;
  block_range tsrange;
  existing_block public.admin_calendar_blocks%rowtype;
  first_lock_date date;
  observed_block_date date;
  saved_block public.admin_calendar_blocks%rowtype;
  second_lock_date date;
begin
  if p_action is null
    or p_action not in ('upsert', 'delete')
    or p_actor_user_id is null
    or not exists (
      select 1
      from public.admin_profiles profile
      where profile.user_id = p_actor_user_id
        and profile.status = 'active'
        and profile.role::text in ('owner', 'administrator', 'specialist')
    ) then
    raise exception using errcode = '42501', message = 'calendar_block_forbidden';
  end if;

  if p_action = 'delete' then
    if p_block_id is null or p_expected_version is null or p_expected_version <= 0 then
      raise exception using errcode = '22023', message = 'invalid_calendar_block';
    end if;

    select block_date into observed_block_date
    from public.admin_calendar_blocks
    where id = p_block_id;

    if not found then
      raise exception using errcode = 'P0002', message = 'calendar_block_not_found';
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended('public-booking:' || observed_block_date::text, 0)
    );

    select * into existing_block
    from public.admin_calendar_blocks
    where id = p_block_id
    for update;

    if not found
      or existing_block.block_date is distinct from observed_block_date
      or existing_block.version <> p_expected_version then
      raise exception using errcode = 'P0001', message = 'calendar_block_concurrent_update';
    end if;

    delete from public.admin_calendar_blocks where id = p_block_id;

    insert into public.admin_audit_log (
      actor_user_id,
      action,
      entity_table,
      entity_id,
      metadata
    ) values (
      p_actor_user_id,
      'calendar_block.delete',
      'admin_calendar_blocks',
      p_block_id::text,
      jsonb_build_object(
        'block_date', existing_block.block_date,
        'starts_at', existing_block.starts_at,
        'ends_at', existing_block.ends_at,
        'kind', existing_block.kind,
        'version', existing_block.version
      )
    );

    return jsonb_build_object('deleted', true, 'id', p_block_id);
  end if;

  if p_block_date is null
    or p_starts_at is null
    or p_ends_at is null
    or p_starts_at >= p_ends_at
    or p_kind is null
    or p_kind not in ('personal', 'unavailable', 'other')
    or char_length(coalesce(p_internal_note, '')) > 2000 then
    raise exception using errcode = '22023', message = 'invalid_calendar_block';
  end if;

  block_id := coalesce(p_block_id, gen_random_uuid());
  select block_date into observed_block_date
  from public.admin_calendar_blocks
  where id = block_id;
  block_exists := found;

  if (block_exists and (p_expected_version is null or p_expected_version <= 0))
    or (not block_exists and p_expected_version is not null) then
    raise exception using errcode = 'P0001', message = 'calendar_block_concurrent_update';
  end if;

  first_lock_date := case
    when block_exists then least(observed_block_date, p_block_date)
    else p_block_date
  end;
  second_lock_date := case
    when block_exists then greatest(observed_block_date, p_block_date)
    else p_block_date
  end;

  perform pg_advisory_xact_lock(
    hashtextextended('public-booking:' || first_lock_date::text, 0)
  );
  if second_lock_date <> first_lock_date then
    perform pg_advisory_xact_lock(
      hashtextextended('public-booking:' || second_lock_date::text, 0)
    );
  end if;

  select * into existing_block
  from public.admin_calendar_blocks
  where id = block_id
  for update;

  if block_exists and (
    not found
    or existing_block.block_date is distinct from observed_block_date
    or existing_block.version <> p_expected_version
  ) then
    raise exception using errcode = 'P0001', message = 'calendar_block_concurrent_update';
  elsif not block_exists and found then
    raise exception using errcode = 'P0001', message = 'calendar_block_concurrent_update';
  end if;

  audit_action := case when block_exists then 'calendar_block.update' else 'calendar_block.create' end;
  block_range := tsrange(p_block_date + p_starts_at, p_block_date + p_ends_at, '[)');

  if exists (
    select 1
    from public.admin_appointments appointment
    where appointment.starts_on = p_block_date
      and appointment.status in ('confirmed', 'pending', 'request')
      and block_range && tsrange(
        appointment.starts_on + appointment.starts_at,
        appointment.starts_on + appointment.starts_at
          + make_interval(mins => appointment.duration_minutes + appointment.buffer_minutes),
        '[)'
      )
  ) or exists (
    select 1
    from public.public_booking_holds hold
    where hold.starts_on = p_block_date
      and hold.status = 'active'
      and hold.expires_at > now()
      and block_range && tsrange(
        hold.starts_on + hold.starts_at,
        hold.starts_on + hold.starts_at
          + make_interval(mins => hold.duration_minutes + hold.buffer_minutes),
        '[)'
      )
  ) or exists (
    select 1
    from public.admin_calendar_blocks other_block
    where other_block.id <> block_id
      and other_block.block_date = p_block_date
      and block_range && tsrange(
        other_block.block_date + other_block.starts_at,
        other_block.block_date + other_block.ends_at,
        '[)'
      )
  ) then
    raise exception using errcode = '23P01', message = 'calendar_block_conflict';
  end if;

  insert into public.admin_calendar_blocks (
    id,
    block_date,
    starts_at,
    ends_at,
    kind,
    internal_note,
    created_by,
    updated_by,
    version
  ) values (
    block_id,
    p_block_date,
    p_starts_at,
    p_ends_at,
    p_kind,
    coalesce(p_internal_note, ''),
    p_actor_user_id,
    p_actor_user_id,
    1
  )
  on conflict (id) do update
  set
    block_date = excluded.block_date,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    kind = excluded.kind,
    internal_note = excluded.internal_note,
    updated_by = p_actor_user_id,
    version = public.admin_calendar_blocks.version + 1
  returning * into saved_block;

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    p_actor_user_id,
    audit_action,
    'admin_calendar_blocks',
    saved_block.id::text,
    jsonb_build_object(
      'block_date', saved_block.block_date,
      'starts_at', saved_block.starts_at,
      'ends_at', saved_block.ends_at,
      'kind', saved_block.kind,
      'version', saved_block.version
    )
  );

  return to_jsonb(saved_block);
end;
$$;

create or replace function public.public_booking_get_availability(
  p_price_variant_id text,
  p_from date,
  p_days integer
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
  if nullif(btrim(p_price_variant_id), '') is null
    or p_days not between 1 and 31
    or p_from is null then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  update public.public_booking_holds
  set status = 'expired'
  where status = 'active' and expires_at <= now();

  select * into settings
  from public.admin_site_settings
  where id = 'site';

  if not found then
    raise exception using errcode = 'P0001', message = 'booking_unavailable';
  end if;
  if not settings.public_booking_enabled then
    return jsonb_build_object('enabled', false, 'timezone', settings.timezone, 'days', '[]'::jsonb);
  end if;
  if p_from < local_today or p_from > local_today + settings.booking_horizon_days then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  select
    price.id,
    price.service_slug,
    price.duration_minutes
  into variant
  from public.admin_price_variants price
  join public.admin_services service on service.slug = price.service_slug
  where price.id = p_price_variant_id
    and price.status = 'active'
    and service.status = 'published';

  if not found then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  return jsonb_build_object(
    'enabled', true,
    'timezone', settings.timezone,
    'priceVariantId', variant.id,
    'from', p_from,
    'days', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', candidate.day,
          'capReached', candidate.reserved_count >= settings.public_booking_daily_limit,
          'slots', case
            when candidate.reserved_count >= settings.public_booking_daily_limit then '[]'::jsonb
            else coalesce((
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
                candidate.day,
                slot.slot_time,
                variant.duration_minutes,
                settings.working_days,
                settings.working_hours,
                settings.booking_slot_step_minutes,
                settings.booking_min_lead_minutes,
                settings.booking_horizon_days
              )
              and not exists (
                select 1
                from public.admin_calendar_blocks block
                where block.block_date = candidate.day
                  and tsrange(candidate.day + slot.slot_time,
                    candidate.day + slot.slot_time + make_interval(mins => variant.duration_minutes + settings.booking_buffer_minutes), '[)')
                    && tsrange(block.block_date + block.starts_at, block.block_date + block.ends_at, '[)')
              )
              and not exists (
                select 1
                from public.admin_appointments appointment
                where appointment.starts_on = candidate.day
                  and appointment.status in ('confirmed', 'pending', 'request')
                  and tsrange(candidate.day + slot.slot_time,
                    candidate.day + slot.slot_time + make_interval(mins => variant.duration_minutes + settings.booking_buffer_minutes), '[)')
                    && tsrange(appointment.starts_on + appointment.starts_at,
                      appointment.starts_on + appointment.starts_at
                        + make_interval(mins => appointment.duration_minutes + appointment.buffer_minutes), '[)')
              )
              and not exists (
                select 1
                from public.public_booking_holds hold
                where hold.starts_on = candidate.day
                  and hold.status = 'active'
                  and hold.expires_at > now()
                  and tsrange(candidate.day + slot.slot_time,
                    candidate.day + slot.slot_time + make_interval(mins => variant.duration_minutes + settings.booking_buffer_minutes), '[)')
                    && tsrange(hold.starts_on + hold.starts_at,
                      hold.starts_on + hold.starts_at
                        + make_interval(mins => hold.duration_minutes + hold.buffer_minutes), '[)')
              )
            ), '[]'::jsonb)
          end
        ) order by candidate.day
      )
      from (
        select
          generated.day::date as day,
          (
            select count(*)
            from public.admin_appointments appointment
            where appointment.starts_on = generated.day::date
              and appointment.status <> 'cancelled'
          ) + (
            select count(*)
            from public.public_booking_holds hold
            where hold.starts_on = generated.day::date
              and hold.status = 'active'
              and hold.expires_at > now()
          ) as reserved_count
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

create or replace function public.public_booking_create_hold(
  p_token_hash text,
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
  hold public.public_booking_holds%rowtype;
  slot_range tsrange;
begin
  if coalesce(p_token_hash, '') !~ '^[a-f0-9]{64}$'
    or nullif(btrim(p_price_variant_id), '') is null
    or p_starts_on is null
    or p_starts_at is null then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public-booking:' || p_starts_on::text, 0));

  update public.public_booking_holds
  set status = 'expired'
  where status = 'active' and expires_at <= now();

  select * into settings
  from public.admin_site_settings
  where id = 'site';

  if not found or not settings.public_booking_enabled then
    raise exception using errcode = 'P0001', message = 'booking_unavailable';
  end if;

  select
    price.id,
    price.service_slug,
    price.duration_minutes,
    price.price_cents,
    price.currency
  into variant
  from public.admin_price_variants price
  join public.admin_services service on service.slug = price.service_slug
  where price.id = p_price_variant_id
    and price.status = 'active'
    and service.status = 'published';

  if not found or not public.public_booking_slot_in_schedule(
    p_starts_on,
    p_starts_at,
    variant.duration_minutes,
    settings.working_days,
    settings.working_hours,
    settings.booking_slot_step_minutes,
    settings.booking_min_lead_minutes,
    settings.booking_horizon_days
  ) then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  if (
    select count(*)
    from public.admin_appointments appointment
    where appointment.starts_on = p_starts_on and appointment.status <> 'cancelled'
  ) + (
    select count(*)
    from public.public_booking_holds active_hold
    where active_hold.starts_on = p_starts_on
      and active_hold.status = 'active'
      and active_hold.expires_at > now()
  ) >= settings.public_booking_daily_limit then
    raise exception using errcode = 'P0001', message = 'cap_reached';
  end if;

  slot_range := tsrange(
    p_starts_on + p_starts_at,
    p_starts_on + p_starts_at
      + make_interval(mins => variant.duration_minutes + settings.booking_buffer_minutes),
    '[)'
  );

  if exists (
    select 1
    from public.admin_calendar_blocks block
    where block.block_date = p_starts_on
      and slot_range && tsrange(block.block_date + block.starts_at, block.block_date + block.ends_at, '[)')
  ) or exists (
    select 1
    from public.admin_appointments appointment
    where appointment.starts_on = p_starts_on
      and appointment.status in ('confirmed', 'pending', 'request')
      and slot_range && tsrange(
        appointment.starts_on + appointment.starts_at,
        appointment.starts_on + appointment.starts_at
          + make_interval(mins => appointment.duration_minutes + appointment.buffer_minutes),
        '[)'
      )
  ) or exists (
    select 1
    from public.public_booking_holds existing_hold
    where existing_hold.starts_on = p_starts_on
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

  insert into public.public_booking_holds (
    token_hash,
    price_variant_id,
    service_slug,
    starts_on,
    starts_at,
    duration_minutes,
    buffer_minutes,
    price_cents,
    currency,
    expires_at
  ) values (
    p_token_hash,
    variant.id,
    variant.service_slug,
    p_starts_on,
    p_starts_at,
    variant.duration_minutes,
    settings.booking_buffer_minutes,
    variant.price_cents,
    variant.currency,
    now() + make_interval(mins => settings.booking_hold_minutes)
  )
  returning * into hold;

  return jsonb_build_object(
    'priceVariantId', hold.price_variant_id,
    'date', hold.starts_on,
    'time', to_char(hold.starts_at, 'HH24:MI'),
    'expiresAt', hold.expires_at
  );
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
end;
$$;

create or replace function public.public_booking_confirm(
  p_token_hash text,
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
  settings public.admin_site_settings%rowtype;
  hold public.public_booking_holds%rowtype;
  variant record;
  client_id text;
  appointment public.admin_appointments%rowtype;
  appointment_id text;
  observed_starts_on date;
  public_reference text;
  slot_range tsrange;
begin
  if coalesce(p_token_hash, '') !~ '^[a-f0-9]{64}$'
    or coalesce(p_idempotency_key_hash, '') !~ '^[a-f0-9]{64}$'
    or p_locale is null
    or p_locale not in ('bg', 'ru', 'ua', 'en')
    or p_contact_preference is null
    or p_contact_preference not in ('phone', 'viber', 'telegram', 'email')
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
    or (p_contact_preference = 'email' and nullif(btrim(coalesce(p_email, '')), '') is null)
    or char_length(coalesce(p_public_note, '')) > 1000 then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  select starts_on into observed_starts_on
  from public.public_booking_holds
  where token_hash = p_token_hash;

  if not found then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public-booking:' || observed_starts_on::text, 0));

  select * into hold
  from public.public_booking_holds
  where token_hash = p_token_hash
  for update;

  if not found or hold.starts_on is distinct from observed_starts_on then
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
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

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
    p_contact_preference,
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
      coalesce(public.admin_clients.gdpr_consent -> 'public_booking', '{}'::jsonb)
        || (excluded.gdpr_consent -> 'public_booking')
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
      public_phone_snapshot,
      public_email_snapshot,
      public_contact_preference_snapshot,
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
      hold.service_slug,
      hold.price_variant_id,
      hold.price_cents,
      hold.currency,
      'public',
      p_locale,
      public_reference,
      p_idempotency_key_hash,
      hold.id,
      btrim(p_phone),
      nullif(lower(btrim(p_email)), ''),
      p_contact_preference,
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

revoke all on function public.admin_prepare_appointment_write() from public;
revoke all on function public.admin_save_appointment_with_audit(jsonb, uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.admin_mutate_calendar_block(
  text, uuid, date, time without time zone, time without time zone, text, text, uuid, integer
) from public, anon, authenticated;
revoke all on function public.public_booking_get_availability(text, date, integer)
  from public, anon, authenticated;
revoke all on function public.public_booking_create_hold(text, text, date, time without time zone)
  from public, anon, authenticated;
revoke all on function public.public_booking_confirm(text, text, text, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;

grant execute on function public.admin_save_appointment_with_audit(jsonb, uuid, text, jsonb)
  to service_role;
grant execute on function public.admin_mutate_calendar_block(
  text, uuid, date, time without time zone, time without time zone, text, text, uuid, integer
) to service_role;
grant execute on function public.public_booking_get_availability(text, date, integer)
  to service_role;
grant execute on function public.public_booking_create_hold(text, text, date, time without time zone)
  to service_role;
grant execute on function public.public_booking_confirm(text, text, text, text, text, text, text, text, text, boolean)
  to service_role;
