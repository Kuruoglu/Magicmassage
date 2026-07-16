-- Isolate schedules and client access by specialist. Existing records belong to Natali.

create extension if not exists btree_gist with schema extensions;

create table if not exists public.admin_specialists (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  public_slug text not null unique,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'offboarded')),
  public_booking_enabled boolean not null default true,
  public_daily_limit integer not null default 8 check (public_daily_limit between 1 and 8),
  color text not null default '#3f7d6c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  display_order integer not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admin_specialists_one_default_uidx
  on public.admin_specialists (is_default)
  where is_default;

insert into public.admin_specialists (
  id, public_slug, display_name, status, public_booking_enabled,
  public_daily_limit, color, display_order, is_default
) values (
  '00000000-0000-4000-8000-000000000001',
  'natali',
  'Natali',
  'active',
  true,
  8,
  '#3f7d6c',
  0,
  true
)
on conflict (id) do update set
  is_default = true,
  updated_at = now();

create table if not exists public.admin_specialist_services (
  specialist_id uuid not null references public.admin_specialists(id) on delete cascade,
  service_slug text not null references public.admin_services(slug) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key (specialist_id, service_slug)
);

insert into public.admin_specialist_services (specialist_id, service_slug)
select '00000000-0000-4000-8000-000000000001'::uuid, service.slug
from public.admin_services service
on conflict do nothing;

alter table public.admin_profiles
  add column if not exists specialist_id uuid references public.admin_specialists(id) on delete restrict;

alter table public.admin_appointments
  add column if not exists specialist_id uuid references public.admin_specialists(id) on delete restrict;
alter table public.admin_calendar_blocks
  add column if not exists specialist_id uuid references public.admin_specialists(id) on delete restrict;
alter table public.public_booking_holds
  add column if not exists specialist_id uuid references public.admin_specialists(id) on delete restrict;

update public.admin_appointments
set specialist_id = '00000000-0000-4000-8000-000000000001'
where specialist_id is null;
update public.admin_calendar_blocks
set specialist_id = '00000000-0000-4000-8000-000000000001'
where specialist_id is null;
update public.public_booking_holds
set specialist_id = '00000000-0000-4000-8000-000000000001'
where specialist_id is null;

alter table public.admin_appointments alter column specialist_id set not null;
alter table public.admin_calendar_blocks alter column specialist_id set not null;
alter table public.public_booking_holds alter column specialist_id set not null;

create or replace function public.admin_sync_specialist_profile()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.role::text = 'specialist' then
    insert into public.admin_specialists (
      id, auth_user_id, public_slug, display_name, status,
      public_booking_enabled, public_daily_limit, color, display_order, is_default
    ) values (
      new.user_id,
      new.user_id,
      'specialist-' || substr(replace(new.user_id::text, '-', ''), 1, 12),
      new.display_name,
      case when new.status = 'active' then 'active' else 'inactive' end,
      new.status = 'active',
      8,
      '#6f4aa1',
      100,
      false
    ) on conflict (id) do update set
      auth_user_id = excluded.auth_user_id,
      display_name = excluded.display_name,
      status = excluded.status,
      public_booking_enabled = excluded.public_booking_enabled,
      updated_at = now();

    new.specialist_id := new.user_id;
    insert into public.admin_specialist_services (specialist_id, service_slug)
    select new.user_id, service.slug from public.admin_services service
    on conflict do nothing;

    if new.status <> 'active' then
      update public.public_booking_holds
      set status = 'expired'
      where specialist_id = new.user_id and status = 'active';
    end if;
  else
    if new.specialist_id is not null then
      update public.admin_specialists
      set status = 'inactive', public_booking_enabled = false, updated_at = now()
      where id = new.specialist_id;
    end if;
    new.specialist_id := null;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_specialist_profile on public.admin_profiles;
create trigger sync_specialist_profile
before insert or update of role, status, display_name on public.admin_profiles
for each row execute function public.admin_sync_specialist_profile();

-- Bring any existing specialist profiles into the new model.
update public.admin_profiles
set display_name = display_name
where role::text = 'specialist';

create index if not exists admin_appointments_specialist_schedule_idx
  on public.admin_appointments (specialist_id, starts_on, starts_at);
create index if not exists admin_calendar_blocks_specialist_schedule_idx
  on public.admin_calendar_blocks (specialist_id, block_date, starts_at, ends_at);
create index if not exists public_booking_holds_specialist_schedule_idx
  on public.public_booking_holds (specialist_id, starts_on, starts_at, status, expires_at);

alter table public.admin_appointments
  drop constraint if exists admin_appointments_active_schedule_excl;
alter table public.admin_appointments
  add constraint admin_appointments_active_schedule_excl
  exclude using gist (
    specialist_id with =,
    tsrange(
      starts_on + starts_at,
      starts_on + starts_at + make_interval(mins => duration_minutes),
      '[)'
    ) with &&
  )
  where (
    status in ('confirmed', 'pending', 'request')
    and not overlap_override
  );

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
    ) then
      raise exception using errcode = '23514', message = 'public_appointment_immutable';
    end if;

    if new.origin is distinct from old.origin then
      raise exception using errcode = '23514', message = 'appointment_origin_immutable';
    end if;
  else
    first_lock_date := new.starts_on;
    second_lock_date := new.starts_on;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public-booking:' || first_lock_date::text, 0));
  if second_lock_date <> first_lock_date then
    perform pg_advisory_xact_lock(hashtextextended('public-booking:' || second_lock_date::text, 0));
  end if;

  slot_range := tsrange(
    new.starts_on + new.starts_at,
    new.starts_on + new.starts_at + make_interval(mins => new.duration_minutes + new.buffer_minutes),
    '[)'
  );

  if new.status in ('confirmed', 'pending', 'request') and exists (
    select 1
    from public.admin_calendar_blocks block
    where block.specialist_id = new.specialist_id
      and block.block_date = new.starts_on
      and slot_range && tsrange(block.block_date + block.starts_at, block.block_date + block.ends_at, '[)')
  ) then
    raise exception using errcode = '23P01', message = 'appointment_calendar_block_conflict';
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
      and (not old.overlap_override or new.overlap_override_reason is distinct from old.overlap_override_reason);
  end if;

  if override_changed then
    if not public.admin_can_manage_operations()
      and current_user not in ('postgres', 'service_role', 'supabase_admin') then
      raise exception using errcode = '42501', message = 'appointment_overlap_forbidden';
    end if;
    if btrim(new.overlap_override_reason) = '' then
      raise exception using errcode = '23514', message = 'appointment_overlap_reason_required';
    end if;
    new.overlap_overridden_at := now();
    new.overlap_overridden_by := coalesce(auth.uid(), new.overlap_overridden_by);
  elsif not new.overlap_override then
    new.overlap_override_reason := '';
    new.overlap_overridden_at := null;
    new.overlap_overridden_by := null;
  end if;

  if btrim(new.post_visit_comment) <> ''
    and (tg_op = 'INSERT' or new.post_visit_comment is distinct from old.post_visit_comment) then
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
    or requested_starts_on is null
    or requested_starts_at is null
    or requested_duration_minutes <= 0
    or requested_buffer_minutes < 0
    or requested_specialist_id is null
    or requested_status not in ('confirmed', 'pending', 'request', 'cancelled', 'completed', 'no_show')
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
      client_id = p_record ->> 'client_id',
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
      appointment_id, p_record ->> 'client_id', p_record ->> 'client_name_snapshot',
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

create or replace function public.admin_mutate_specialist_calendar_block(
  p_action text,
  p_block_id uuid,
  p_block_date date,
  p_starts_at time without time zone,
  p_ends_at time without time zone,
  p_kind text,
  p_internal_note text,
  p_actor_user_id uuid,
  p_specialist_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  actor_role text;
  actor_specialist_id uuid;
  audit_action text;
  block_exists boolean;
  block_id uuid;
  block_range tsrange;
  existing_block public.admin_calendar_blocks%rowtype;
  observed_block_date date;
  requested_specialist_id uuid;
  saved_block public.admin_calendar_blocks%rowtype;
begin
  select profile.role::text, profile.specialist_id into actor_role, actor_specialist_id
  from public.admin_profiles profile
  where profile.user_id = p_actor_user_id
    and profile.status = 'active'
    and profile.role::text in ('owner', 'administrator', 'specialist');

  if not found or p_action not in ('upsert', 'delete') then
    raise exception using errcode = '42501', message = 'calendar_block_forbidden';
  end if;

  if p_action = 'delete' then
    if p_block_id is null or p_expected_version is null or p_expected_version <= 0 then
      raise exception using errcode = '22023', message = 'invalid_calendar_block';
    end if;
    select block_date into observed_block_date from public.admin_calendar_blocks where id = p_block_id;
    if not found then raise exception using errcode = 'P0002', message = 'calendar_block_not_found'; end if;
    perform pg_advisory_xact_lock(hashtextextended('public-booking:' || observed_block_date::text, 0));
    select * into existing_block from public.admin_calendar_blocks where id = p_block_id for update;
    if not found or existing_block.version <> p_expected_version then
      raise exception using errcode = 'P0001', message = 'calendar_block_concurrent_update';
    end if;
    if actor_role = 'specialist' and existing_block.specialist_id <> actor_specialist_id then
      raise exception using errcode = '42501', message = 'calendar_block_forbidden';
    end if;
    delete from public.admin_calendar_blocks where id = p_block_id;
    insert into public.admin_audit_log (actor_user_id, action, entity_table, entity_id, metadata)
    values (
      p_actor_user_id, 'calendar_block.delete', 'admin_calendar_blocks', p_block_id::text,
      jsonb_build_object(
        'block_date', existing_block.block_date,
        'starts_at', existing_block.starts_at,
        'ends_at', existing_block.ends_at,
        'kind', existing_block.kind,
        'specialist_id', existing_block.specialist_id,
        'version', existing_block.version
      )
    );
    return jsonb_build_object('deleted', true, 'id', p_block_id);
  end if;

  if p_block_date is null or p_starts_at is null or p_ends_at is null
    or p_starts_at >= p_ends_at or p_kind not in ('personal', 'unavailable', 'other')
    or char_length(coalesce(p_internal_note, '')) > 2000 then
    raise exception using errcode = '22023', message = 'invalid_calendar_block';
  end if;

  block_id := coalesce(p_block_id, gen_random_uuid());
  select * into existing_block from public.admin_calendar_blocks where id = block_id;
  block_exists := found;
  requested_specialist_id := coalesce(
    p_specialist_id,
    case when block_exists then existing_block.specialist_id end,
    actor_specialist_id,
    (select specialist.id from public.admin_specialists specialist where specialist.is_default limit 1)
  );

  if requested_specialist_id is null or not exists (
    select 1 from public.admin_specialists specialist
    where specialist.id = requested_specialist_id and specialist.status = 'active'
  ) then
    raise exception using errcode = '22023', message = 'invalid_calendar_block';
  end if;
  if actor_role = 'specialist' and (
    actor_specialist_id is null
    or requested_specialist_id <> actor_specialist_id
    or (block_exists and existing_block.specialist_id <> actor_specialist_id)
  ) then
    raise exception using errcode = '42501', message = 'calendar_block_forbidden';
  end if;
  if (block_exists and (p_expected_version is null or p_expected_version <> existing_block.version))
    or (not block_exists and p_expected_version is not null) then
    raise exception using errcode = 'P0001', message = 'calendar_block_concurrent_update';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public-booking:' || p_block_date::text, 0));
  if block_exists then
    select * into existing_block from public.admin_calendar_blocks where id = block_id for update;
    if not found or existing_block.version <> p_expected_version then
      raise exception using errcode = 'P0001', message = 'calendar_block_concurrent_update';
    end if;
  end if;

  block_range := tsrange(p_block_date + p_starts_at, p_block_date + p_ends_at, '[)');
  if exists (
    select 1 from public.admin_appointments appointment
    where appointment.specialist_id = requested_specialist_id
      and appointment.starts_on = p_block_date
      and appointment.status in ('confirmed', 'pending', 'request')
      and block_range && tsrange(
        appointment.starts_on + appointment.starts_at,
        appointment.starts_on + appointment.starts_at + make_interval(mins => appointment.duration_minutes + appointment.buffer_minutes), '[)'
      )
  ) or exists (
    select 1 from public.public_booking_holds hold
    where hold.specialist_id = requested_specialist_id
      and hold.starts_on = p_block_date and hold.status = 'active' and hold.expires_at > now()
      and block_range && tsrange(
        hold.starts_on + hold.starts_at,
        hold.starts_on + hold.starts_at + make_interval(mins => hold.duration_minutes + hold.buffer_minutes), '[)'
      )
  ) or exists (
    select 1 from public.admin_calendar_blocks other_block
    where other_block.id <> block_id
      and other_block.specialist_id = requested_specialist_id
      and other_block.block_date = p_block_date
      and block_range && tsrange(other_block.block_date + other_block.starts_at, other_block.block_date + other_block.ends_at, '[)')
  ) then
    raise exception using errcode = '23P01', message = 'calendar_block_conflict';
  end if;

  audit_action := case when block_exists then 'calendar_block.update' else 'calendar_block.create' end;
  insert into public.admin_calendar_blocks (
    id, specialist_id, block_date, starts_at, ends_at, kind,
    internal_note, created_by, updated_by, version
  ) values (
    block_id, requested_specialist_id, p_block_date, p_starts_at, p_ends_at, p_kind,
    coalesce(p_internal_note, ''), p_actor_user_id, p_actor_user_id, 1
  ) on conflict (id) do update set
    specialist_id = excluded.specialist_id,
    block_date = excluded.block_date,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    kind = excluded.kind,
    internal_note = excluded.internal_note,
    updated_by = p_actor_user_id,
    version = public.admin_calendar_blocks.version + 1
  returning * into saved_block;

  insert into public.admin_audit_log (actor_user_id, action, entity_table, entity_id, metadata)
  values (
    p_actor_user_id, audit_action, 'admin_calendar_blocks', saved_block.id::text,
    jsonb_build_object(
      'block_date', saved_block.block_date,
      'starts_at', saved_block.starts_at,
      'ends_at', saved_block.ends_at,
      'kind', saved_block.kind,
      'specialist_id', saved_block.specialist_id,
      'version', saved_block.version
    )
  );
  return to_jsonb(saved_block);
end;
$$;

create or replace function public.public_booking_specialist_available(
  p_specialist_id uuid,
  p_service_slug text,
  p_starts_on date,
  p_starts_at time without time zone,
  p_duration_minutes integer,
  p_buffer_minutes integer,
  p_excluded_hold_id uuid default null
)
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.admin_specialists specialist
    join public.admin_specialist_services assignment
      on assignment.specialist_id = specialist.id
     and assignment.service_slug = p_service_slug
    where specialist.id = p_specialist_id
      and specialist.status = 'active'
      and specialist.public_booking_enabled
      and (
        (
          select count(*) from public.admin_appointments appointment
          where appointment.specialist_id = specialist.id
            and appointment.starts_on = p_starts_on
            and appointment.status <> 'cancelled'
        ) + (
          select count(*) from public.public_booking_holds hold
          where hold.specialist_id = specialist.id
            and hold.starts_on = p_starts_on
            and hold.status = 'active'
            and hold.expires_at > now()
            and (p_excluded_hold_id is null or hold.id <> p_excluded_hold_id)
        ) < specialist.public_daily_limit
        or exists (
          select 1 from public.public_booking_holds reserved_hold
          where reserved_hold.id = p_excluded_hold_id
            and reserved_hold.specialist_id = specialist.id
            and reserved_hold.status = 'active'
            and reserved_hold.expires_at > now()
        )
      )
      and not exists (
        select 1 from public.admin_calendar_blocks block
        where block.specialist_id = specialist.id
          and block.block_date = p_starts_on
          and tsrange(
            p_starts_on + p_starts_at,
            p_starts_on + p_starts_at + make_interval(mins => p_duration_minutes + p_buffer_minutes), '[)'
          ) && tsrange(block.block_date + block.starts_at, block.block_date + block.ends_at, '[)')
      )
      and not exists (
        select 1 from public.admin_appointments appointment
        where appointment.specialist_id = specialist.id
          and appointment.starts_on = p_starts_on
          and appointment.status in ('confirmed', 'pending', 'request')
          and tsrange(
            p_starts_on + p_starts_at,
            p_starts_on + p_starts_at + make_interval(mins => p_duration_minutes + p_buffer_minutes), '[)'
          ) && tsrange(
            appointment.starts_on + appointment.starts_at,
            appointment.starts_on + appointment.starts_at + make_interval(mins => appointment.duration_minutes + appointment.buffer_minutes), '[)'
          )
      )
      and not exists (
        select 1 from public.public_booking_holds hold
        where hold.specialist_id = specialist.id
          and hold.starts_on = p_starts_on
          and hold.status = 'active'
          and hold.expires_at > now()
          and (p_excluded_hold_id is null or hold.id <> p_excluded_hold_id)
          and tsrange(
            p_starts_on + p_starts_at,
            p_starts_on + p_starts_at + make_interval(mins => p_duration_minutes + p_buffer_minutes), '[)'
          ) && tsrange(
            hold.starts_on + hold.starts_at,
            hold.starts_on + hold.starts_at + make_interval(mins => hold.duration_minutes + hold.buffer_minutes), '[)'
          )
      )
  );
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

  return jsonb_build_object(
    'enabled', true,
    'timezone', settings.timezone,
    'priceVariantId', variant.id,
    'from', p_from,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', candidate.day,
        'capReached', not exists (
          select 1 from public.admin_specialists specialist
          join public.admin_specialist_services assignment
            on assignment.specialist_id = specialist.id and assignment.service_slug = variant.service_slug
          where specialist.status = 'active' and specialist.public_booking_enabled
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
            where public.public_booking_specialist_available(
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

drop function if exists public.public_booking_create_hold(text, text, text, date, time without time zone);
create function public.public_booking_create_hold(
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
      and appointment.starts_on = p_starts_on and appointment.status <> 'cancelled'
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

-- Replace the confirmation body while preserving its public HTTP/RPC contract.
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
  specialist_name text;
begin
  if coalesce(p_token_hash, '') !~ '^[a-f0-9]{64}$'
    or coalesce(p_idempotency_key_hash, '') !~ '^[a-f0-9]{64}$'
    or p_locale not in ('bg', 'ru', 'ua', 'en')
    or p_contact_preference not in ('phone', 'viber', 'telegram', 'email')
    or p_privacy_accepted is not true
    or char_length(btrim(coalesce(p_full_name, ''))) not between 2 and 100
    or coalesce(p_phone_normalized, '') !~ '^[0-9]{7,15}$'
    or regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') <> p_phone_normalized
    or char_length(coalesce(p_phone, '')) not between 7 and 32
    or char_length(coalesce(p_email, '')) > 254
    or (nullif(btrim(coalesce(p_email, '')), '') is not null and p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    or (p_contact_preference = 'email' and nullif(btrim(coalesce(p_email, '')), '') is null)
    or char_length(coalesce(p_public_note, '')) > 1000 then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  select starts_on into observed_starts_on from public.public_booking_holds where token_hash = p_token_hash;
  if not found then raise exception using errcode = 'P0001', message = 'slot_unavailable'; end if;
  perform pg_advisory_xact_lock(hashtextextended('public-booking:' || observed_starts_on::text, 0));
  select * into hold from public.public_booking_holds where token_hash = p_token_hash for update;
  if not found or hold.starts_on is distinct from observed_starts_on then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  select * into appointment from public.admin_appointments
  where public_booking_idempotency_key_hash = p_idempotency_key_hash;
  if found then
    if appointment.public_booking_hold_id <> hold.id then
      raise exception using errcode = '22023', message = 'invalid_request';
    end if;
    select display_name into specialist_name from public.admin_specialists where id = appointment.specialist_id;
    return jsonb_build_object(
      'publicReference', appointment.public_reference, 'status', appointment.status,
      'date', appointment.starts_on, 'time', to_char(appointment.starts_at, 'HH24:MI'),
      'serviceSlug', appointment.service_slug, 'priceVariantId', appointment.price_variant_id,
      'priceCents', appointment.price_cents_snapshot, 'currency', appointment.currency_snapshot,
      'specialistName', specialist_name
    );
  end if;

  if hold.status <> 'active' or hold.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;
  select * into settings from public.admin_site_settings where id = 'site';
  if not found or not settings.public_booking_enabled then
    raise exception using errcode = 'P0001', message = 'booking_unavailable';
  end if;

  update public.public_booking_holds set status = 'expired'
  where status = 'active' and expires_at <= now() and id <> hold.id;

  select price.id, price.service_slug,
    coalesce(nullif(btrim(translation.title), ''), service.name) as service_name
  into variant
  from public.admin_price_variants price
  join public.admin_services service on service.slug = price.service_slug
  join public.admin_specialist_services assignment
    on assignment.specialist_id = hold.specialist_id and assignment.service_slug = service.slug
  left join public.admin_service_translations translation
    on translation.service_slug = service.slug and translation.locale = p_locale and translation.status = 'published'
  where price.id = hold.price_variant_id and price.status = 'active' and service.status = 'published';

  if not found or variant.service_slug <> hold.service_slug
    or not public.public_booking_slot_in_schedule(
      hold.starts_on, hold.starts_at, hold.duration_minutes,
      settings.working_days, settings.working_hours, settings.booking_slot_step_minutes,
      0, settings.booking_horizon_days
    )
    or hold.starts_on + hold.starts_at < (hold.created_at at time zone 'Europe/Sofia')
      + make_interval(mins => settings.booking_min_lead_minutes)
    or not public.public_booking_specialist_available(
      hold.specialist_id, hold.service_slug, hold.starts_on, hold.starts_at,
      hold.duration_minutes, hold.buffer_minutes, hold.id
    ) then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  insert into public.admin_clients (
    id, full_name, phone, phone_normalized, email, locale,
    preferred_contact, status, gdpr_consent
  ) values (
    'client-public-' || gen_random_uuid()::text, btrim(p_full_name), btrim(p_phone),
    p_phone_normalized, nullif(lower(btrim(p_email)), ''), p_locale,
    p_contact_preference, 'new',
    jsonb_build_object('public_booking', jsonb_build_object('accepted', true, 'accepted_at', now()))
  ) on conflict (phone_normalized) do update
  set gdpr_consent = coalesce(public.admin_clients.gdpr_consent, '{}'::jsonb)
    || jsonb_build_object(
      'public_booking', coalesce(public.admin_clients.gdpr_consent -> 'public_booking', '{}'::jsonb)
        || (excluded.gdpr_consent -> 'public_booking')
    )
  returning id into client_id;

  appointment_id := 'appointment-public-' || gen_random_uuid()::text;
  public_reference := 'MMN-' || to_char(hold.starts_on, 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  begin
    insert into public.admin_appointments (
      id, client_id, client_name_snapshot, specialist_id, starts_on, starts_at,
      service_name, status, duration_minutes, buffer_minutes, internal_note,
      public_note, service_slug, price_variant_id, price_cents_snapshot,
      currency_snapshot, origin, locale, public_reference,
      public_booking_idempotency_key_hash, public_booking_hold_id,
      public_phone_snapshot, public_email_snapshot,
      public_contact_preference_snapshot, overlap_override
    ) values (
      appointment_id, client_id, btrim(p_full_name), hold.specialist_id,
      hold.starts_on, hold.starts_at, variant.service_name, 'confirmed',
      hold.duration_minutes, hold.buffer_minutes, '', btrim(coalesce(p_public_note, '')),
      hold.service_slug, hold.price_variant_id, hold.price_cents, hold.currency,
      'public', p_locale, public_reference, p_idempotency_key_hash, hold.id,
      btrim(p_phone), nullif(lower(btrim(p_email)), ''), p_contact_preference, false
    ) returning * into appointment;
  exception
    when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'slot_unavailable';
    when unique_violation then
      select * into appointment from public.admin_appointments
      where public_booking_idempotency_key_hash = p_idempotency_key_hash;
      if not found or appointment.public_booking_hold_id <> hold.id then
        raise exception using errcode = 'P0001', message = 'slot_unavailable';
      end if;
  end;

  update public.public_booking_holds set status = 'confirmed', confirmed_at = now() where id = hold.id;
  insert into public.admin_audit_log (actor_user_id, action, entity_table, entity_id, metadata)
  values (null, 'appointment.public_confirm', 'admin_appointments', appointment.id,
    jsonb_build_object(
      'public_reference', appointment.public_reference,
      'service_slug', appointment.service_slug,
      'price_variant_id', appointment.price_variant_id,
      'specialist_id', appointment.specialist_id,
      'starts_on', appointment.starts_on,
      'starts_at', appointment.starts_at
    ));
  select display_name into specialist_name from public.admin_specialists where id = appointment.specialist_id;
  return jsonb_build_object(
    'publicReference', appointment.public_reference, 'status', appointment.status,
    'date', appointment.starts_on, 'time', to_char(appointment.starts_at, 'HH24:MI'),
    'serviceSlug', appointment.service_slug, 'priceVariantId', appointment.price_variant_id,
    'priceCents', appointment.price_cents_snapshot, 'currency', appointment.currency_snapshot,
    'specialistName', specialist_name
  );
end;
$$;

create table if not exists public.admin_security_alerts (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  alert_type text not null,
  severity text not null check (severity in ('warning', 'critical')),
  metadata jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.admin_mark_login(p_actor_user_id uuid)
returns void
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
begin
  update public.admin_profiles
  set last_login_at = now(), updated_at = now()
  where user_id = p_actor_user_id and status = 'active';
  if not found then raise exception using errcode = '42501', message = 'login_forbidden'; end if;

  insert into public.admin_audit_log (actor_user_id, action, entity_table, entity_id, metadata)
  values (p_actor_user_id, 'auth.login', 'admin_profiles', p_actor_user_id::text, '{}'::jsonb);
end;
$$;

create index if not exists admin_security_alerts_open_idx
  on public.admin_security_alerts (created_at desc)
  where resolved_at is null;

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

  if actor_role = 'specialist' and (
    actor_specialist_id is null
    or appointment.specialist_id <> actor_specialist_id
    or appointment.starts_on + appointment.starts_at < (now() at time zone 'Europe/Sofia') - interval '48 hours'
  ) then
    raise exception using errcode = '42501', message = 'contact_reveal_forbidden';
  end if;

  select count(*) into recent_reveals from public.admin_audit_log audit
  where audit.actor_user_id = p_actor_user_id
    and audit.action = 'client.contact.reveal'
    and audit.created_at >= now() - interval '10 minutes';
  if recent_reveals >= 60 then
    raise exception using errcode = 'P0001', message = 'contact_reveal_rate_limited';
  end if;

  if recent_reveals >= 20 and not exists (
    select 1 from public.admin_security_alerts alert
    where alert.actor_user_id = p_actor_user_id
      and alert.alert_type = 'bulk_contact_reveal'
      and alert.created_at >= now() - interval '10 minutes'
  ) then
    insert into public.admin_security_alerts (actor_user_id, alert_type, severity, metadata)
    values (p_actor_user_id, 'bulk_contact_reveal', 'warning', jsonb_build_object('window_minutes', 10));
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

-- The app uses the service role for scoped reads. Authenticated users must not bypass it.
revoke select on table public.admin_clients from authenticated;
revoke select on table public.admin_appointments from authenticated;
revoke select on table public.admin_certificates from authenticated;
revoke select on table public.admin_calendar_blocks from authenticated;
revoke all on table public.admin_specialists from anon, authenticated;
revoke all on table public.admin_specialist_services from anon, authenticated;
revoke all on table public.admin_security_alerts from anon, authenticated;

revoke all on function public.public_booking_specialist_available(uuid, text, date, time without time zone, integer, integer, uuid)
  from public, anon, authenticated;
revoke all on function public.public_booking_get_availability(text, date, integer)
  from public, anon, authenticated;
revoke all on function public.public_booking_create_hold(text, text, text, date, time without time zone)
  from public, anon, authenticated;
revoke all on function public.public_booking_confirm(text, text, text, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.admin_reveal_appointment_contact(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.admin_mark_login(uuid) from public, anon, authenticated;
revoke execute on function public.admin_mutate_calendar_block(
  text, uuid, date, time without time zone, time without time zone, text, text, uuid, integer
) from service_role;
revoke all on function public.admin_mutate_specialist_calendar_block(
  text, uuid, date, time without time zone, time without time zone, text, text, uuid, uuid, integer
) from public, anon, authenticated;

grant execute on function public.public_booking_get_availability(text, date, integer) to service_role;
grant execute on function public.public_booking_specialist_available(
  uuid, text, date, time without time zone, integer, integer, uuid
) to service_role;
grant execute on function public.public_booking_create_hold(text, text, text, date, time without time zone) to service_role;
grant execute on function public.public_booking_confirm(text, text, text, text, text, text, text, text, text, boolean) to service_role;
grant execute on function public.admin_reveal_appointment_contact(uuid, text, text) to service_role;
grant execute on function public.admin_mark_login(uuid) to service_role;
grant execute on function public.admin_mutate_specialist_calendar_block(
  text, uuid, date, time without time zone, time without time zone, text, text, uuid, uuid, integer
) to service_role;

comment on table public.admin_specialists is
  'Business specialist identities used for isolated calendars and public booking assignment.';
comment on function public.admin_reveal_appointment_contact(uuid, text, text) is
  'Audited, rate-limited contact reveal for the assigned appointment.';
