-- A stale admin draft is a domain conflict, not a serialization failure. Using
-- 40001 causes infrastructure retries before the API can return HTTP 409.

create or replace function public.admin_save_specialist_schedule_v2(
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

comment on function public.admin_save_specialist_schedule_v2(uuid, uuid, jsonb, integer) is
  'Audited owner/admin schedule save with immediate stale-draft conflicts and booking serialization.';
