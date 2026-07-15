-- Keep domain conflicts distinct from the appointment exclusion constraint.

create or replace function public.admin_save_appointment_with_audit(
  p_record jsonb,
  p_actor_user_id uuid,
  p_action text,
  p_audit_metadata jsonb
)
returns void
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  actor_role text;
  appointment_id text;
  current_appointment public.admin_appointments%rowtype;
  current_exists boolean;
  effective_buffer_minutes integer;
  effective_duration_minutes integer;
  effective_service_name text;
  first_lock_date date;
  observed_exists boolean;
  observed_starts_on date;
  requested_buffer_minutes integer;
  requested_duration_minutes integer;
  requested_starts_at time without time zone;
  requested_starts_on date;
  requested_status text;
  requested_version integer;
  second_lock_date date;
  slot_range tsrange;
begin
  if jsonb_typeof(p_record) is distinct from 'object'
    or jsonb_typeof(p_audit_metadata) is distinct from 'object'
    or p_actor_user_id is null
    or p_action not in (
      'appointment.cancel', 'appointment.create', 'appointment.drag',
      'appointment.post_visit_comment', 'appointment.resize', 'appointment.update'
    ) then
    raise exception using errcode = '22023', message = 'invalid_admin_appointment';
  end if;

  select profile.role::text into actor_role
  from public.admin_profiles profile
  where profile.user_id = p_actor_user_id
    and profile.status = 'active'
    and profile.role::text in ('owner', 'administrator', 'specialist');

  if not found then
    raise exception using errcode = '42501', message = 'appointment_forbidden';
  end if;

  if coalesce((p_record ->> 'overlap_override')::boolean, false)
    and actor_role not in ('owner', 'administrator') then
    raise exception using errcode = '42501', message = 'appointment_overlap_forbidden';
  end if;

  appointment_id := p_record ->> 'id';
  requested_starts_on := (p_record ->> 'starts_on')::date;
  requested_starts_at := (p_record ->> 'starts_at')::time;
  requested_duration_minutes := (p_record ->> 'duration_minutes')::integer;
  requested_buffer_minutes := (p_record ->> 'buffer_minutes')::integer;
  requested_status := p_record ->> 'status';
  requested_version := nullif(p_record ->> 'version', '')::integer;

  if nullif(btrim(appointment_id), '') is null
    or requested_starts_on is null
    or requested_starts_at is null
    or requested_duration_minutes <= 0
    or requested_buffer_minutes < 0
    or requested_status not in ('confirmed', 'pending', 'request', 'cancelled', 'completed', 'no_show') then
    raise exception using errcode = '22023', message = 'invalid_admin_appointment';
  end if;

  select appointment.starts_on into observed_starts_on
  from public.admin_appointments appointment
  where appointment.id = appointment_id;
  observed_exists := found;

  first_lock_date := case
    when observed_exists then least(observed_starts_on, requested_starts_on)
    else requested_starts_on
  end;
  second_lock_date := case
    when observed_exists then greatest(observed_starts_on, requested_starts_on)
    else requested_starts_on
  end;

  perform pg_advisory_xact_lock(
    hashtextextended('public-booking:' || first_lock_date::text, 0)
  );
  if second_lock_date <> first_lock_date then
    perform pg_advisory_xact_lock(
      hashtextextended('public-booking:' || second_lock_date::text, 0)
    );
  end if;

  select * into current_appointment
  from public.admin_appointments appointment
  where appointment.id = appointment_id
  for update;
  current_exists := found;

  if current_exists is distinct from observed_exists
    or (
      current_exists
      and (
        current_appointment.starts_on is distinct from observed_starts_on
        or requested_version is null
        or requested_version <> current_appointment.version
      )
    )
    or (not current_exists and requested_version is not null) then
    raise exception using errcode = 'P0001', message = 'appointment_concurrent_update';
  end if;

  effective_duration_minutes := case
    when current_exists and current_appointment.origin = 'public'
      then current_appointment.duration_minutes
    else requested_duration_minutes
  end;
  effective_buffer_minutes := case
    when current_exists then current_appointment.buffer_minutes
    else requested_buffer_minutes
  end;
  effective_service_name := case
    when current_exists and current_appointment.origin = 'public'
      then current_appointment.service_name
    else p_record ->> 'service_name'
  end;

  slot_range := tsrange(
    requested_starts_on + requested_starts_at,
    requested_starts_on + requested_starts_at
      + make_interval(mins => effective_duration_minutes + effective_buffer_minutes),
    '[)'
  );

  if requested_status in ('confirmed', 'pending', 'request') and exists (
    select 1
    from public.admin_calendar_blocks block
    where block.block_date = requested_starts_on
      and slot_range && tsrange(
        block.block_date + block.starts_at,
        block.block_date + block.ends_at,
        '[)'
      )
  ) then
    raise exception using errcode = 'P0001', message = 'appointment_calendar_block_conflict';
  end if;

  if requested_status in ('confirmed', 'pending', 'request') and exists (
    select 1
    from public.public_booking_holds hold
    where hold.starts_on = requested_starts_on
      and hold.status = 'active'
      and hold.expires_at > now()
      and slot_range && tsrange(
        hold.starts_on + hold.starts_at,
        hold.starts_on + hold.starts_at
          + make_interval(mins => hold.duration_minutes + hold.buffer_minutes),
        '[)'
      )
  ) then
    raise exception using errcode = 'P0001', message = 'appointment_public_hold_conflict';
  end if;

  if current_exists then
    update public.admin_appointments appointment
    set
      client_id = p_record ->> 'client_id',
      client_name_snapshot = p_record ->> 'client_name_snapshot',
      starts_on = requested_starts_on,
      starts_at = requested_starts_at,
      service_name = effective_service_name,
      status = requested_status,
      duration_minutes = effective_duration_minutes,
      buffer_minutes = effective_buffer_minutes,
      internal_note = p_record ->> 'internal_note',
      overlap_override = (p_record ->> 'overlap_override')::boolean,
      overlap_override_reason = p_record ->> 'overlap_override_reason',
      overlap_overridden_at = nullif(p_record ->> 'overlap_overridden_at', '')::timestamptz,
      overlap_overridden_by = nullif(p_record ->> 'overlap_overridden_by', '')::uuid,
      post_visit_comment = p_record ->> 'post_visit_comment',
      post_visit_commented_at = nullif(p_record ->> 'post_visit_commented_at', '')::timestamptz,
      post_visit_commented_by = case
        when btrim(coalesce(p_record ->> 'post_visit_comment', '')) <> '' then p_actor_user_id
        else null
      end,
      updated_by = p_actor_user_id
    where appointment.id = appointment_id;
  else
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
      overlap_override,
      overlap_override_reason,
      overlap_overridden_at,
      overlap_overridden_by,
      post_visit_comment,
      post_visit_commented_at,
      post_visit_commented_by,
      created_by,
      updated_by,
      origin
    ) values (
      appointment_id,
      p_record ->> 'client_id',
      p_record ->> 'client_name_snapshot',
      requested_starts_on,
      requested_starts_at,
      p_record ->> 'service_name',
      requested_status,
      requested_duration_minutes,
      requested_buffer_minutes,
      p_record ->> 'internal_note',
      (p_record ->> 'overlap_override')::boolean,
      p_record ->> 'overlap_override_reason',
      nullif(p_record ->> 'overlap_overridden_at', '')::timestamptz,
      nullif(p_record ->> 'overlap_overridden_by', '')::uuid,
      p_record ->> 'post_visit_comment',
      nullif(p_record ->> 'post_visit_commented_at', '')::timestamptz,
      case
        when btrim(coalesce(p_record ->> 'post_visit_comment', '')) <> '' then p_actor_user_id
        else null
      end,
      p_actor_user_id,
      p_actor_user_id,
      'admin'
    );
  end if;

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    p_actor_user_id,
    p_action,
    'admin_appointments',
    appointment_id,
    p_audit_metadata
  );
exception
  when exclusion_violation then
    raise exception using errcode = '23P01', message = 'appointment_overlap_conflict';
end;
$$;

revoke all on function public.admin_save_appointment_with_audit(jsonb, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_save_appointment_with_audit(jsonb, uuid, text, jsonb)
  to service_role;
