-- Close remaining direct-read and specialist-offboarding edge cases.

revoke select on table public.admin_profiles from authenticated;
revoke select on table public.admin_audit_log from authenticated;
revoke select on table public.public_booking_holds from authenticated;

create or replace function public.admin_finalize_specialist_offboarding()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  affected_specialist_id uuid;
begin
  affected_specialist_id := old.specialist_id;
  if affected_specialist_id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.admin_specialists
    set auth_user_id = null,
        status = 'offboarded',
        public_booking_enabled = false,
        updated_at = now()
    where id = affected_specialist_id;
  elsif new.specialist_id is not null and new.status = 'active' then
    return new;
  end if;

  update public.public_booking_holds
  set status = 'expired'
  where specialist_id = affected_specialist_id
    and status = 'active';

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists finalize_specialist_offboarding on public.admin_profiles;
create trigger finalize_specialist_offboarding
after update of role, status or delete on public.admin_profiles
for each row execute function public.admin_finalize_specialist_offboarding();

revoke all on function public.admin_finalize_specialist_offboarding() from public;

comment on function public.admin_finalize_specialist_offboarding() is
  'Disables deleted or unlinked specialist identities and expires active public holds.';
