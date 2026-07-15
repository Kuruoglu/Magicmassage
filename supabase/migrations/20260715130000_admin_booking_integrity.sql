-- Serialize every scheduling write by local date and keep public provenance immutable.

create or replace function public.admin_prepare_appointment_write()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  first_lock_date date;
  second_lock_date date;
  override_changed boolean;
  slot_range tsrange;
begin
  if tg_op = 'UPDATE' then
    first_lock_date := least(old.starts_on, new.starts_on);
    second_lock_date := greatest(old.starts_on, new.starts_on);

    if old.origin = 'public' and (
      new.service_name is distinct from old.service_name
      or new.duration_minutes is distinct from old.duration_minutes
      or new.buffer_minutes is distinct from old.buffer_minutes
      or new.price_cents_snapshot is distinct from old.price_cents_snapshot
      or new.currency_snapshot is distinct from old.currency_snapshot
      or new.origin is distinct from old.origin
      or new.locale is distinct from old.locale
      or new.public_reference is distinct from old.public_reference
      or new.public_booking_hold_id is distinct from old.public_booking_hold_id
      or new.public_booking_idempotency_key_hash is distinct from old.public_booking_idempotency_key_hash
      or new.service_slug is distinct from old.service_slug
      or new.price_variant_id is distinct from old.price_variant_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'public_appointment_immutable';
    end if;

    if new.origin is distinct from old.origin then
      raise exception using
        errcode = '23514',
        message = 'appointment_origin_immutable';
    end if;
  else
    first_lock_date := new.starts_on;
    second_lock_date := new.starts_on;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('public-booking:' || first_lock_date::text, 0)
  );
  if second_lock_date <> first_lock_date then
    perform pg_advisory_xact_lock(
      hashtextextended('public-booking:' || second_lock_date::text, 0)
    );
  end if;

  slot_range := tsrange(
    new.starts_on + new.starts_at,
    new.starts_on + new.starts_at
      + make_interval(mins => new.duration_minutes + new.buffer_minutes),
    '[)'
  );

  if new.status in ('confirmed', 'pending', 'request') and exists (
    select 1
    from public.admin_calendar_blocks block
    where block.block_date = new.starts_on
      and slot_range && tsrange(
        block.block_date + block.starts_at,
        block.block_date + block.ends_at,
        '[)'
      )
  ) then
    raise exception using
      errcode = '23P01',
      message = 'appointment_calendar_block_conflict';
  end if;

  if tg_op = 'INSERT' then
    new.version := greatest(coalesce(new.version, 1), 1);
    new.updated_at := coalesce(new.updated_at, now());
    new.updated_by := coalesce(auth.uid(), new.updated_by, new.created_by);
    override_changed := new.overlap_override;
  else
    new.version := old.version + 1;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), new.updated_by, old.updated_by);
    override_changed := new.overlap_override
      and (
        not old.overlap_override
        or new.overlap_override_reason is distinct from old.overlap_override_reason
      );
  end if;

  if override_changed then
    if not public.admin_can_manage_operations()
      and current_user not in ('postgres', 'service_role', 'supabase_admin') then
      raise exception using
        errcode = '42501',
        message = 'Only owner or administrator roles may authorize appointment overlaps.';
    end if;

    if btrim(new.overlap_override_reason) = '' then
      raise exception using
        errcode = '23514',
        message = 'An overlap override reason is required.';
    end if;

    new.overlap_overridden_at := now();
    new.overlap_overridden_by := coalesce(auth.uid(), new.overlap_overridden_by);
  elsif not new.overlap_override then
    new.overlap_override_reason := '';
    new.overlap_overridden_at := null;
    new.overlap_overridden_by := null;
  end if;

  if btrim(new.post_visit_comment) <> ''
    and (
      tg_op = 'INSERT'
      or new.post_visit_comment is distinct from old.post_visit_comment
    ) then
    new.post_visit_commented_at := now();
    new.post_visit_commented_by := coalesce(auth.uid(), new.post_visit_commented_by);
  elsif btrim(new.post_visit_comment) = '' then
    new.post_visit_commented_at := null;
    new.post_visit_commented_by := null;
  end if;

  return new;
end;
$$;

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
      and current_appointment.starts_on is distinct from observed_starts_on
    ) then
    raise exception using errcode = '40001', message = 'appointment_concurrent_update';
  end if;

  effective_duration_minutes := case
    when current_exists and current_appointment.origin = 'public'
      then current_appointment.duration_minutes
    else requested_duration_minutes
  end;
  effective_buffer_minutes := case
    when current_exists and current_appointment.origin = 'public'
      then current_appointment.buffer_minutes
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
    raise exception using
      errcode = '23P01',
      message = 'appointment_calendar_block_conflict';
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
end;
$$;

create or replace function public.admin_mutate_calendar_block(
  p_action text,
  p_block_id uuid,
  p_block_date date,
  p_starts_at time without time zone,
  p_ends_at time without time zone,
  p_kind text,
  p_internal_note text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public
as $$
declare
  audit_action text;
  block_exists boolean;
  block_id uuid;
  block_range tsrange;
  existing_block public.admin_calendar_blocks%rowtype;
  first_lock_date date;
  observed_block_date date;
  saved_block public.admin_calendar_blocks%rowtype;
  second_lock_date date;
begin
  if p_action is null
    or p_action not in ('upsert', 'delete')
    or p_actor_user_id is null
    or not exists (
      select 1
      from public.admin_profiles profile
      where profile.user_id = p_actor_user_id
        and profile.status = 'active'
        and profile.role::text in ('owner', 'administrator', 'specialist')
    ) then
    raise exception using errcode = '42501', message = 'calendar_block_forbidden';
  end if;

  if p_action = 'delete' then
    if p_block_id is null then
      raise exception using errcode = '22023', message = 'invalid_calendar_block';
    end if;

    select block_date into observed_block_date
    from public.admin_calendar_blocks
    where id = p_block_id;

    if not found then
      raise exception using errcode = 'P0002', message = 'calendar_block_not_found';
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended('public-booking:' || observed_block_date::text, 0)
    );

    select * into existing_block
    from public.admin_calendar_blocks
    where id = p_block_id
    for update;

    if not found or existing_block.block_date is distinct from observed_block_date then
      raise exception using errcode = '40001', message = 'calendar_block_concurrent_update';
    end if;

    delete from public.admin_calendar_blocks where id = p_block_id;

    insert into public.admin_audit_log (
      actor_user_id,
      action,
      entity_table,
      entity_id,
      metadata
    ) values (
      p_actor_user_id,
      'calendar_block.delete',
      'admin_calendar_blocks',
      p_block_id::text,
      jsonb_build_object(
        'block_date', existing_block.block_date,
        'starts_at', existing_block.starts_at,
        'ends_at', existing_block.ends_at,
        'kind', existing_block.kind
      )
    );

    return jsonb_build_object('deleted', true, 'id', p_block_id);
  end if;

  if p_block_date is null
    or p_starts_at is null
    or p_ends_at is null
    or p_starts_at >= p_ends_at
    or p_kind is null
    or p_kind not in ('personal', 'unavailable', 'other')
    or char_length(coalesce(p_internal_note, '')) > 2000 then
    raise exception using errcode = '22023', message = 'invalid_calendar_block';
  end if;

  block_id := coalesce(p_block_id, gen_random_uuid());
  select block_date into observed_block_date
  from public.admin_calendar_blocks
  where id = block_id;
  block_exists := found;

  first_lock_date := case
    when block_exists then least(observed_block_date, p_block_date)
    else p_block_date
  end;
  second_lock_date := case
    when block_exists then greatest(observed_block_date, p_block_date)
    else p_block_date
  end;

  perform pg_advisory_xact_lock(
    hashtextextended('public-booking:' || first_lock_date::text, 0)
  );
  if second_lock_date <> first_lock_date then
    perform pg_advisory_xact_lock(
      hashtextextended('public-booking:' || second_lock_date::text, 0)
    );
  end if;

  select * into existing_block
  from public.admin_calendar_blocks
  where id = block_id
  for update;

  if block_exists and (
    not found or existing_block.block_date is distinct from observed_block_date
  ) then
    raise exception using errcode = '40001', message = 'calendar_block_concurrent_update';
  elsif not block_exists and found then
    raise exception using errcode = '40001', message = 'calendar_block_concurrent_update';
  end if;

  audit_action := case when block_exists then 'calendar_block.update' else 'calendar_block.create' end;
  block_range := tsrange(p_block_date + p_starts_at, p_block_date + p_ends_at, '[)');

  if exists (
    select 1
    from public.admin_appointments appointment
    where appointment.starts_on = p_block_date
      and appointment.status in ('confirmed', 'pending', 'request')
      and block_range && tsrange(
        appointment.starts_on + appointment.starts_at,
        appointment.starts_on + appointment.starts_at
          + make_interval(mins => appointment.duration_minutes + appointment.buffer_minutes),
        '[)'
      )
  ) or exists (
    select 1
    from public.admin_calendar_blocks other_block
    where other_block.id <> block_id
      and other_block.block_date = p_block_date
      and block_range && tsrange(
        other_block.block_date + other_block.starts_at,
        other_block.block_date + other_block.ends_at,
        '[)'
      )
  ) then
    raise exception using errcode = '23P01', message = 'calendar_block_conflict';
  end if;

  insert into public.admin_calendar_blocks (
    id,
    block_date,
    starts_at,
    ends_at,
    kind,
    internal_note,
    created_by,
    updated_by
  ) values (
    block_id,
    p_block_date,
    p_starts_at,
    p_ends_at,
    p_kind,
    coalesce(p_internal_note, ''),
    p_actor_user_id,
    p_actor_user_id
  )
  on conflict (id) do update
  set
    block_date = excluded.block_date,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    kind = excluded.kind,
    internal_note = excluded.internal_note,
    updated_by = p_actor_user_id
  returning * into saved_block;

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    p_actor_user_id,
    audit_action,
    'admin_calendar_blocks',
    saved_block.id::text,
    jsonb_build_object(
      'block_date', saved_block.block_date,
      'starts_at', saved_block.starts_at,
      'ends_at', saved_block.ends_at,
      'kind', saved_block.kind
    )
  );

  return to_jsonb(saved_block);
end;
$$;

revoke all on function public.admin_prepare_appointment_write() from public;
revoke all on function public.admin_save_appointment_with_audit(jsonb, uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.admin_mutate_calendar_block(text, uuid, date, time without time zone, time without time zone, text, text, uuid)
  from public, anon, authenticated;

grant execute on function public.admin_save_appointment_with_audit(jsonb, uuid, text, jsonb)
  to service_role;
grant execute on function public.admin_mutate_calendar_block(text, uuid, date, time without time zone, time without time zone, text, text, uuid)
  to service_role;
