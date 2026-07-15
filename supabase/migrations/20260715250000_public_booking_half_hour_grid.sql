-- Public starts use a fixed half-hour grid. The same-day lead is reduced from
-- four hours to 30 minutes so the next practical slot remains bookable.

alter table public.admin_site_settings
  drop constraint if exists admin_site_settings_booking_slot_step_minutes_check,
  drop constraint if exists admin_site_settings_booking_min_lead_minutes_check;

alter table public.admin_site_settings
  alter column booking_slot_step_minutes set default 30,
  alter column booking_min_lead_minutes set default 30;

update public.admin_site_settings
set
  booking_slot_step_minutes = 30,
  booking_min_lead_minutes = 30
where id = 'site';

alter table public.admin_site_settings
  add constraint admin_site_settings_booking_slot_step_minutes_check
    check (booking_slot_step_minutes = 30),
  add constraint admin_site_settings_booking_min_lead_minutes_check
    check (booking_min_lead_minutes = 30);

create or replace function public.public_booking_slot_in_schedule(
  p_starts_on date,
  p_starts_at time without time zone,
  p_duration_minutes integer,
  p_working_days text,
  p_working_hours text,
  p_slot_step_minutes integer,
  p_min_lead_minutes integer,
  p_horizon_days integer
)
returns boolean
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  local_now timestamp without time zone := now() at time zone 'Europe/Sofia';
  local_today date := (now() at time zone 'Europe/Sofia')::date;
  start_minutes integer := extract(hour from p_starts_at)::integer * 60
    + extract(minute from p_starts_at)::integer;
  working_window int4range := public.public_booking_working_minutes(p_working_hours);
begin
  return p_duration_minutes > 0
    and p_slot_step_minutes = 30
    and p_starts_on between local_today and local_today + p_horizon_days
    and public.public_booking_day_is_open(p_starts_on, p_working_days)
    and working_window is not null
    and start_minutes % p_slot_step_minutes = 0
    and start_minutes >= lower(working_window)
    and start_minutes + p_duration_minutes <= upper(working_window)
    and p_starts_on + p_starts_at >= local_now + make_interval(mins => p_min_lead_minutes);
end;
$$;

create or replace function public.admin_save_booking_settings_with_audit(
  p_actor_user_id uuid,
  p_settings jsonb
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  allowed_keys constant text[] := array[
    'id',
    'audit_log_retention_days',
    'booking_buffer_minutes',
    'business_name',
    'cookie_privacy_mode',
    'currency',
    'daily_slot_capacity',
    'default_locale',
    'default_seo_title',
    'email_sender',
    'google_calendar_id',
    'google_calendar_mode',
    'gift_certificates_enabled',
    'reminder_template',
    'roles_policy',
    'stripe_mode',
    'timezone',
    'updated_on',
    'working_days',
    'working_hours',
    'public_booking_enabled',
    'public_booking_daily_limit',
    'booking_slot_step_minutes',
    'booking_min_lead_minutes',
    'booking_horizon_days',
    'booking_hold_minutes'
  ];
  string_keys constant text[] := array[
    'id',
    'business_name',
    'cookie_privacy_mode',
    'currency',
    'default_locale',
    'default_seo_title',
    'email_sender',
    'google_calendar_id',
    'google_calendar_mode',
    'reminder_template',
    'roles_policy',
    'stripe_mode',
    'timezone',
    'updated_on',
    'working_days',
    'working_hours'
  ];
  integer_keys constant text[] := array[
    'audit_log_retention_days',
    'booking_buffer_minutes',
    'daily_slot_capacity',
    'public_booking_daily_limit',
    'booking_slot_step_minutes',
    'booking_min_lead_minutes',
    'booking_horizon_days',
    'booking_hold_minutes'
  ];
  setting_key text;
  saved_settings public.admin_site_settings%rowtype;
begin
  if p_actor_user_id is null
    or not exists (
      select 1
      from public.admin_profiles profile
      where profile.user_id = p_actor_user_id
        and profile.status = 'active'
        and profile.role::text in ('owner', 'administrator')
    ) then
    raise exception using errcode = '42501', message = 'booking_settings_forbidden';
  end if;

  if p_settings is null
    or jsonb_typeof(p_settings) <> 'object'
    or not (p_settings ?& allowed_keys)
    or exists (
      select 1
      from jsonb_object_keys(p_settings) as supplied(supplied_key)
      where not (supplied_key = any(allowed_keys))
    ) then
    raise exception using errcode = '22023', message = 'invalid_booking_settings';
  end if;

  foreach setting_key in array string_keys
  loop
    if jsonb_typeof(p_settings -> setting_key) <> 'string' then
      raise exception using errcode = '22023', message = 'invalid_booking_settings';
    end if;
  end loop;

  foreach setting_key in array integer_keys
  loop
    if jsonb_typeof(p_settings -> setting_key) <> 'number' then
      raise exception using errcode = '22023', message = 'invalid_booking_settings';
    end if;
  end loop;

  if jsonb_typeof(p_settings -> 'gift_certificates_enabled') <> 'boolean'
    or jsonb_typeof(p_settings -> 'public_booking_enabled') <> 'boolean'
    or p_settings ->> 'id' <> 'site'
    or p_settings ->> 'timezone' <> 'Europe/Sofia'
    or p_settings ->> 'currency' <> 'EUR'
    or (p_settings ->> 'booking_buffer_minutes')::integer not in (15, 30)
    or (p_settings ->> 'public_booking_daily_limit')::integer not between 1 and 8
    or (p_settings ->> 'booking_slot_step_minutes')::integer <> 30
    or (p_settings ->> 'booking_min_lead_minutes')::integer <> 30
    or (p_settings ->> 'booking_horizon_days')::integer not between 1 and 365
    or (p_settings ->> 'booking_hold_minutes')::integer not between 1 and 30 then
    raise exception using errcode = '22023', message = 'invalid_booking_settings';
  end if;

  update public.admin_site_settings
  set
    audit_log_retention_days = (p_settings ->> 'audit_log_retention_days')::integer,
    booking_buffer_minutes = (p_settings ->> 'booking_buffer_minutes')::integer,
    business_name = p_settings ->> 'business_name',
    cookie_privacy_mode = p_settings ->> 'cookie_privacy_mode',
    currency = p_settings ->> 'currency',
    daily_slot_capacity = (p_settings ->> 'daily_slot_capacity')::integer,
    default_locale = p_settings ->> 'default_locale',
    default_seo_title = p_settings ->> 'default_seo_title',
    email_sender = p_settings ->> 'email_sender',
    google_calendar_id = p_settings ->> 'google_calendar_id',
    google_calendar_mode = p_settings ->> 'google_calendar_mode',
    gift_certificates_enabled = (p_settings ->> 'gift_certificates_enabled')::boolean,
    reminder_template = p_settings ->> 'reminder_template',
    roles_policy = p_settings ->> 'roles_policy',
    stripe_mode = p_settings ->> 'stripe_mode',
    timezone = p_settings ->> 'timezone',
    updated_on = (p_settings ->> 'updated_on')::date,
    working_days = p_settings ->> 'working_days',
    working_hours = p_settings ->> 'working_hours',
    public_booking_enabled = (p_settings ->> 'public_booking_enabled')::boolean,
    public_booking_daily_limit = (p_settings ->> 'public_booking_daily_limit')::integer,
    booking_slot_step_minutes = (p_settings ->> 'booking_slot_step_minutes')::integer,
    booking_min_lead_minutes = (p_settings ->> 'booking_min_lead_minutes')::integer,
    booking_horizon_days = (p_settings ->> 'booking_horizon_days')::integer,
    booking_hold_minutes = (p_settings ->> 'booking_hold_minutes')::integer
  where id = 'site'
  returning * into saved_settings;

  if not found then
    raise exception using errcode = 'P0002', message = 'booking_settings_not_found';
  end if;

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    p_actor_user_id,
    'site.booking_settings',
    'admin_site_settings',
    'site',
    jsonb_build_object(
      'public_booking_enabled', saved_settings.public_booking_enabled,
      'public_booking_daily_limit', saved_settings.public_booking_daily_limit,
      'booking_buffer_minutes', saved_settings.booking_buffer_minutes,
      'booking_slot_step_minutes', saved_settings.booking_slot_step_minutes,
      'booking_min_lead_minutes', saved_settings.booking_min_lead_minutes,
      'booking_horizon_days', saved_settings.booking_horizon_days,
      'booking_hold_minutes', saved_settings.booking_hold_minutes,
      'working_days', saved_settings.working_days,
      'working_hours', saved_settings.working_hours
    )
  );

  return to_jsonb(saved_settings);
end;
$$;

revoke all on function public.public_booking_slot_in_schedule(
  date,
  time without time zone,
  integer,
  text,
  text,
  integer,
  integer,
  integer
) from public, anon, authenticated;
revoke all on function public.admin_save_booking_settings_with_audit(uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.public_booking_slot_in_schedule(
  date,
  time without time zone,
  integer,
  text,
  text,
  integer,
  integer,
  integer
) to service_role;
grant execute on function public.admin_save_booking_settings_with_audit(uuid, jsonb)
  to service_role;
