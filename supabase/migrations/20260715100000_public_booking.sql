-- Public automatic booking remains a server-only boundary. Browser callers use
-- Next.js routes, and only service_role may execute the functions below.

alter table public.admin_site_settings
  add column if not exists public_booking_enabled boolean not null default false,
  add column if not exists public_booking_daily_limit integer not null default 8,
  add column if not exists booking_slot_step_minutes integer not null default 15,
  add column if not exists booking_min_lead_minutes integer not null default 240,
  add column if not exists booking_horizon_days integer not null default 60,
  add column if not exists booking_hold_minutes integer not null default 5;

update public.admin_site_settings
set
  timezone = 'Europe/Sofia',
  booking_buffer_minutes = case
    when booking_buffer_minutes in (15, 30) then booking_buffer_minutes
    else 30
  end
where id = 'site';

alter table public.admin_site_settings
  drop constraint if exists admin_site_settings_booking_buffer_minutes_check,
  drop constraint if exists admin_site_settings_public_booking_daily_limit_check,
  drop constraint if exists admin_site_settings_booking_slot_step_minutes_check,
  drop constraint if exists admin_site_settings_booking_min_lead_minutes_check,
  drop constraint if exists admin_site_settings_booking_horizon_days_check,
  drop constraint if exists admin_site_settings_booking_hold_minutes_check,
  drop constraint if exists admin_site_settings_public_booking_timezone_check;

alter table public.admin_site_settings
  add constraint admin_site_settings_booking_buffer_minutes_check
    check (booking_buffer_minutes in (15, 30)),
  add constraint admin_site_settings_public_booking_daily_limit_check
    check (public_booking_daily_limit between 1 and 8),
  add constraint admin_site_settings_booking_slot_step_minutes_check
    check (booking_slot_step_minutes = 15),
  add constraint admin_site_settings_booking_min_lead_minutes_check
    check (booking_min_lead_minutes between 0 and 10080),
  add constraint admin_site_settings_booking_horizon_days_check
    check (booking_horizon_days between 1 and 365),
  add constraint admin_site_settings_booking_hold_minutes_check
    check (booking_hold_minutes between 1 and 30),
  add constraint admin_site_settings_public_booking_timezone_check
    check (timezone = 'Europe/Sofia');

alter table public.admin_appointments
  add column if not exists service_slug text references public.admin_services(slug) on update cascade on delete restrict,
  add column if not exists price_variant_id text references public.admin_price_variants(id) on update cascade on delete restrict,
  add column if not exists price_cents_snapshot integer,
  add column if not exists currency_snapshot text,
  add column if not exists origin text not null default 'admin',
  add column if not exists locale text,
  add column if not exists public_reference text,
  add column if not exists public_booking_idempotency_key_hash text;

alter table public.admin_appointments
  drop constraint if exists admin_appointments_price_cents_snapshot_check,
  drop constraint if exists admin_appointments_currency_snapshot_check,
  drop constraint if exists admin_appointments_origin_check,
  drop constraint if exists admin_appointments_public_locale_check,
  drop constraint if exists admin_appointments_public_reference_check,
  drop constraint if exists admin_appointments_public_idempotency_hash_check,
  drop constraint if exists admin_appointments_public_provenance_check;

alter table public.admin_appointments
  add constraint admin_appointments_price_cents_snapshot_check
    check (price_cents_snapshot is null or price_cents_snapshot >= 0),
  add constraint admin_appointments_currency_snapshot_check
    check (
      currency_snapshot is null
      or (currency_snapshot = upper(currency_snapshot) and length(currency_snapshot) = 3)
    ),
  add constraint admin_appointments_origin_check
    check (origin in ('admin', 'public')),
  add constraint admin_appointments_public_locale_check
    check (locale is null or locale in ('bg', 'ru', 'ua', 'en')),
  add constraint admin_appointments_public_reference_check
    check (public_reference is null or public_reference ~ '^MMN-[0-9]{8}-[A-F0-9]{12}$'),
  add constraint admin_appointments_public_idempotency_hash_check
    check (
      public_booking_idempotency_key_hash is null
      or public_booking_idempotency_key_hash ~ '^[a-f0-9]{64}$'
    ),
  add constraint admin_appointments_public_provenance_check
    check (
      origin <> 'public'
      or (
        service_slug is not null
        and price_variant_id is not null
        and price_cents_snapshot is not null
        and currency_snapshot is not null
        and locale is not null
        and public_reference is not null
        and public_booking_idempotency_key_hash is not null
        and not overlap_override
      )
    );

create unique index if not exists admin_appointments_public_reference_uidx
  on public.admin_appointments (public_reference)
  where public_reference is not null;
create unique index if not exists admin_appointments_public_idempotency_uidx
  on public.admin_appointments (public_booking_idempotency_key_hash)
  where public_booking_idempotency_key_hash is not null;

create table if not exists public.admin_calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  block_date date not null,
  starts_at time without time zone not null,
  ends_at time without time zone not null,
  kind text not null default 'personal'
    check (kind in ('personal', 'unavailable', 'other')),
  internal_note text not null default ''
    check (char_length(internal_note) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create index if not exists admin_calendar_blocks_schedule_idx
  on public.admin_calendar_blocks (block_date, starts_at, ends_at);
create index if not exists admin_calendar_blocks_updated_by_idx
  on public.admin_calendar_blocks (updated_by, updated_at)
  where updated_by is not null;

drop trigger if exists set_updated_at on public.admin_calendar_blocks;
create trigger set_updated_at
before update on public.admin_calendar_blocks
for each row execute function public.set_admin_updated_at();

create table if not exists public.public_booking_holds (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique
    check (token_hash ~ '^[a-f0-9]{64}$'),
  price_variant_id text not null references public.admin_price_variants(id) on update cascade on delete restrict,
  service_slug text not null references public.admin_services(slug) on update cascade on delete restrict,
  starts_on date not null,
  starts_at time without time zone not null,
  duration_minutes integer not null check (duration_minutes > 0),
  buffer_minutes integer not null check (buffer_minutes in (15, 30)),
  status text not null default 'active'
    check (status in ('active', 'confirmed', 'expired')),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'confirmed' and confirmed_at is not null)
    or (status in ('active', 'expired') and confirmed_at is null)
  )
);

create index if not exists public_booking_holds_schedule_idx
  on public.public_booking_holds (starts_on, starts_at, status, expires_at)
  include (duration_minutes, buffer_minutes);
create index if not exists public_booking_holds_expiry_idx
  on public.public_booking_holds (expires_at)
  where status = 'active';

drop trigger if exists set_updated_at on public.public_booking_holds;
create trigger set_updated_at
before update on public.public_booking_holds
for each row execute function public.set_admin_updated_at();

alter table public.admin_appointments
  add column if not exists public_booking_hold_id uuid
    references public.public_booking_holds(id) on delete restrict;

alter table public.admin_appointments
  drop constraint if exists admin_appointments_public_hold_check;

alter table public.admin_appointments
  add constraint admin_appointments_public_hold_check
    check (
      (origin = 'public' and public_booking_hold_id is not null)
      or (origin <> 'public' and public_booking_hold_id is null)
    );

create unique index if not exists admin_appointments_public_hold_uidx
  on public.admin_appointments (public_booking_hold_id)
  where public_booking_hold_id is not null;

create table if not exists public.public_booking_rate_limits (
  scope text not null check (scope ~ '^[a-z_]{1,40}$'),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  request_count integer not null default 0 check (request_count >= 0),
  window_started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (scope, key_hash),
  check (expires_at > window_started_at)
);

create index if not exists public_booking_rate_limits_expiry_idx
  on public.public_booking_rate_limits (expires_at);

alter table public.admin_calendar_blocks enable row level security;
alter table public.public_booking_holds enable row level security;
alter table public.public_booking_rate_limits enable row level security;

-- Convert the existing narrow public feature view to a definer view before
-- removing direct anon access to the underlying settings row.
create or replace view public.admin_public_site_flags
with (security_invoker = false, security_barrier = true)
as
select
  settings.id,
  settings.gift_certificates_enabled,
  settings.public_booking_enabled
from public.admin_site_settings settings
where settings.id = 'site';

revoke all on public.admin_clients from anon;
revoke all on public.admin_appointments from anon;
revoke all on public.admin_site_settings from anon;
revoke select (id, gift_certificates_enabled, public_booking_enabled)
  on public.admin_site_settings from anon;
revoke all on public.admin_calendar_blocks from anon, authenticated;
revoke all on public.public_booking_holds from anon, authenticated;
revoke all on public.public_booking_rate_limits from anon, authenticated;

grant select, insert, update, delete on public.admin_calendar_blocks to service_role;
grant select, insert, update, delete on public.public_booking_holds to service_role;
grant select, insert, update, delete on public.public_booking_rate_limits to service_role;
grant select on public.admin_public_site_flags to anon, authenticated, service_role;

create or replace function public.public_booking_weekday_number(p_token text)
returns integer
language sql
immutable
set search_path = pg_catalog
as $$
  select case lower(btrim(p_token))
    when 'mon' then 1 when 'monday' then 1 when 'пн' then 1 when 'пон' then 1 when 'понеделник' then 1
    when 'tue' then 2 when 'tuesday' then 2 when 'вт' then 2 when 'вто' then 2 when 'вторник' then 2
    when 'wed' then 3 when 'wednesday' then 3 when 'ср' then 3 when 'сря' then 3 when 'сряда' then 3
    when 'thu' then 4 when 'thursday' then 4 when 'чт' then 4 when 'чет' then 4 when 'четвъртък' then 4
    when 'fri' then 5 when 'friday' then 5 when 'пт' then 5 when 'пет' then 5 when 'петък' then 5
    when 'sat' then 6 when 'saturday' then 6 when 'сб' then 6 when 'съб' then 6 when 'събота' then 6
    when 'sun' then 7 when 'sunday' then 7 when 'вс' then 7 when 'нд' then 7 when 'нед' then 7 when 'неделя' then 7
    else null
  end;
$$;

create or replace function public.public_booking_day_is_open(
  p_date date,
  p_working_days text
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  segment text;
  segment_start integer;
  segment_end integer;
  weekday integer := extract(isodow from p_date)::integer;
begin
  if nullif(btrim(p_working_days), '') is null then
    return false;
  end if;

  foreach segment in array regexp_split_to_array(
    replace(replace(lower(p_working_days), '–', '-'), '—', '-'),
    '\s*,\s*'
  )
  loop
    segment_start := public.public_booking_weekday_number(split_part(segment, '-', 1));
    segment_end := public.public_booking_weekday_number(split_part(segment, '-', 2));

    if segment_start is null then
      continue;
    end if;
    if position('-' in segment) = 0 then
      if weekday = segment_start then return true; end if;
    elsif segment_end is not null then
      if segment_start <= segment_end and weekday between segment_start and segment_end then
        return true;
      end if;
      if segment_start > segment_end and (weekday >= segment_start or weekday <= segment_end) then
        return true;
      end if;
    end if;
  end loop;

  return false;
end;
$$;

create or replace function public.public_booking_working_minutes(p_working_hours text)
returns int4range
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  compact text;
  start_text text;
  end_text text;
  start_minutes integer;
  end_minutes integer;
begin
  compact := regexp_replace(
    replace(replace(btrim(p_working_hours), '–', '-'), '—', '-'),
    '\s',
    '',
    'g'
  );
  start_text := split_part(compact, '-', 1);
  end_text := split_part(compact, '-', 2);

  if compact !~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$' then
    return null;
  end if;

  start_minutes := split_part(start_text, ':', 1)::integer * 60
    + split_part(start_text, ':', 2)::integer;
  end_minutes := split_part(end_text, ':', 1)::integer * 60
    + split_part(end_text, ':', 2)::integer;

  if end_minutes <= start_minutes then return null; end if;
  return int4range(start_minutes, end_minutes, '[)');
end;
$$;

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
    and p_slot_step_minutes = 15
    and p_starts_on between local_today and local_today + p_horizon_days
    and public.public_booking_day_is_open(p_starts_on, p_working_days)
    and working_window is not null
    and start_minutes % p_slot_step_minutes = 0
    and start_minutes >= lower(working_window)
    and start_minutes + p_duration_minutes <= upper(working_window)
    and p_starts_on + p_starts_at >= local_now + make_interval(mins => p_min_lead_minutes);
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

  select * into settings
  from public.admin_site_settings
  where id = 'site';

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
            where price.service_slug = service.slug
              and price.status = 'active'
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
          select 1
          from public.admin_price_variants price
          where price.service_slug = service.slug
            and price.status = 'active'
        )
    ), '[]'::jsonb) else '[]'::jsonb end
  );
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
          'capReached', candidate.daily_count >= settings.public_booking_daily_limit,
          'slots', case
            when candidate.daily_count >= settings.public_booking_daily_limit then '[]'::jsonb
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
          ) as daily_count
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
    price.duration_minutes
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
    expires_at
  ) values (
    p_token_hash,
    variant.id,
    variant.service_slug,
    p_starts_on,
    p_starts_at,
    variant.duration_minutes,
    settings.booking_buffer_minutes,
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
    or hold.buffer_minutes <> settings.booking_buffer_minutes
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

create or replace function public.public_booking_consume_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  bucket public.public_booking_rate_limits%rowtype;
begin
  if coalesce(p_scope, '') !~ '^[a-z_]{1,40}$'
    or coalesce(p_key_hash, '') !~ '^[a-f0-9]{64}$'
    or p_limit not between 1 and 1000
    or p_window_seconds not between 1 and 86400 then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public-booking-rate:' || p_scope || ':' || p_key_hash, 0));

  insert into public.public_booking_rate_limits (
    scope,
    key_hash,
    request_count,
    window_started_at,
    expires_at
  ) values (
    p_scope,
    p_key_hash,
    1,
    now(),
    now() + make_interval(secs => p_window_seconds)
  )
  on conflict (scope, key_hash) do update
  set
    request_count = case
      when public.public_booking_rate_limits.expires_at <= now() then 1
      else public.public_booking_rate_limits.request_count + 1
    end,
    window_started_at = case
      when public.public_booking_rate_limits.expires_at <= now() then now()
      else public.public_booking_rate_limits.window_started_at
    end,
    expires_at = case
      when public.public_booking_rate_limits.expires_at <= now()
        then now() + make_interval(secs => p_window_seconds)
      else public.public_booking_rate_limits.expires_at
    end
  returning * into bucket;

  delete from public.public_booking_rate_limits
  where expires_at < now() - interval '1 day';

  return bucket.request_count <= p_limit;
end;
$$;

create or replace function public.admin_mutate_calendar_block(
  p_action text,
  p_block_id uuid,
  p_block_date date,
  p_starts_at time without time zone,
  p_ends_at time without time zone,
  p_kind text,
  p_internal_note text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  block_id uuid;
  existing_block public.admin_calendar_blocks%rowtype;
  saved_block public.admin_calendar_blocks%rowtype;
  audit_action text;
  block_range tsrange;
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

  -- A SHARE lock prevents appointment inserts or updates between conflict
  -- validation and the block mutation. Admin appointment writes themselves
  -- remain unrestricted by the public daily limit.
  lock table public.admin_appointments in share mode;
  lock table public.admin_calendar_blocks in share row exclusive mode;

  if p_action = 'delete' then
    if p_block_id is null then
      raise exception using errcode = '22023', message = 'invalid_calendar_block';
    end if;

    select * into existing_block
    from public.admin_calendar_blocks
    where id = p_block_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'calendar_block_not_found';
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
        'kind', existing_block.kind
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
  select * into existing_block
  from public.admin_calendar_blocks
  where id = block_id;
  audit_action := case when found then 'calendar_block.update' else 'calendar_block.create' end;
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
    updated_by
  ) values (
    block_id,
    p_block_date,
    p_starts_at,
    p_ends_at,
    p_kind,
    coalesce(p_internal_note, ''),
    p_actor_user_id,
    p_actor_user_id
  )
  on conflict (id) do update
  set
    block_date = excluded.block_date,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    kind = excluded.kind,
    internal_note = excluded.internal_note,
    updated_by = p_actor_user_id
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
      'kind', saved_block.kind
    )
  );

  return to_jsonb(saved_block);
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
    or (p_settings ->> 'booking_slot_step_minutes')::integer <> 15
    or (p_settings ->> 'booking_min_lead_minutes')::integer not between 0 and 10080
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

comment on table public.admin_calendar_blocks is
  'Admin-managed personal and operational calendar exclusions used by public availability.';
comment on table public.public_booking_holds is
  'Five-minute public slot reservations. Only SHA-256 token hashes are stored.';
comment on column public.admin_appointments.origin is
  'Write provenance. Public booking limits apply only inside public booking RPCs, never to admin writes.';

revoke all on function public.public_booking_weekday_number(text) from public, anon, authenticated;
revoke all on function public.public_booking_day_is_open(date, text) from public, anon, authenticated;
revoke all on function public.public_booking_working_minutes(text) from public, anon, authenticated;
revoke all on function public.public_booking_slot_in_schedule(date, time without time zone, integer, text, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.public_booking_get_options(text) from public, anon, authenticated;
revoke all on function public.public_booking_get_availability(text, date, integer) from public, anon, authenticated;
revoke all on function public.public_booking_create_hold(text, text, date, time without time zone) from public, anon, authenticated;
revoke all on function public.public_booking_confirm(text, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.public_booking_consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_mutate_calendar_block(text, uuid, date, time without time zone, time without time zone, text, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_save_booking_settings_with_audit(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.public_booking_get_options(text) to service_role;
grant execute on function public.public_booking_get_availability(text, date, integer) to service_role;
grant execute on function public.public_booking_create_hold(text, text, date, time without time zone) to service_role;
grant execute on function public.public_booking_confirm(text, text, text, text, text, text, text, text, boolean) to service_role;
grant execute on function public.public_booking_consume_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.admin_mutate_calendar_block(text, uuid, date, time without time zone, time without time zone, text, text, uuid) to service_role;
grant execute on function public.admin_save_booking_settings_with_audit(uuid, jsonb) to service_role;
grant execute on function public.public_booking_weekday_number(text) to service_role;
grant execute on function public.public_booking_day_is_open(date, text) to service_role;
grant execute on function public.public_booking_working_minutes(text) to service_role;
grant execute on function public.public_booking_slot_in_schedule(date, time without time zone, integer, text, text, integer, integer, integer) to service_role;
