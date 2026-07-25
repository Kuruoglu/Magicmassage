create or replace function public.admin_delete_record_with_audit(
  p_record_type text,
  p_record_id text,
  p_actor_user_id uuid,
  p_audit_metadata jsonb default '{}'::jsonb,
  p_expected_version integer default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_role text;
  appointment_snapshot jsonb;
  client_snapshot jsonb;
  linked_appointment_count integer := 0;
  linked_certificate_count integer := 0;
  current_appointment_version integer;
begin
  if p_record_type not in ('appointment', 'client')
    or p_record_id is null
    or btrim(p_record_id) = '' then
    raise exception using errcode = '22023', message = 'invalid_delete_record';
  end if;

  if p_audit_metadata is null or jsonb_typeof(p_audit_metadata) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_audit_metadata';
  end if;

  select profile.role
  into actor_role
  from public.admin_profiles profile
  where profile.user_id = p_actor_user_id
    and profile.status = 'active'
    and profile.role in ('owner', 'administrator');

  if actor_role is null then
    raise exception using errcode = '42501', message = 'forbidden';
  end if;

  if p_record_type = 'appointment' then
    if p_expected_version is null or p_expected_version <= 0 then
      raise exception using errcode = '22023', message = 'invalid_appointment_version';
    end if;

    select jsonb_build_object(
      'clientId', appointment.client_id,
      'date', appointment.starts_on,
      'origin', coalesce(appointment.origin, 'manual'),
      'service', appointment.service_name,
      'status', appointment.status,
      'time', appointment.starts_at,
      'version', appointment.version
    ), appointment.version
    into appointment_snapshot, current_appointment_version
    from public.admin_appointments appointment
    where appointment.id = p_record_id
    for update;

    if appointment_snapshot is null then
      raise exception using errcode = 'P0002', message = 'record_not_found';
    end if;

    if current_appointment_version <> p_expected_version then
      raise exception using errcode = '40001', message = 'appointment_concurrent_update';
    end if;

    update public.email_notifications notification
    set status = 'cancelled',
      terminal_at = now(),
      updated_at = now(),
      last_error_summary = 'appointment_deleted',
      lease_token = null,
      leased_at = null,
      lease_expires_at = null
    where notification.aggregate_type = 'appointment'
      and notification.aggregate_id = p_record_id
      and notification.status = 'pending';

    if exists (
      select 1
      from public.email_notifications notification
      where notification.aggregate_type = 'appointment'
        and notification.aggregate_id = p_record_id
        and notification.status = 'processing'
    ) then
      raise exception using errcode = '55000', message = 'appointment_email_delivery_in_progress';
    end if;

    delete from public.admin_appointments where id = p_record_id;

    insert into public.admin_audit_log (
      actor_user_id,
      action,
      entity_table,
      entity_id,
      metadata
    ) values (
      p_actor_user_id,
      'appointment.delete',
      'admin_appointments',
      p_record_id,
      p_audit_metadata || jsonb_build_object('deletedRecord', appointment_snapshot)
    );
  else
    select jsonb_build_object(
      'locale', client.locale,
      'status', client.status,
      'visitCount', client.visit_count
    )
    into client_snapshot
    from public.admin_clients client
    where client.id = p_record_id
    for update;

    if client_snapshot is null then
      raise exception using errcode = 'P0002', message = 'record_not_found';
    end if;

    select count(*)::integer
    into linked_appointment_count
    from public.admin_appointments appointment
    where appointment.client_id = p_record_id;

    if linked_appointment_count > 0 then
      raise exception using errcode = '23503', message = 'client_has_appointments';
    end if;

    select count(*)::integer
    into linked_certificate_count
    from public.admin_certificates certificate
    where certificate.client_id = p_record_id;

    delete from public.admin_clients where id = p_record_id;

    insert into public.admin_audit_log (
      actor_user_id,
      action,
      entity_table,
      entity_id,
      metadata
    ) values (
      p_actor_user_id,
      'client.delete',
      'admin_clients',
      p_record_id,
      p_audit_metadata || jsonb_build_object(
        'deletedRecord', client_snapshot,
        'detachedCertificateCount', linked_certificate_count
      )
    );
  end if;
end;
$$;

revoke all on function public.admin_delete_record_with_audit(text, text, uuid, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.admin_delete_record_with_audit(text, text, uuid, jsonb, integer)
  to service_role;
