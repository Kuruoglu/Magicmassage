create or replace function public.admin_protect_last_active_owner()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.role::text = 'owner' and old.status = 'active'
    and (
      tg_op = 'DELETE'
      or new.role::text <> 'owner'
      or new.status <> 'active'
    )
    and not exists (
      select 1
      from public.admin_profiles other_profile
      where other_profile.user_id <> old.user_id
        and other_profile.role::text = 'owner'
        and other_profile.status = 'active'
    ) then
    raise exception using errcode = '23514', message = 'last_active_owner_required';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists protect_last_active_owner on public.admin_profiles;
create trigger protect_last_active_owner
before update of role, status or delete on public.admin_profiles
for each row execute function public.admin_protect_last_active_owner();

revoke all on function public.admin_protect_last_active_owner() from public;
