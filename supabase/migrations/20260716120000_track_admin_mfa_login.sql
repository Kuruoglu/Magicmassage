alter table public.admin_profiles
  add column if not exists mfa_verified_at timestamptz;

create or replace function public.admin_mark_login(p_actor_user_id uuid)
returns void
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
begin
  update public.admin_profiles
  set last_login_at = now(), mfa_verified_at = now(), updated_at = now()
  where user_id = p_actor_user_id and status = 'active';
  if not found then raise exception using errcode = '42501', message = 'login_forbidden'; end if;

  insert into public.admin_audit_log (actor_user_id, action, entity_table, entity_id, metadata)
  values (
    p_actor_user_id,
    'auth.login',
    'admin_profiles',
    p_actor_user_id::text,
    jsonb_build_object('assurance_level', 'aal2')
  );
end;
$$;

revoke all on function public.admin_mark_login(uuid) from public, anon, authenticated;
grant execute on function public.admin_mark_login(uuid) to service_role;
