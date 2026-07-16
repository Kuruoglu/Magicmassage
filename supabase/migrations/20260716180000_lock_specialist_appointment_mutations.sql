-- Appointment assignment and mutation belong to the owner/administrator. Keep
-- the existing transactional implementation behind an owner-only wrapper.

alter function public.admin_save_appointment_with_audit(jsonb, uuid, text, jsonb)
  rename to admin_save_appointment_with_audit_internal;

create function public.admin_save_appointment_with_audit(
  p_record jsonb,
  p_actor_user_id uuid,
  p_action text,
  p_audit_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1
    from public.admin_profiles profile
    where profile.user_id = p_actor_user_id
      and profile.status = 'active'
      and profile.role::text in ('owner', 'administrator')
  ) then
    raise exception using errcode = '42501', message = 'appointment_forbidden';
  end if;

  perform public.admin_save_appointment_with_audit_internal(
    p_record,
    p_actor_user_id,
    p_action,
    p_audit_metadata
  );
end;
$$;

revoke all on function public.admin_save_appointment_with_audit_internal(jsonb, uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_save_appointment_with_audit(jsonb, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_save_appointment_with_audit(jsonb, uuid, text, jsonb)
  to service_role;

comment on function public.admin_save_appointment_with_audit(jsonb, uuid, text, jsonb) is
  'Owner/administrator-only appointment mutation boundary.';
