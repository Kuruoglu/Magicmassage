create or replace function public.admin_business_hours_are_valid(p_schedule jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  day jsonb;
  seen_weekdays integer[] := '{}';
  weekday_number integer;
  has_open_day boolean := false;
begin
  if jsonb_typeof(p_schedule) <> 'array' or jsonb_array_length(p_schedule) <> 7 then
    return false;
  end if;

  for day in select value from jsonb_array_elements(p_schedule)
  loop
    if jsonb_typeof(day) <> 'object'
      or coalesce(day ->> 'weekday', '') !~ '^[1-7]$'
      or jsonb_typeof(day -> 'isOpen') <> 'boolean'
      or coalesce(day ->> 'opensAt', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(day ->> 'closesAt', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    then
      return false;
    end if;

    weekday_number := (day ->> 'weekday')::integer;
    if weekday_number = any(seen_weekdays) then
      return false;
    end if;
    seen_weekdays := array_append(seen_weekdays, weekday_number);

    if (day ->> 'isOpen')::boolean then
      has_open_day := true;
      if (day ->> 'opensAt') >= (day ->> 'closesAt') then
        return false;
      end if;
    end if;
  end loop;

  return cardinality(seen_weekdays) = 7 and has_open_day;
exception
  when others then
    return false;
end;
$$;

alter table public.admin_contact_settings
  add column if not exists working_schedule jsonb not null default
  '[
    {"weekday":1,"isOpen":true,"opensAt":"10:00","closesAt":"19:00"},
    {"weekday":2,"isOpen":true,"opensAt":"10:00","closesAt":"19:00"},
    {"weekday":3,"isOpen":true,"opensAt":"10:00","closesAt":"19:00"},
    {"weekday":4,"isOpen":true,"opensAt":"10:00","closesAt":"19:00"},
    {"weekday":5,"isOpen":true,"opensAt":"10:00","closesAt":"19:00"},
    {"weekday":6,"isOpen":true,"opensAt":"10:00","closesAt":"18:00"},
    {"weekday":7,"isOpen":false,"opensAt":"10:00","closesAt":"18:00"}
  ]'::jsonb;

alter table public.admin_contact_settings
  drop constraint if exists admin_contact_settings_working_schedule_check;
alter table public.admin_contact_settings
  add constraint admin_contact_settings_working_schedule_check
  check (public.admin_business_hours_are_valid(working_schedule));

alter table public.admin_contact_settings
  drop constraint if exists admin_contact_settings_public_fields_check;
alter table public.admin_contact_settings
  add constraint admin_contact_settings_public_fields_check
  check (
    btrim(business_name) <> ''
    and btrim(address) <> ''
    and phone ~ '^\+?[0-9 ()\.-]{7,24}$'
    and length(regexp_replace(phone, '[^0-9]', '', 'g')) between 7 and 15
    and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and booking_url ~* '^https?://'
    and map_url ~* '^https?://'
    and btrim(seo_area) <> ''
  );

alter table public.admin_contact_channels
  drop constraint if exists admin_contact_channels_reserved_identity_check;
alter table public.admin_contact_channels
  add constraint admin_contact_channels_reserved_identity_check
  check (
    (
      id <> 'contact-phone'
      or (
        channel_type = 'phone'
        and value ~ '^\+?[0-9 ()\.-]{7,24}$'
        and length(regexp_replace(value, '[^0-9]', '', 'g')) between 7 and 15
      )
    )
    and (id <> 'contact-email' or (channel_type = 'email' and value ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
    and (id <> 'contact-map' or (channel_type = 'map' and value ~* '^https?://'))
    and (id <> 'contact-studio24' or (channel_type = 'booking' and value ~* '^https?://'))
  );

update public.admin_contact_settings settings
set phone = channel.value
from public.admin_contact_channels channel
where settings.id = 'site'
  and channel.id = 'contact-phone'
  and channel.channel_type = 'phone'
  and channel.value ~ '^\+?[0-9 ()\.-]{7,24}$'
  and length(regexp_replace(channel.value, '[^0-9]', '', 'g')) between 7 and 15;

drop trigger if exists set_updated_at on public.admin_contact_settings;
create trigger set_updated_at
before update on public.admin_contact_settings
for each row execute function public.set_admin_updated_at();

drop trigger if exists set_updated_at on public.admin_contact_channels;
create trigger set_updated_at
before update on public.admin_contact_channels
for each row execute function public.set_admin_updated_at();

create or replace function public.admin_sync_primary_contact_channel()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id = 'contact-phone' and new.channel_type = 'phone' then
    update public.admin_contact_settings
    set phone = new.value
    where id = 'site' and phone is distinct from new.value;
  elsif new.id = 'contact-email' and new.channel_type = 'email' then
    update public.admin_contact_settings
    set email = new.value
    where id = 'site' and email is distinct from new.value;
  elsif new.id = 'contact-map' and new.channel_type = 'map' then
    update public.admin_contact_settings
    set map_url = new.value
    where id = 'site' and map_url is distinct from new.value;
  elsif new.id = 'contact-studio24' and new.channel_type = 'booking' then
    update public.admin_contact_settings
    set booking_url = new.value
    where id = 'site' and booking_url is distinct from new.value;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_primary_contact_channel on public.admin_contact_channels;
create trigger sync_primary_contact_channel
after insert or update of value, channel_type on public.admin_contact_channels
for each row execute function public.admin_sync_primary_contact_channel();

create or replace function public.admin_save_contact_settings_with_audit(
  p_record jsonb,
  p_actor_user_id uuid,
  p_action text,
  p_audit_metadata jsonb
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  schedule jsonb := coalesce(
    p_record -> 'working_schedule',
    '[
      {"weekday":1,"isOpen":true,"opensAt":"10:00","closesAt":"19:00"},
      {"weekday":2,"isOpen":true,"opensAt":"10:00","closesAt":"19:00"},
      {"weekday":3,"isOpen":true,"opensAt":"10:00","closesAt":"19:00"},
      {"weekday":4,"isOpen":true,"opensAt":"10:00","closesAt":"19:00"},
      {"weekday":5,"isOpen":true,"opensAt":"10:00","closesAt":"19:00"},
      {"weekday":6,"isOpen":true,"opensAt":"10:00","closesAt":"18:00"},
      {"weekday":7,"isOpen":false,"opensAt":"10:00","closesAt":"18:00"}
    ]'::jsonb
  );
begin
  if jsonb_typeof(p_record) is distinct from 'object'
    or jsonb_typeof(p_audit_metadata) is distinct from 'object'
    or p_actor_user_id is null
    or p_action <> 'record.contactSettings.upsert'
    or p_record ->> 'id' <> 'site'
    or coalesce(btrim(p_record ->> 'business_name'), '') = ''
    or coalesce(btrim(p_record ->> 'address'), '') = ''
    or coalesce(p_record ->> 'phone', '') !~ '^\+?[0-9 ()\.-]{7,24}$'
    or length(regexp_replace(coalesce(p_record ->> 'phone', ''), '[^0-9]', '', 'g')) not between 7 and 15
    or coalesce(p_record ->> 'email', '') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or coalesce(p_record ->> 'booking_url', '') !~* '^https?://'
    or coalesce(p_record ->> 'map_url', '') !~* '^https?://'
    or coalesce(btrim(p_record ->> 'seo_area'), '') = ''
    or not public.admin_business_hours_are_valid(schedule)
  then
    raise exception 'Valid contact settings, schedule, actor, action, and metadata are required.' using errcode = '22023';
  end if;

  insert into public.admin_contact_settings (
    id, business_name, phone, email, address, working_hours,
    working_schedule, booking_url, map_url, seo_area
  ) values (
    'site',
    p_record ->> 'business_name',
    p_record ->> 'phone',
    p_record ->> 'email',
    p_record ->> 'address',
    p_record ->> 'working_hours',
    schedule,
    p_record ->> 'booking_url',
    p_record ->> 'map_url',
    p_record ->> 'seo_area'
  )
  on conflict (id) do update set
    business_name = excluded.business_name,
    phone = excluded.phone,
    email = excluded.email,
    address = excluded.address,
    working_hours = excluded.working_hours,
    working_schedule = excluded.working_schedule,
    booking_url = excluded.booking_url,
    map_url = excluded.map_url,
    seo_area = excluded.seo_area;

  update public.admin_contact_channels
  set value = case id
    when 'contact-phone' then p_record ->> 'phone'
    when 'contact-email' then p_record ->> 'email'
    when 'contact-map' then p_record ->> 'map_url'
    when 'contact-studio24' then p_record ->> 'booking_url'
    else value
  end
  where id in ('contact-phone', 'contact-email', 'contact-map', 'contact-studio24');

  insert into public.admin_audit_log (
    actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_actor_user_id,
    p_action,
    'admin_contact_settings',
    'site',
    p_audit_metadata
  );
end;
$$;

create or replace view public.admin_public_business_details
with (security_invoker = false, security_barrier = true)
as
select
  settings.id,
  settings.business_name,
  settings.phone,
  settings.address,
  settings.seo_area,
  settings.working_schedule,
  settings.updated_at
from public.admin_contact_settings settings
where settings.id = 'site';

revoke all on public.admin_contact_settings from anon;
revoke all on public.admin_public_business_details from public;
revoke all on function public.admin_save_contact_settings_with_audit(jsonb, uuid, text, jsonb)
  from public, anon, authenticated;

grant select on public.admin_public_business_details to anon, authenticated, service_role;
grant execute on function public.admin_save_contact_settings_with_audit(jsonb, uuid, text, jsonb)
  to service_role;

comment on view public.admin_public_business_details is
  'Narrow public projection for the business name, phone, address, and footer working schedule.';
