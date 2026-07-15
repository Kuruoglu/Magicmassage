alter table public.public_booking_holds
  add column if not exists session_key_hash text;

update public.public_booking_holds
set session_key_hash = token_hash
where status = 'active'
  and session_key_hash is null;

alter table public.public_booking_holds
  drop constraint if exists public_booking_holds_session_key_hash_check,
  drop constraint if exists public_booking_holds_session_state_check;

alter table public.public_booking_holds
  add constraint public_booking_holds_session_key_hash_check
    check (session_key_hash is null or session_key_hash ~ '^[a-f0-9]{64}$'),
  add constraint public_booking_holds_session_state_check
    check (
      (status = 'active' and session_key_hash is not null)
      or (status <> 'active' and session_key_hash is null)
    );

create unique index if not exists public_booking_holds_active_session_uidx
  on public.public_booking_holds (session_key_hash)
  where session_key_hash is not null;

create or replace function public.public_booking_clear_inactive_session_key()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status <> 'active' then
    new.session_key_hash := null;
  end if;

  return new;
end;
$$;

drop trigger if exists clear_inactive_session_key on public.public_booking_holds;
create trigger clear_inactive_session_key
before update on public.public_booking_holds
for each row execute function public.public_booking_clear_inactive_session_key();

drop function if exists public.public_booking_create_hold(
  text, text, date, time without time zone
);

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
  slot_range tsrange;
begin
  if coalesce(p_token_hash, '') !~ '^[a-f0-9]{64}$'
    or coalesce(p_session_key_hash, '') !~ '^[a-f0-9]{64}$'
    or nullif(btrim(p_price_variant_id), '') is null
    or p_starts_on is null
    or p_starts_at is null then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('public-booking-session:' || p_session_key_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('public-booking:' || p_starts_on::text, 0));

  update public.public_booking_holds
  set status = 'expired'
  where status = 'active' and expires_at <= now();

  select * into existing_session_hold
  from public.public_booking_holds
  where session_key_hash = p_session_key_hash
    and status = 'active'
  for update;

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
      and (existing_session_hold.id is null or active_hold.id <> existing_session_hold.id)
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
      and (existing_session_hold.id is null or existing_hold.id <> existing_session_hold.id)
      and slot_range && tsrange(
        existing_hold.starts_on + existing_hold.starts_at,
        existing_hold.starts_on + existing_hold.starts_at
          + make_interval(mins => existing_hold.duration_minutes + existing_hold.buffer_minutes),
        '[)'
      )
  ) then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  if existing_session_hold.id is null then
    insert into public.public_booking_holds (
      token_hash,
      session_key_hash,
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
      p_session_key_hash,
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
  else
    update public.public_booking_holds
    set
      token_hash = p_token_hash,
      price_variant_id = variant.id,
      service_slug = variant.service_slug,
      starts_on = p_starts_on,
      starts_at = p_starts_at,
      duration_minutes = variant.duration_minutes,
      buffer_minutes = settings.booking_buffer_minutes,
      price_cents = variant.price_cents,
      currency = variant.currency,
      expires_at = now() + make_interval(mins => settings.booking_hold_minutes)
    where id = existing_session_hold.id
    returning * into hold;
  end if;

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

revoke all on function public.public_booking_clear_inactive_session_key()
  from public, anon, authenticated;
revoke all on function public.public_booking_create_hold(
  text, text, text, date, time without time zone
) from public, anon, authenticated;

grant execute on function public.public_booking_create_hold(
  text, text, text, date, time without time zone
) to service_role;

comment on column public.public_booking_holds.session_key_hash is
  'Hash of the opaque HttpOnly browser session token; only one active hold is permitted per session.';
