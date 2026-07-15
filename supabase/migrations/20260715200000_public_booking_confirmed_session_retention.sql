-- Keep the opaque session hash on newly confirmed holds so an idempotent retry
-- can resolve the original appointment. Expired holds release it immediately.

alter table public.public_booking_holds
  drop constraint if exists public_booking_holds_session_state_check;

alter table public.public_booking_holds
  add constraint public_booking_holds_session_state_check
    check (
      (status = 'active' and session_key_hash is not null)
      or status = 'confirmed'
      or (status = 'expired' and session_key_hash is null)
    );

drop index if exists public.public_booking_holds_active_session_uidx;

create unique index public_booking_holds_active_session_uidx
  on public.public_booking_holds (session_key_hash)
  where status = 'active' and session_key_hash is not null;

create or replace function public.public_booking_clear_inactive_session_key()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'expired' then
    new.session_key_hash := null;
  end if;

  return new;
end;
$$;
