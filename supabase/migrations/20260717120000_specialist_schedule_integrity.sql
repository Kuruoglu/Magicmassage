-- Keep specialist schedules authoritative across settings saves, public holds,
-- confirmations, and concurrent admin sessions.

alter table public.admin_specialists
  add column if not exists schedule_version integer not null default 1;

alter table public.admin_specialists
  drop constraint if exists admin_specialists_schedule_version_check;
alter table public.admin_specialists
  add constraint admin_specialists_schedule_version_check
  check (schedule_version > 0);

create or replace function public.admin_get_specialist_schedule_envelope()
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $$
  with working_schedule as (
    select
      (schedule_day ->> 'weekday')::integer as weekday,
      schedule_day ->> 'startsAt' as starts_at,
      schedule_day ->> 'endsAt' as ends_at
    from public.admin_specialists specialist
    cross join lateral jsonb_array_elements(specialist.weekly_schedule) schedule_day
    where specialist.status = 'active'
      and specialist.public_booking_enabled
      and (schedule_day ->> 'isWorking')::boolean
  ), envelope as (
    select
      (
        select string_agg(
          case weekday
            when 1 then 'Mon' when 2 then 'Tue' when 3 then 'Wed'
            when 4 then 'Thu' when 5 then 'Fri' when 6 then 'Sat'
            when 7 then 'Sun'
          end,
          ',' order by weekday
        )
        from (select distinct weekday from working_schedule) weekdays
      ) as working_days,
      min(starts_at) as starts_at,
      max(ends_at) as ends_at
    from working_schedule
  )
  select jsonb_build_object(
    'working_days', coalesce(envelope.working_days, ''),
    'working_hours', coalesce(
      envelope.starts_at || '-' || envelope.ends_at,
      (select settings.working_hours from public.admin_site_settings settings where settings.id = 'site'),
      '00:00-00:30'
    )
  )
  from envelope;
$$;

create or replace function public.admin_apply_specialist_schedule_envelope()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  envelope jsonb;
begin
  if new.id <> 'site' then return new; end if;

  perform pg_advisory_xact_lock(hashtextextended('specialist-schedule-envelope', 0));
  envelope := public.admin_get_specialist_schedule_envelope();
  new.working_days := envelope ->> 'working_days';
  new.working_hours := envelope ->> 'working_hours';
  return new;
end;
$$;

drop trigger if exists apply_specialist_schedule_envelope on public.admin_site_settings;
create trigger apply_specialist_schedule_envelope
before update of working_days, working_hours on public.admin_site_settings
for each row execute function public.admin_apply_specialist_schedule_envelope();

create or replace function public.admin_recompute_specialist_schedule_envelope()
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  envelope jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('specialist-schedule-envelope', 0));
  envelope := public.admin_get_specialist_schedule_envelope();

  update public.admin_site_settings
  set working_days = envelope ->> 'working_days',
      working_hours = envelope ->> 'working_hours',
      updated_on = current_date,
      updated_at = now()
  where id = 'site'
    and (
      working_days is distinct from envelope ->> 'working_days'
      or working_hours is distinct from envelope ->> 'working_hours'
    );

  return envelope;
end;
$$;

create or replace function public.admin_sync_specialist_schedule_envelope()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  perform public.admin_recompute_specialist_schedule_envelope();
  return new;
end;
$$;

drop trigger if exists sync_specialist_schedule_envelope_on_insert on public.admin_specialists;
create trigger sync_specialist_schedule_envelope_on_insert
after insert on public.admin_specialists
for each row execute function public.admin_sync_specialist_schedule_envelope();

drop trigger if exists sync_specialist_schedule_envelope_on_update on public.admin_specialists;
create trigger sync_specialist_schedule_envelope_on_update
after update of weekly_schedule, status, public_booking_enabled on public.admin_specialists
for each row
when (
  old.weekly_schedule is distinct from new.weekly_schedule
  or old.status is distinct from new.status
  or old.public_booking_enabled is distinct from new.public_booking_enabled
)
execute function public.admin_sync_specialist_schedule_envelope();

select public.admin_recompute_specialist_schedule_envelope();

create or replace function public.admin_specialist_schedule_contains(
  p_specialist_id uuid,
  p_starts_on date,
  p_starts_at time without time zone,
  p_duration_minutes integer
)
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.admin_specialists specialist
    cross join lateral jsonb_array_elements(specialist.weekly_schedule) schedule_day
    where specialist.id = p_specialist_id
      and specialist.status = 'active'
      and specialist.public_booking_enabled
      and (schedule_day ->> 'weekday')::integer = extract(isodow from p_starts_on)::integer
      and (schedule_day ->> 'isWorking')::boolean
      and (
        extract(hour from p_starts_at)::integer * 60
        + extract(minute from p_starts_at)::integer
      ) >= (
        split_part(schedule_day ->> 'startsAt', ':', 1)::integer * 60
        + split_part(schedule_day ->> 'startsAt', ':', 2)::integer
      )
      and (
        extract(hour from p_starts_at)::integer * 60
        + extract(minute from p_starts_at)::integer
        + p_duration_minutes
      ) <= (
        split_part(schedule_day ->> 'endsAt', ':', 1)::integer * 60
        + split_part(schedule_day ->> 'endsAt', ':', 2)::integer
      )
  );
$$;

create or replace function public.admin_guard_public_booking_hold_schedule()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status <> 'active' then return new; end if;

  perform pg_advisory_xact_lock(
    hashtextextended('specialist-schedule:' || new.specialist_id::text, 0)
  );

  if not public.admin_specialist_schedule_contains(
    new.specialist_id,
    new.starts_on,
    new.starts_at,
    new.duration_minutes
  ) then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_public_booking_hold_schedule on public.public_booking_holds;
create trigger guard_public_booking_hold_schedule
before insert or update on public.public_booking_holds
for each row execute function public.admin_guard_public_booking_hold_schedule();

create or replace function public.admin_guard_public_appointment_schedule()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.origin <> 'public' then return new; end if;

  perform pg_advisory_xact_lock(
    hashtextextended('specialist-schedule:' || new.specialist_id::text, 0)
  );

  if not public.admin_specialist_schedule_contains(
    new.specialist_id,
    new.starts_on,
    new.starts_at,
    new.duration_minutes
  ) then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_public_appointment_schedule on public.admin_appointments;
create trigger guard_public_appointment_schedule
before insert on public.admin_appointments
for each row execute function public.admin_guard_public_appointment_schedule();

revoke all on function public.admin_save_specialist_schedule(uuid, uuid, jsonb)
  from service_role;

create function public.admin_save_specialist_schedule_v2(
  p_actor_user_id uuid,
  p_specialist_id uuid,
  p_weekly_schedule jsonb,
  p_expected_version integer
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  current_specialist public.admin_specialists%rowtype;
  saved_specialist public.admin_specialists%rowtype;
  settings public.admin_site_settings%rowtype;
begin
  if p_actor_user_id is null or not exists (
    select 1
    from public.admin_profiles profile
    where profile.user_id = p_actor_user_id
      and profile.status = 'active'
      and profile.role::text in ('owner', 'administrator')
  ) then
    raise exception using errcode = '42501', message = 'specialist_schedule_forbidden';
  end if;

  if p_specialist_id is null
    or p_expected_version is null
    or p_expected_version < 1
    or not public.admin_specialist_weekly_schedule_is_valid(p_weekly_schedule) then
    raise exception using errcode = '22023', message = 'invalid_specialist_schedule';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('specialist-schedule:' || p_specialist_id::text, 0)
  );

  select * into current_specialist
  from public.admin_specialists
  where id = p_specialist_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'specialist_not_found';
  end if;
  if current_specialist.schedule_version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'stale_specialist_schedule';
  end if;

  update public.admin_specialists
  set weekly_schedule = p_weekly_schedule,
      schedule_version = schedule_version + 1,
      updated_at = now()
  where id = p_specialist_id
  returning * into saved_specialist;

  select * into settings
  from public.admin_site_settings
  where id = 'site';

  if not found then
    raise exception using errcode = 'P0001', message = 'specialist_schedule_settings_missing';
  end if;

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    p_actor_user_id,
    'specialist.schedule.update',
    'admin_specialists',
    saved_specialist.id::text,
    jsonb_build_object(
      'previous_schedule', current_specialist.weekly_schedule,
      'previous_version', current_specialist.schedule_version,
      'weekly_schedule', saved_specialist.weekly_schedule,
      'schedule_version', saved_specialist.schedule_version,
      'working_days', settings.working_days,
      'working_hours', settings.working_hours
    )
  );

  return jsonb_build_object(
    'specialist', jsonb_build_object(
      'id', saved_specialist.id,
      'schedule_version', saved_specialist.schedule_version,
      'weekly_schedule', saved_specialist.weekly_schedule
    ),
    'working_days', settings.working_days,
    'working_hours', settings.working_hours
  );
end;
$$;

revoke all on function public.admin_get_specialist_schedule_envelope()
  from public, anon, authenticated;
revoke all on function public.admin_apply_specialist_schedule_envelope()
  from public, anon, authenticated;
revoke all on function public.admin_recompute_specialist_schedule_envelope()
  from public, anon, authenticated;
revoke all on function public.admin_sync_specialist_schedule_envelope()
  from public, anon, authenticated;
revoke all on function public.admin_specialist_schedule_contains(
  uuid, date, time without time zone, integer
) from public, anon, authenticated;
revoke all on function public.admin_guard_public_booking_hold_schedule()
  from public, anon, authenticated;
revoke all on function public.admin_guard_public_appointment_schedule()
  from public, anon, authenticated;
revoke all on function public.admin_save_specialist_schedule_v2(uuid, uuid, jsonb, integer)
  from public, anon, authenticated;

grant execute on function public.admin_get_specialist_schedule_envelope()
  to service_role;
grant execute on function public.admin_recompute_specialist_schedule_envelope()
  to service_role;
grant execute on function public.admin_specialist_schedule_contains(
  uuid, date, time without time zone, integer
) to service_role;
grant execute on function public.admin_save_specialist_schedule_v2(uuid, uuid, jsonb, integer)
  to service_role;

comment on column public.admin_specialists.schedule_version is
  'Optimistic concurrency token for complete weekly schedule updates.';
comment on function public.admin_save_specialist_schedule_v2(uuid, uuid, jsonb, integer) is
  'Audited owner/admin schedule save with stale-write detection and booking serialization.';
