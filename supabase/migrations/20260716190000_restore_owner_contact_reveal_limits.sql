create or replace function public.admin_reveal_appointment_contact(
  p_actor_user_id uuid,
  p_appointment_id text,
  p_purpose text
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  appointment public.admin_appointments%rowtype;
  client public.admin_clients%rowtype;
  recent_reveals integer;
begin
  if p_actor_user_id is null or nullif(btrim(p_appointment_id), '') is null
    or char_length(btrim(coalesce(p_purpose, ''))) not between 3 and 200 then
    raise exception using errcode = '22023', message = 'invalid_contact_reveal';
  end if;

  if not exists (
    select 1 from public.admin_profiles profile
    where profile.user_id = p_actor_user_id
      and profile.status = 'active'
      and profile.role::text in ('owner', 'administrator')
  ) then
    raise exception using errcode = '42501', message = 'contact_reveal_forbidden';
  end if;

  select * into appointment from public.admin_appointments where id = p_appointment_id;
  if not found then raise exception using errcode = 'P0002', message = 'appointment_not_found'; end if;

  perform pg_advisory_xact_lock(hashtextextended('admin-contact-reveal:' || p_actor_user_id::text, 0));
  select count(*) into recent_reveals from public.admin_audit_log audit
  where audit.actor_user_id = p_actor_user_id
    and audit.action = 'client.contact.reveal'
    and audit.created_at >= now() - interval '10 minutes';
  if recent_reveals >= 60 then
    raise exception using errcode = 'P0001', message = 'contact_reveal_rate_limited';
  end if;

  if recent_reveals >= 19 and not exists (
    select 1 from public.admin_security_alerts alert
    where alert.actor_user_id = p_actor_user_id
      and alert.alert_type = 'bulk_contact_reveal'
      and alert.created_at >= now() - interval '10 minutes'
  ) then
    insert into public.admin_security_alerts (actor_user_id, alert_type, severity, metadata)
    values (
      p_actor_user_id,
      'bulk_contact_reveal',
      'warning',
      jsonb_build_object('contactRevealCount', recent_reveals + 1, 'windowMinutes', 10)
    );
  end if;

  select * into client from public.admin_clients where id = appointment.client_id;
  insert into public.admin_audit_log (actor_user_id, action, entity_table, entity_id, metadata)
  values (
    p_actor_user_id,
    'client.contact.reveal',
    'admin_appointments',
    appointment.id,
    jsonb_build_object('purpose', btrim(p_purpose), 'specialist_id', appointment.specialist_id)
  );

  return jsonb_build_object(
    'phone', coalesce(nullif(appointment.public_phone_snapshot, ''), client.phone, ''),
    'email', coalesce(nullif(appointment.public_email_snapshot, ''), client.email, ''),
    'preferredContact', coalesce(appointment.public_contact_preference_snapshot, client.preferred_contact, 'phone')
  );
end;
$$;

comment on function public.admin_reveal_appointment_contact(uuid, text, text) is
  'Owner/administrator-only audited contact access with serialized rate limiting. Specialist accounts are always denied.';
