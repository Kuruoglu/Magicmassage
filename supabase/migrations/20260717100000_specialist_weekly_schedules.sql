-- Store one complete weekly schedule per specialist while retaining the global
-- booking settings as a permissive compatibility envelope.

alter table public.admin_specialists
  add column if not exists weekly_schedule jsonb;

create or replace function public.admin_specialist_weekly_schedule_is_valid(
  p_schedule jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  day jsonb;
  seen_weekdays integer[] := '{}'::integer[];
  weekday integer;
  starts_at text;
  ends_at text;
begin
  if p_schedule is null
    or jsonb_typeof(p_schedule) <> 'array'
    or jsonb_array_length(p_schedule) <> 7 then
    return false;
  end if;

  for day in select value from jsonb_array_elements(p_schedule)
  loop
    if jsonb_typeof(day) <> 'object' then
      return false;
    end if;

    if (select count(*) from jsonb_object_keys(day)) <> 4
      or not day ?& array['weekday', 'isWorking', 'startsAt', 'endsAt']
      or jsonb_typeof(day -> 'weekday') <> 'number'
      or coalesce(day ->> 'weekday', '') !~ '^[1-7]$'
      or jsonb_typeof(day -> 'isWorking') <> 'boolean'
      or coalesce(day ->> 'startsAt', '') !~ '^([01][0-9]|2[0-3]):(00|30)$'
      or coalesce(day ->> 'endsAt', '') !~ '^([01][0-9]|2[0-3]):(00|30)$' then
      return false;
    end if;

    weekday := (day ->> 'weekday')::integer;
    starts_at := day ->> 'startsAt';
    ends_at := day ->> 'endsAt';

    if weekday = any(seen_weekdays) or starts_at >= ends_at then
      return false;
    end if;

    seen_weekdays := array_append(seen_weekdays, weekday);
  end loop;

  select array_agg(value order by value)
  into seen_weekdays
  from unnest(seen_weekdays) value;

  return seen_weekdays = array[1, 2, 3, 4, 5, 6, 7];
end;
$$;

create or replace function public.admin_build_specialist_weekly_schedule(
  p_working_days text,
  p_working_hours text
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  schedule jsonb;
  working_window int4range := public.public_booking_working_minutes(p_working_hours);
  starts_at text;
  ends_at text;
begin
  if working_window is null then
    raise exception using errcode = '22023', message = 'invalid_specialist_schedule_source';
  end if;

  starts_at := lpad((lower(working_window) / 60)::text, 2, '0')
    || ':' || lpad((lower(working_window) % 60)::text, 2, '0');
  ends_at := lpad((upper(working_window) / 60)::text, 2, '0')
    || ':' || lpad((upper(working_window) % 60)::text, 2, '0');

  select jsonb_agg(
    jsonb_build_object(
      'weekday', weekday,
      'isWorking', public.public_booking_day_is_open(
        date '2024-01-01' + (weekday - 1),
        p_working_days
      ),
      'startsAt', starts_at,
      'endsAt', ends_at
    ) order by weekday
  )
  into schedule
  from generate_series(1, 7) weekday;

  return schedule;
end;
$$;

do $$
begin
  if not exists (
    select 1 from public.admin_site_settings where id = 'site'
  ) then
    raise exception using errcode = 'P0001', message = 'specialist_schedule_settings_missing';
  end if;
end;
$$;

update public.admin_specialists specialist
set weekly_schedule = public.admin_build_specialist_weekly_schedule(
  settings.working_days,
  settings.working_hours
)
from public.admin_site_settings settings
where settings.id = 'site'
  and specialist.weekly_schedule is null;

alter table public.admin_specialists
  alter column weekly_schedule set not null;

alter table public.admin_specialists
  drop constraint if exists admin_specialists_weekly_schedule_valid;
alter table public.admin_specialists
  add constraint admin_specialists_weekly_schedule_valid
  check (public.admin_specialist_weekly_schedule_is_valid(weekly_schedule));

create or replace function public.admin_initialize_specialist_weekly_schedule()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.weekly_schedule is null then
    select public.admin_build_specialist_weekly_schedule(
      settings.working_days,
      settings.working_hours
    )
    into new.weekly_schedule
    from public.admin_site_settings settings
    where settings.id = 'site';
  end if;

  if new.weekly_schedule is null then
    raise exception using errcode = 'P0001', message = 'specialist_schedule_settings_missing';
  end if;

  return new;
end;
$$;

drop trigger if exists initialize_specialist_weekly_schedule on public.admin_specialists;
create trigger initialize_specialist_weekly_schedule
before insert on public.admin_specialists
for each row execute function public.admin_initialize_specialist_weekly_schedule();

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
      and exists (
        select 1
        from jsonb_array_elements(specialist.weekly_schedule) schedule_day
        where (schedule_day ->> 'weekday')::integer = extract(isodow from p_starts_on)::integer
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
      )
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

create or replace function public.public_booking_restore_session_hold_v5(
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
  where hold_row.session_key_hash = p_session_key_hash
    and hold_row.status = 'active'
  for update;

  if not found then return null; end if;

  if not public.public_booking_specialist_available(
    hold.specialist_id,
    hold.service_slug,
    hold.starts_on,
    hold.starts_at,
    hold.duration_minutes,
    hold.buffer_minutes,
    hold.id
  ) then
    update public.public_booking_holds
    set status = 'expired'
    where id = hold.id;
    return null;
  end if;

  select specialist.display_name into specialist_name
  from public.admin_specialists specialist
  where specialist.id = hold.specialist_id;

  return result || jsonb_build_object(
    'specialistId', hold.specialist_id,
    'specialistName', specialist_name
  );
end;
$$;

create or replace function public.admin_save_specialist_schedule(
  p_actor_user_id uuid,
  p_specialist_id uuid,
  p_weekly_schedule jsonb
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
  union_working_days text;
  envelope_starts_at text;
  envelope_ends_at text;
  envelope_working_hours text;
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
    or not public.admin_specialist_weekly_schedule_is_valid(p_weekly_schedule) then
    raise exception using errcode = '22023', message = 'invalid_specialist_schedule';
  end if;

  select * into settings
  from public.admin_site_settings
  where id = 'site'
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'specialist_schedule_settings_missing';
  end if;

  select * into current_specialist
  from public.admin_specialists
  where id = p_specialist_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'specialist_not_found';
  end if;

  update public.admin_specialists
  set weekly_schedule = p_weekly_schedule,
      updated_at = now()
  where id = p_specialist_id
  returning * into saved_specialist;

  select string_agg(
    case union_day.weekday
      when 1 then 'Mon' when 2 then 'Tue' when 3 then 'Wed'
      when 4 then 'Thu' when 5 then 'Fri' when 6 then 'Sat'
      when 7 then 'Sun'
    end,
    ',' order by union_day.weekday
  )
  into union_working_days
  from (
    select distinct (schedule_day ->> 'weekday')::integer as weekday
    from public.admin_specialists specialist
    cross join lateral jsonb_array_elements(specialist.weekly_schedule) schedule_day
    where specialist.status = 'active'
      and specialist.public_booking_enabled
      and (schedule_day ->> 'isWorking')::boolean
  ) union_day;

  select
    min(schedule_day ->> 'startsAt'),
    max(schedule_day ->> 'endsAt')
  into envelope_starts_at, envelope_ends_at
  from public.admin_specialists specialist
  cross join lateral jsonb_array_elements(specialist.weekly_schedule) schedule_day
  where specialist.status = 'active'
    and specialist.public_booking_enabled
    and (schedule_day ->> 'isWorking')::boolean;

  envelope_working_hours := case
    when envelope_starts_at is null or envelope_ends_at is null then settings.working_hours
    else envelope_starts_at || '-' || envelope_ends_at
  end;

  update public.admin_site_settings
  set working_days = coalesce(union_working_days, ''),
      working_hours = envelope_working_hours,
      updated_on = current_date,
      updated_at = now()
  where id = 'site';

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
      'weekly_schedule', saved_specialist.weekly_schedule,
      'working_days', coalesce(union_working_days, ''),
      'working_hours', envelope_working_hours
    )
  );

  return jsonb_build_object(
    'specialist', jsonb_build_object(
      'id', saved_specialist.id,
      'weekly_schedule', saved_specialist.weekly_schedule
    ),
    'working_days', coalesce(union_working_days, ''),
    'working_hours', envelope_working_hours
  );
end;
$$;

revoke all on function public.admin_specialist_weekly_schedule_is_valid(jsonb)
  from public, anon, authenticated;
revoke all on function public.admin_build_specialist_weekly_schedule(text, text)
  from public, anon, authenticated;
revoke all on function public.admin_initialize_specialist_weekly_schedule()
  from public, anon, authenticated;
revoke all on function public.public_booking_specialist_available(
  uuid, text, date, time without time zone, integer, integer, uuid
) from public, anon, authenticated;
revoke all on function public.public_booking_restore_session_hold_v5(text, text)
  from public, anon, authenticated;
revoke all on function public.admin_save_specialist_schedule(uuid, uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.admin_specialist_weekly_schedule_is_valid(jsonb)
  to service_role;
grant execute on function public.admin_build_specialist_weekly_schedule(text, text)
  to service_role;
grant execute on function public.admin_initialize_specialist_weekly_schedule()
  to service_role;
grant execute on function public.public_booking_specialist_available(
  uuid, text, date, time without time zone, integer, integer, uuid
) to service_role;
grant execute on function public.public_booking_restore_session_hold_v5(text, text)
  to service_role;
grant execute on function public.admin_save_specialist_schedule(uuid, uuid, jsonb)
  to service_role;

comment on column public.admin_specialists.weekly_schedule is
  'Seven ISO weekdays with per-specialist public booking windows.';
comment on function public.admin_save_specialist_schedule(uuid, uuid, jsonb) is
  'Owner/administrator-only audited weekly schedule save with global compatibility-envelope recomputation.';
