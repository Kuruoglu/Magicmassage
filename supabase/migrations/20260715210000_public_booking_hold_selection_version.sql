-- Bind confirmation to the exact slot selection observed by the browser tab.
-- Token rotation and hold restoration keep the version stable; changing the
-- selected service, date, time, duration, or buffer advances it.

alter table public.public_booking_holds
  add column if not exists selection_version integer not null default 1
    check (selection_version > 0);

create or replace function public.public_booking_bump_selection_version()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.status = 'active'
    and new.status = 'active'
    and (
      new.price_variant_id is distinct from old.price_variant_id
      or new.service_slug is distinct from old.service_slug
      or new.starts_on is distinct from old.starts_on
      or new.starts_at is distinct from old.starts_at
      or new.duration_minutes is distinct from old.duration_minutes
      or new.buffer_minutes is distinct from old.buffer_minutes
    ) then
    new.selection_version := old.selection_version + 1;
  else
    new.selection_version := old.selection_version;
  end if;

  return new;
end;
$$;

drop trigger if exists bump_selection_version on public.public_booking_holds;
create trigger bump_selection_version
before update on public.public_booking_holds
for each row execute function public.public_booking_bump_selection_version();

create function public.public_booking_create_hold_v2(
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
  result jsonb;
  hold public.public_booking_holds%rowtype;
begin
  result := public.public_booking_create_hold(
    p_token_hash,
    p_session_key_hash,
    p_price_variant_id,
    p_starts_on,
    p_starts_at
  );

  select * into hold
  from public.public_booking_holds
  where session_key_hash = p_session_key_hash
    and status = 'active';

  if not found then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  return result || jsonb_build_object('selectionVersion', hold.selection_version);
end;
$$;

create function public.public_booking_restore_session_hold_v2(
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
begin
  result := public.public_booking_restore_session_hold(
    p_session_key_hash,
    p_token_hash
  );

  if result is null then
    return null;
  end if;

  select * into hold
  from public.public_booking_holds
  where session_key_hash = p_session_key_hash
    and status = 'active';

  if not found then
    return null;
  end if;

  return result || jsonb_build_object('selectionVersion', hold.selection_version);
end;
$$;

create function public.public_booking_confirm_session_v2(
  p_session_key_hash text,
  p_selection_version integer,
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
  current_selection_version integer;
begin
  if coalesce(p_session_key_hash, '') !~ '^[a-f0-9]{64}$'
    or coalesce(p_idempotency_key_hash, '') !~ '^[a-f0-9]{64}$'
    or p_selection_version is null
    or p_selection_version < 1 then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('public-booking-session:' || p_session_key_hash, 0)
  );

  select hold.selection_version into current_selection_version
  from public.admin_appointments appointment
  join public.public_booking_holds hold
    on hold.id = appointment.public_booking_hold_id
  where appointment.public_booking_idempotency_key_hash = p_idempotency_key_hash
    and hold.session_key_hash = p_session_key_hash;

  if not found then
    select hold.selection_version into current_selection_version
    from public.public_booking_holds hold
    where hold.session_key_hash = p_session_key_hash
      and hold.status = 'active';
  end if;

  if current_selection_version is distinct from p_selection_version then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  return public.public_booking_confirm_session(
    p_session_key_hash,
    p_idempotency_key_hash,
    p_full_name,
    p_phone,
    p_phone_normalized,
    p_email,
    p_locale,
    p_contact_preference,
    p_public_note,
    p_privacy_accepted
  );
end;
$$;

revoke all on function public.public_booking_bump_selection_version()
  from public, anon, authenticated;
revoke all on function public.public_booking_create_hold_v2(
  text, text, text, date, time without time zone
) from public, anon, authenticated;
revoke all on function public.public_booking_restore_session_hold_v2(text, text)
  from public, anon, authenticated;
revoke all on function public.public_booking_confirm_session_v2(
  text, integer, text, text, text, text, text, text, text, text, boolean
) from public, anon, authenticated;

grant execute on function public.public_booking_create_hold_v2(
  text, text, text, date, time without time zone
) to service_role;
grant execute on function public.public_booking_restore_session_hold_v2(text, text)
  to service_role;
grant execute on function public.public_booking_confirm_session_v2(
  text, integer, text, text, text, text, text, text, text, text, boolean
) to service_role;

comment on column public.public_booking_holds.selection_version is
  'Monotonic version of the slot selection used to reject stale-tab confirmation.';
