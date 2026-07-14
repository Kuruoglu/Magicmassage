create or replace function public.admin_save_record_with_audit(
  p_record_type text,
  p_record jsonb,
  p_actor_user_id uuid,
  p_action text,
  p_audit_metadata jsonb
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  entity_id text;
  entity_table text;
begin
  if jsonb_typeof(p_record) is distinct from 'object'
    or jsonb_typeof(p_audit_metadata) is distinct from 'object'
    or p_actor_user_id is null
    or nullif(btrim(p_action), '') is null
  then
    raise exception 'A record, verified actor, audit action, and metadata are required.' using errcode = '22023';
  end if;

  case p_record_type
    when 'client' then
      if p_action <> 'record.client.upsert' then
        raise exception 'Invalid client audit action.' using errcode = '22023';
      end if;
      entity_id := p_record ->> 'id';
      entity_table := 'admin_clients';

      insert into public.admin_clients (
        id, email, full_name, locale, next_visit_label, notes, phone,
        phone_normalized, preferred_contact, status, tags, telegram_url,
        total_spend_label, visit_count
      ) values (
        entity_id,
        p_record ->> 'email',
        p_record ->> 'full_name',
        p_record ->> 'locale',
        p_record ->> 'next_visit_label',
        p_record ->> 'notes',
        p_record ->> 'phone',
        p_record ->> 'phone_normalized',
        p_record ->> 'preferred_contact',
        p_record ->> 'status',
        array(select jsonb_array_elements_text(coalesce(p_record -> 'tags', '[]'::jsonb))),
        p_record ->> 'telegram_url',
        p_record ->> 'total_spend_label',
        (p_record ->> 'visit_count')::integer
      )
      on conflict (id) do update set
        email = excluded.email,
        full_name = excluded.full_name,
        locale = excluded.locale,
        next_visit_label = excluded.next_visit_label,
        notes = excluded.notes,
        phone = excluded.phone,
        phone_normalized = excluded.phone_normalized,
        preferred_contact = excluded.preferred_contact,
        status = excluded.status,
        tags = excluded.tags,
        telegram_url = excluded.telegram_url,
        total_spend_label = excluded.total_spend_label,
        visit_count = excluded.visit_count;

    when 'appointment' then
      if p_action not in (
        'appointment.cancel', 'appointment.create', 'appointment.drag',
        'appointment.post_visit_comment', 'appointment.resize', 'appointment.update'
      ) then
        raise exception 'Invalid appointment audit action.' using errcode = '22023';
      end if;
      entity_id := p_record ->> 'id';
      entity_table := 'admin_appointments';

      insert into public.admin_appointments (
        id, client_id, client_name_snapshot, starts_on, starts_at, service_name,
        status, duration_minutes, buffer_minutes, internal_note, overlap_override,
        overlap_override_reason, overlap_overridden_at, overlap_overridden_by,
        post_visit_comment, post_visit_commented_at, post_visit_commented_by,
        created_by, updated_by
      ) values (
        entity_id,
        p_record ->> 'client_id',
        p_record ->> 'client_name_snapshot',
        (p_record ->> 'starts_on')::date,
        (p_record ->> 'starts_at')::time,
        p_record ->> 'service_name',
        p_record ->> 'status',
        (p_record ->> 'duration_minutes')::integer,
        (p_record ->> 'buffer_minutes')::integer,
        p_record ->> 'internal_note',
        (p_record ->> 'overlap_override')::boolean,
        p_record ->> 'overlap_override_reason',
        nullif(p_record ->> 'overlap_overridden_at', '')::timestamptz,
        nullif(p_record ->> 'overlap_overridden_by', '')::uuid,
        p_record ->> 'post_visit_comment',
        nullif(p_record ->> 'post_visit_commented_at', '')::timestamptz,
        case when btrim(coalesce(p_record ->> 'post_visit_comment', '')) <> '' then p_actor_user_id else null end,
        p_actor_user_id,
        p_actor_user_id
      )
      on conflict (id) do update set
        client_id = excluded.client_id,
        client_name_snapshot = excluded.client_name_snapshot,
        starts_on = excluded.starts_on,
        starts_at = excluded.starts_at,
        service_name = excluded.service_name,
        status = excluded.status,
        duration_minutes = excluded.duration_minutes,
        buffer_minutes = excluded.buffer_minutes,
        internal_note = excluded.internal_note,
        overlap_override = excluded.overlap_override,
        overlap_override_reason = excluded.overlap_override_reason,
        overlap_overridden_at = excluded.overlap_overridden_at,
        overlap_overridden_by = excluded.overlap_overridden_by,
        post_visit_comment = excluded.post_visit_comment,
        post_visit_commented_at = excluded.post_visit_commented_at,
        post_visit_commented_by = excluded.post_visit_commented_by,
        updated_by = p_actor_user_id;

    when 'certificate' then
      if p_action <> 'record.certificate.upsert' then
        raise exception 'Invalid certificate audit action.' using errcode = '22023';
      end if;
      entity_id := p_record ->> 'code';
      entity_table := 'admin_certificates';

      insert into public.admin_certificates (
        code, client_id, client_name_snapshot, buyer_name, recipient_name,
        amount_cents, currency, status, stripe_payment_intent_id, paid_on,
        expires_on, internal_note, history
      ) values (
        entity_id,
        nullif(p_record ->> 'client_id', ''),
        p_record ->> 'client_name_snapshot',
        p_record ->> 'buyer_name',
        p_record ->> 'recipient_name',
        (p_record ->> 'amount_cents')::integer,
        p_record ->> 'currency',
        p_record ->> 'status',
        nullif(p_record ->> 'stripe_payment_intent_id', ''),
        nullif(p_record ->> 'paid_on', '')::date,
        nullif(p_record ->> 'expires_on', '')::date,
        p_record ->> 'internal_note',
        coalesce(p_record -> 'history', '[]'::jsonb)
      )
      on conflict (code) do update set
        client_id = excluded.client_id,
        client_name_snapshot = excluded.client_name_snapshot,
        buyer_name = excluded.buyer_name,
        recipient_name = excluded.recipient_name,
        amount_cents = excluded.amount_cents,
        currency = excluded.currency,
        status = excluded.status,
        stripe_payment_intent_id = excluded.stripe_payment_intent_id,
        paid_on = excluded.paid_on,
        expires_on = excluded.expires_on,
        internal_note = excluded.internal_note,
        history = excluded.history;

    when 'price' then
      if p_action <> 'record.price.upsert' then
        raise exception 'Invalid price audit action.' using errcode = '22023';
      end if;
      entity_id := p_record ->> 'id';
      entity_table := 'admin_price_variants';

      insert into public.admin_price_variants (
        id, service_slug, duration_minutes, price_cents, currency, status,
        display_order, internal_note, updated_on
      ) values (
        entity_id,
        p_record ->> 'service_slug',
        (p_record ->> 'duration_minutes')::integer,
        (p_record ->> 'price_cents')::integer,
        p_record ->> 'currency',
        p_record ->> 'status',
        (p_record ->> 'display_order')::integer,
        p_record ->> 'internal_note',
        (p_record ->> 'updated_on')::date
      )
      on conflict (id) do update set
        service_slug = excluded.service_slug,
        duration_minutes = excluded.duration_minutes,
        price_cents = excluded.price_cents,
        currency = excluded.currency,
        status = excluded.status,
        display_order = excluded.display_order,
        internal_note = excluded.internal_note,
        updated_on = excluded.updated_on;

    when 'media' then
      if p_action <> 'media.asset' then
        raise exception 'Invalid media audit action.' using errcode = '22023';
      end if;
      entity_id := p_record ->> 'id';
      entity_table := 'admin_media_assets';

      insert into public.admin_media_assets (
        id, name, url, folder, media_type, status, alt_text,
        alt_text_localized, dimensions, file_size_label, usage_contexts,
        uploaded_on, publication_consent_status
      ) values (
        entity_id,
        p_record ->> 'name',
        p_record ->> 'url',
        p_record ->> 'folder',
        p_record ->> 'media_type',
        p_record ->> 'status',
        p_record ->> 'alt_text',
        coalesce(p_record -> 'alt_text_localized', '{}'::jsonb),
        p_record ->> 'dimensions',
        p_record ->> 'file_size_label',
        array(select jsonb_array_elements_text(coalesce(p_record -> 'usage_contexts', '[]'::jsonb))),
        (p_record ->> 'uploaded_on')::date,
        p_record ->> 'publication_consent_status'
      )
      on conflict (id) do update set
        name = excluded.name,
        url = excluded.url,
        folder = excluded.folder,
        media_type = excluded.media_type,
        status = excluded.status,
        alt_text = excluded.alt_text,
        alt_text_localized = excluded.alt_text_localized,
        dimensions = excluded.dimensions,
        file_size_label = excluded.file_size_label,
        usage_contexts = excluded.usage_contexts,
        uploaded_on = excluded.uploaded_on,
        publication_consent_status = excluded.publication_consent_status;

    when 'contactChannel' then
      if p_action <> 'record.contactChannel.upsert' then
        raise exception 'Invalid contact-channel audit action.' using errcode = '22023';
      end if;
      entity_id := p_record ->> 'id';
      entity_table := 'admin_contact_channels';

      insert into public.admin_contact_channels (
        id, name, channel_type, value, status, usage_contexts, internal_note
      ) values (
        entity_id,
        p_record ->> 'name',
        p_record ->> 'channel_type',
        p_record ->> 'value',
        p_record ->> 'status',
        array(select jsonb_array_elements_text(coalesce(p_record -> 'usage_contexts', '[]'::jsonb))),
        p_record ->> 'internal_note'
      )
      on conflict (id) do update set
        name = excluded.name,
        channel_type = excluded.channel_type,
        value = excluded.value,
        status = excluded.status,
        usage_contexts = excluded.usage_contexts,
        internal_note = excluded.internal_note;

    when 'contactSettings' then
      if p_action <> 'record.contactSettings.upsert' then
        raise exception 'Invalid contact-settings audit action.' using errcode = '22023';
      end if;
      entity_id := p_record ->> 'id';
      entity_table := 'admin_contact_settings';

      insert into public.admin_contact_settings (
        id, business_name, phone, email, address, working_hours,
        booking_url, map_url, seo_area
      ) values (
        entity_id,
        p_record ->> 'business_name',
        p_record ->> 'phone',
        p_record ->> 'email',
        p_record ->> 'address',
        p_record ->> 'working_hours',
        p_record ->> 'booking_url',
        p_record ->> 'map_url',
        p_record ->> 'seo_area'
      )
      on conflict (id) do update set
        business_name = excluded.business_name,
        phone = excluded.phone,
        email = excluded.email,
        address = excluded.address,
        working_hours = excluded.working_hours,
        booking_url = excluded.booking_url,
        map_url = excluded.map_url,
        seo_area = excluded.seo_area;

    when 'settings' then
      if p_action <> 'site.gift_certificates' then
        raise exception 'Invalid settings audit action.' using errcode = '22023';
      end if;
      entity_id := p_record ->> 'id';
      entity_table := 'admin_site_settings';

      insert into public.admin_site_settings (
        id, audit_log_retention_days, booking_buffer_minutes, business_name,
        cookie_privacy_mode, currency, daily_slot_capacity, default_locale,
        default_seo_title, email_sender, google_calendar_id,
        google_calendar_mode, gift_certificates_enabled, reminder_template,
        roles_policy, stripe_mode, timezone, updated_on, working_days,
        working_hours
      ) values (
        entity_id,
        (p_record ->> 'audit_log_retention_days')::integer,
        (p_record ->> 'booking_buffer_minutes')::integer,
        p_record ->> 'business_name',
        p_record ->> 'cookie_privacy_mode',
        p_record ->> 'currency',
        (p_record ->> 'daily_slot_capacity')::integer,
        p_record ->> 'default_locale',
        p_record ->> 'default_seo_title',
        p_record ->> 'email_sender',
        p_record ->> 'google_calendar_id',
        p_record ->> 'google_calendar_mode',
        (p_record ->> 'gift_certificates_enabled')::boolean,
        p_record ->> 'reminder_template',
        p_record ->> 'roles_policy',
        p_record ->> 'stripe_mode',
        p_record ->> 'timezone',
        (p_record ->> 'updated_on')::date,
        p_record ->> 'working_days',
        p_record ->> 'working_hours'
      )
      on conflict (id) do update set
        audit_log_retention_days = excluded.audit_log_retention_days,
        booking_buffer_minutes = excluded.booking_buffer_minutes,
        business_name = excluded.business_name,
        cookie_privacy_mode = excluded.cookie_privacy_mode,
        currency = excluded.currency,
        daily_slot_capacity = excluded.daily_slot_capacity,
        default_locale = excluded.default_locale,
        default_seo_title = excluded.default_seo_title,
        email_sender = excluded.email_sender,
        google_calendar_id = excluded.google_calendar_id,
        google_calendar_mode = excluded.google_calendar_mode,
        gift_certificates_enabled = excluded.gift_certificates_enabled,
        reminder_template = excluded.reminder_template,
        roles_policy = excluded.roles_policy,
        stripe_mode = excluded.stripe_mode,
        timezone = excluded.timezone,
        updated_on = excluded.updated_on,
        working_days = excluded.working_days,
        working_hours = excluded.working_hours;

    else
      raise exception 'Unsupported admin record type.' using errcode = '22023';
  end case;

  if nullif(btrim(entity_id), '') is null then
    raise exception 'A record identifier is required.' using errcode = '22023';
  end if;

  insert into public.admin_audit_log (
    actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_actor_user_id, p_action, entity_table, entity_id, p_audit_metadata
  );
end;
$$;

create or replace function public.admin_replace_media_placement_with_audit(
  p_placement_id uuid,
  p_media_asset_id text,
  p_is_published boolean,
  p_actor_user_id uuid,
  p_actor_role text
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  placement jsonb;
begin
  if p_actor_user_id is null or nullif(btrim(p_actor_role), '') is null then
    raise exception 'A verified actor is required.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.admin_media_assets media
    where media.id = p_media_asset_id
      and media.media_type = 'photo'
      and media.status = 'ready'
      and btrim(media.alt_text) <> ''
      and media.publication_consent_status in ('granted', 'not_required')
  ) then
    raise exception 'Media is not publication-ready.' using errcode = '23514';
  end if;

  update public.admin_media_placements target
  set
    media_asset_id = p_media_asset_id,
    is_published = coalesce(p_is_published, target.is_published),
    updated_at = now()
  where target.id = p_placement_id
  returning to_jsonb(target) into placement;

  if placement is null then
    raise exception 'Media placement not found.' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log (
    actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_actor_user_id,
    'media_placement.replace',
    'admin_media_placements',
    p_placement_id::text,
    jsonb_build_object(
      'is_published', p_is_published,
      'media_asset_id', p_media_asset_id,
      'role', p_actor_role
    )
  );

  return placement;
end;
$$;

revoke all on function public.admin_save_record_with_audit(text, jsonb, uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.admin_replace_media_placement_with_audit(uuid, text, boolean, uuid, text)
  from public, anon, authenticated;

grant execute on function public.admin_save_record_with_audit(text, jsonb, uuid, text, jsonb)
  to service_role;
grant execute on function public.admin_replace_media_placement_with_audit(uuid, text, boolean, uuid, text)
  to service_role;
