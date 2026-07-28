-- Repair schema drift left by development-time revisions to the email migrations.
-- The original migration versions are already present in remote history, so this
-- additive migration restores only the missing column, constraint, function bodies,
-- and least-privilege grants. It is safe to re-run inside a transaction.

alter table public.admin_clients
  add column if not exists care_email_consent_email_hash text;

update public.admin_clients
set care_email_consent_email_hash = public.email_address_hash(email)
where care_email_consent_at is not null
  and care_email_consent_email_hash is null
  and nullif(btrim(email), '') is not null;

update public.admin_clients
set care_email_consent_at = null,
  care_email_consent_source = null,
  care_email_consent_email_hash = null,
  care_email_withdrawn_at = coalesce(care_email_withdrawn_at, now())
where care_email_consent_at is not null
  and nullif(btrim(email), '') is null;

alter table public.admin_clients
  drop constraint if exists admin_clients_care_email_consent_shape_check;

alter table public.admin_clients
  add constraint admin_clients_care_email_consent_shape_check check (
    (
      care_email_consent_at is null
      and care_email_consent_source is null
      and care_email_consent_email_hash is null
    )
    or (
      care_email_consent_at is not null
      and care_email_consent_source is not null
      and care_email_consent_email_hash ~ '^[a-f0-9]{64}$'
    )
  );

create or replace function public.email_claim_notifications(
  p_batch_size integer default 25,
  p_lease_seconds integer default 120
)
returns setof public.email_notifications
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_batch_size not between 1 and 25 or p_lease_seconds not between 30 and 1800 then
    raise exception using errcode = '22023', message = 'invalid_email_claim';
  end if;

  update public.email_notifications notification
  set status = 'suppressed', provider_status = 'suppressed', terminal_at = now(),
    updated_at = now(), lease_token = null, leased_at = null, lease_expires_at = null
  where notification.status = 'pending'
    and notification.recipient_email is not null
    and exists (
      select 1 from public.email_suppressions suppression
      where suppression.email_hash = public.email_address_hash(notification.recipient_email)
        and suppression.cleared_at is null
    );

  update public.email_notifications notification
  set status = 'failed', terminal_at = now(), updated_at = now(),
    last_error_summary = coalesce(notification.last_error_summary, 'lease_expired_after_final_attempt'),
    lease_token = null, leased_at = null, lease_expires_at = null
  where notification.status = 'processing'
    and notification.lease_expires_at <= now()
    and notification.attempt_count >= 9;

  return query
  with candidates as (
    select notification.id
    from public.email_notifications notification
    where (
      notification.status = 'pending'
      or (
        notification.status = 'processing'
        and notification.lease_expires_at <= now()
      )
    )
      and notification.due_at <= now()
      and notification.attempt_count < 9
      and notification.recipient_email is not null
    order by notification.due_at, notification.created_at
    for update skip locked
    limit p_batch_size
  )
  update public.email_notifications notification
  set status = 'processing', attempt_count = notification.attempt_count + 1,
    lease_token = gen_random_uuid(), leased_at = now(),
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    updated_at = now()
  from candidates
  where notification.id = candidates.id
  returning notification.*;
end;
$$;

create or replace function public.email_prepare_claimed_notification(
  p_notification_id uuid,
  p_lease_token uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  notification public.email_notifications%rowtype;
  appointment public.admin_appointments%rowtype;
  client public.admin_clients%rowtype;
  settings public.admin_site_settings%rowtype;
  contact public.admin_contact_settings%rowtype;
  is_valid boolean := true;
  local_start timestamptz;
  gift_status text;
  gift_delivery_mode text;
  gift_buyer_email text;
  gift_recipient_email text;
  gift_order_id uuid;
  current_recipient text;
  recipient_is_current boolean := true;
  schedule_is_current boolean := true;
begin
  select * into notification
  from public.email_notifications
  where id = p_notification_id and status = 'processing' and lease_token = p_lease_token
  for update;
  if not found then return jsonb_build_object('valid', false); end if;

  select * into settings from public.admin_site_settings where id = 'site';
  select * into contact from public.admin_contact_settings where id = 'site';

  if notification.aggregate_type = 'appointment' then
    select * into appointment from public.admin_appointments where id = notification.aggregate_id;
    if not found then
      is_valid := false;
    else
      select * into client from public.admin_clients where id = appointment.client_id;
      if notification.event_type <> 'owner_new_public_booking' then
        current_recipient := public.email_current_appointment_recipient(appointment.id);
        recipient_is_current := current_recipient is not null
          and lower(notification.recipient_email) = current_recipient;
        schedule_is_current := coalesce(
          notification.payload ->> 'date' = appointment.starts_on::text
          and notification.payload ->> 'time' = to_char(appointment.starts_at, 'HH24:MI'),
          false
        );
      end if;
      local_start := (appointment.starts_on + appointment.starts_at) at time zone 'Europe/Sofia';
      is_valid := case notification.event_type
        when 'booking_confirmed' then settings.booking_customer_emails_enabled
          and appointment.status = 'confirmed' and schedule_is_current
        when 'booking_rescheduled' then settings.booking_customer_emails_enabled
          and appointment.status = 'confirmed' and schedule_is_current
        when 'booking_cancelled' then settings.booking_customer_emails_enabled
          and appointment.status = 'cancelled' and schedule_is_current
        when 'booking_reminder_24h' then settings.booking_customer_emails_enabled
          and appointment.customer_email_notifications_enabled and appointment.status = 'confirmed'
          and schedule_is_current
          and local_start > now()
          and now() <= notification.due_at + interval '30 minutes'
        when 'booking_care' then settings.care_emails_enabled and appointment.status = 'completed'
          and schedule_is_current
          and client.care_email_consent_at is not null and client.care_email_withdrawn_at is null
          and client.care_email_consent_email_hash = public.email_address_hash(notification.recipient_email)
          and settings.email_review_url ~* '^https://'
        when 'owner_new_public_booking' then settings.owner_notifications_enabled
          and appointment.origin = 'public' and appointment.status = 'confirmed'
        else false
      end;
    end if;
  elsif notification.aggregate_type = 'certificate' then
    begin
      gift_order_id := (notification.payload ->> 'gift_order_id')::uuid;
      execute 'select status, delivery_mode, lower(purchaser_email), lower(recipient_email) '
        || 'from public.gift_certificate_orders where id = $1'
        into gift_status, gift_delivery_mode, gift_buyer_email, gift_recipient_email
        using gift_order_id;
      is_valid := coalesce(gift_status in ('paid', 'fulfilled', 'fulfillment_failed') and case notification.event_type
        when 'gift_buyer' then lower(notification.recipient_email) = gift_buyer_email
        when 'gift_recipient' then gift_delivery_mode = 'recipient_email'
          and gift_recipient_email is not null
          and lower(notification.recipient_email) = gift_recipient_email
        when 'owner_gift_purchase' then settings.owner_notifications_enabled
          and lower(notification.recipient_email) = lower(settings.owner_notification_email)
        else false
      end, false);
    exception when invalid_text_representation or undefined_column then
      is_valid := false;
    end;
  else
    is_valid := false;
  end if;

  if notification.event_type = 'booking_reminder_24h'
    and now() > notification.due_at + interval '30 minutes' then
    update public.email_notifications
    set last_error_summary = 'reminder_delivery_window_expired', updated_at = now()
    where id = notification.id;
  end if;

  if is_valid and not recipient_is_current then
    update public.email_notifications
    set status = 'cancelled', terminal_at = now(), updated_at = now(),
      last_error_summary = 'recipient_address_changed',
      lease_token = null, leased_at = null, lease_expires_at = null
    where id = notification.id;

    if nullif(current_recipient, '') is not null then
      insert into public.email_notifications (
        event_type, aggregate_type, aggregate_id, event_version, dedupe_key,
        recipient_email, locale, template_key, template_version, payload, due_at
      ) values (
        notification.event_type, notification.aggregate_type, notification.aggregate_id,
        notification.event_version + 1,
        'recipient-replacement:' || notification.id || ':' || left(public.email_address_hash(current_recipient), 16),
        current_recipient, notification.locale, notification.template_key,
        notification.template_version, notification.payload, now()
      ) on conflict (dedupe_key) do nothing;
    end if;
    is_valid := false;
  end if;

  if not is_valid then
    update public.email_notifications
    set status = 'cancelled', terminal_at = now(), updated_at = now(),
      lease_token = null, leased_at = null, lease_expires_at = null
    where id = notification.id;
  end if;

  return jsonb_build_object(
    'valid', is_valid,
    'replyTo', nullif(contact.email, ''),
    'bookingUrl', nullif(contact.booking_url, ''),
    'publicBookingEnabled', settings.public_booking_enabled,
    'reviewUrl', nullif(settings.email_review_url, '')
  );
end;
$$;

create or replace function public.email_cancel_notification(
  p_notification_id uuid,
  p_reason text default 'cancelled'
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.email_notifications
  set status = 'cancelled', terminal_at = now(), updated_at = now(),
    last_error_summary = left(nullif(btrim(p_reason), ''), 500),
    lease_token = null, leased_at = null, lease_expires_at = null
  where id = p_notification_id and status = 'pending';
  return found;
end;
$$;

create or replace function public.email_record_webhook_event(
  p_event_id text,
  p_event_type text,
  p_provider_message_id text,
  p_recipient_email text,
  p_occurred_at timestamptz
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  inserted boolean;
  normalized_email text := lower(btrim(coalesce(p_recipient_email, '')));
begin
  if nullif(btrim(p_event_id), '') is null
    or nullif(btrim(p_provider_message_id), '') is null
    or p_event_type not in ('sent', 'delivered', 'delivery_delayed', 'failed', 'bounced', 'suppressed', 'complained') then
    raise exception using errcode = '22023', message = 'invalid_email_webhook_event';
  end if;

  insert into public.email_webhook_events (
    event_id, event_type, provider_message_id, recipient_email, occurred_at
  ) values (
    p_event_id, p_event_type, p_provider_message_id, nullif(normalized_email, ''), p_occurred_at
  ) on conflict (event_id) do nothing;
  inserted := found;
  if not inserted then return false; end if;

  update public.email_notifications
  set
    status = case
      when status = 'suppressed' then 'suppressed'
      when p_event_type in ('bounced', 'suppressed', 'complained') then 'suppressed'
      when p_event_type = 'delivered' then 'delivered'
      when status = 'delivered' then 'delivered'
      when status = 'failed' then 'failed'
      when p_event_type = 'failed' then 'failed'
      when p_event_type = 'sent' then 'sent'
      else status
    end,
    provider_status = case
      when status = 'suppressed' then provider_status
      when p_event_type in ('bounced', 'suppressed', 'complained', 'delivered') then p_event_type
      when status in ('delivered', 'failed') then provider_status
      else p_event_type
    end,
    sent_at = case when p_event_type in ('sent', 'delivered') then coalesce(sent_at, p_occurred_at, now()) else sent_at end,
    delivered_at = case when p_event_type = 'delivered' then coalesce(p_occurred_at, now()) else delivered_at end,
    terminal_at = case when p_event_type in ('sent', 'delivered', 'failed', 'bounced', 'suppressed', 'complained')
      then coalesce(terminal_at, p_occurred_at, now()) else terminal_at end,
    updated_at = now()
  where provider_message_id = p_provider_message_id;

  if p_event_type in ('bounced', 'suppressed', 'complained') and normalized_email <> '' then
    insert into public.email_suppressions (
      email_hash, reason, provider_event_id, suppressed_at, cleared_at, cleared_by
    ) values (
      public.email_address_hash(normalized_email), p_event_type, p_event_id, coalesce(p_occurred_at, now()), null, null
    ) on conflict (email_hash) do update set
      reason = excluded.reason, provider_event_id = excluded.provider_event_id,
      suppressed_at = excluded.suppressed_at, cleared_at = null, cleared_by = null;

    update public.email_notifications
    set status = 'suppressed', provider_status = p_event_type, terminal_at = now(), updated_at = now(),
      lease_token = null, leased_at = null, lease_expires_at = null
    where lower(recipient_email) = normalized_email and status = 'pending';
  end if;
  return true;
end;
$$;

create or replace function public.public_booking_confirm_session_v5(
  p_session_key_hash text,
  p_selection_id uuid,
  p_selection_version integer,
  p_idempotency_key_hash text,
  p_full_name text,
  p_phone text,
  p_phone_normalized text,
  p_email text,
  p_locale text,
  p_contact_preference text,
  p_public_note text,
  p_privacy_accepted boolean,
  p_care_email_opt_in boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
  appointment public.admin_appointments%rowtype;
  client public.admin_clients%rowtype;
  settings public.admin_site_settings%rowtype;
  consent_changed boolean := false;
begin
  if p_care_email_opt_in is null or (p_care_email_opt_in and nullif(btrim(coalesce(p_email, '')), '') is null) then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  perform set_config(
    'app.customer_email_notifications_enabled',
    (nullif(btrim(coalesce(p_email, '')), '') is not null)::text,
    true
  );
  result := public.public_booking_confirm_session_v4(
    p_session_key_hash, p_selection_id, p_selection_version, p_idempotency_key_hash,
    p_full_name, p_phone, p_phone_normalized, p_email, p_locale,
    p_contact_preference, p_public_note, p_privacy_accepted
  );
  perform set_config('app.customer_email_notifications_enabled', '', true);

  select appointment_row.* into appointment
  from public.admin_appointments appointment_row
  join public.public_booking_holds hold on hold.id = appointment_row.public_booking_hold_id
  where appointment_row.public_booking_idempotency_key_hash = p_idempotency_key_hash
    and hold.session_key_hash = p_session_key_hash and hold.id = p_selection_id
  for update of appointment_row;
  if not found then raise exception using errcode = 'P0001', message = 'slot_unavailable'; end if;

  select * into client from public.admin_clients where id = appointment.client_id for update;
  select * into settings from public.admin_site_settings where id = 'site';

  if p_care_email_opt_in and
    nullif(lower(btrim(p_email)), '') is distinct from nullif(lower(btrim(appointment.public_email_snapshot)), '') then
    raise exception using errcode = '22023', message = 'invalid_request';
  end if;

  if p_care_email_opt_in and (
    client.care_email_consent_at is null
    or client.care_email_withdrawn_at is not null
    or client.care_email_consent_email_hash is distinct from public.email_address_hash(appointment.public_email_snapshot)
  ) then
    update public.admin_clients set
      care_email_consent_at = now(), care_email_consent_source = 'public_booking',
      care_email_consent_email_hash = public.email_address_hash(appointment.public_email_snapshot),
      care_email_withdrawn_at = null
    where id = client.id;
    consent_changed := true;
  end if;

  perform public.email_enqueue_appointment_transition(null, to_jsonb(appointment), true);

  if settings.owner_notifications_enabled
    and settings.owner_notification_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    insert into public.email_notifications (
      event_type, aggregate_type, aggregate_id, event_version, dedupe_key,
      recipient_email, locale, template_key, template_version, payload, due_at
    ) values (
      'owner_new_public_booking', 'appointment', appointment.id, greatest(appointment.version, 1),
      'owner_new_public_booking:' || appointment.id,
      lower(settings.owner_notification_email), 'bg', 'owner_new_public_booking', 1,
      jsonb_build_object(
        'date', appointment.starts_on,
        'time', to_char(appointment.starts_at, 'HH24:MI'),
        'serviceName', appointment.service_name,
        'specialistName', result ->> 'specialistName',
        'publicReference', appointment.public_reference,
        'adminPath', '/admin?section=calendar&appointment=' || appointment.id
      ), now()
    ) on conflict (dedupe_key) do nothing;
  end if;

  if consent_changed then
    insert into public.admin_audit_log (actor_user_id, action, entity_table, entity_id, metadata)
    values (null, 'client.care_email_consent_public', 'admin_clients', client.id,
      jsonb_build_object('appointment_id', appointment.id, 'source', 'public_booking'));
  end if;
  return result;
end;
$$;

create or replace function public.email_unsubscribe_care_by_notification(p_notification_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  client_id text;
  consent_email_hash text;
  consent_withdrawn boolean := false;
begin
  select appointment.client_id, public.email_address_hash(notification.recipient_email)
  into client_id, consent_email_hash
  from public.email_notifications notification
  join public.admin_appointments appointment
    on notification.aggregate_type = 'appointment' and appointment.id = notification.aggregate_id
  where notification.id = p_notification_id and notification.event_type = 'booking_care';
  if not found then return false; end if;

  update public.admin_clients set
    care_email_withdrawn_at = now()
  where id = client_id and care_email_consent_email_hash = consent_email_hash;
  consent_withdrawn := found;

  update public.email_notifications notification set
    status = 'cancelled', terminal_at = now(), updated_at = now(),
    lease_token = null, leased_at = null, lease_expires_at = null
  from public.admin_appointments appointment
  where notification.aggregate_type = 'appointment'
    and notification.event_type = 'booking_care'
    and notification.status = 'pending'
    and public.email_address_hash(notification.recipient_email) = consent_email_hash
    and appointment.id = notification.aggregate_id and appointment.client_id = client_id;

  insert into public.admin_audit_log (actor_user_id, action, entity_table, entity_id, metadata)
  values (null, 'client.care_email_unsubscribe', 'admin_clients', client_id,
    jsonb_build_object(
      'notification_id', p_notification_id,
      'consent_withdrawn', consent_withdrawn
    ));
  return true;
end;
$$;

create or replace function public.email_enqueue_appointment_transition_impl(
  p_before jsonb,
  p_after jsonb,
  p_notify_client boolean default true
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  appointment public.admin_appointments%rowtype;
  client public.admin_clients%rowtype;
  settings public.admin_site_settings%rowtype;
  recipient text;
  version_number integer;
  reminder_due timestamptz;
  care_due timestamptz;
  payload_value jsonb;
  first_previous_date_time text;
  before_status text := p_before ->> 'status';
  changed_schedule boolean;
  first_confirmation_transition boolean := false;
begin
  select * into appointment
  from public.admin_appointments
  where id = p_after ->> 'id';
  if not found then return; end if;

  select * into client from public.admin_clients where id = appointment.client_id;
  select * into settings from public.admin_site_settings where id = 'site';
  recipient := coalesce(public.email_current_appointment_recipient(appointment.id), '');
  version_number := greatest(coalesce(appointment.version, 1), 1);
  payload_value := public.email_appointment_payload(appointment.id, p_before);
  reminder_due := ((appointment.starts_on + appointment.starts_at) at time zone 'Europe/Sofia') - interval '24 hours';
  care_due := (((now() at time zone 'Europe/Sofia')::date + 1 + time '10:00') at time zone 'Europe/Sofia');
  changed_schedule := p_before is not null and (
    p_before ->> 'starts_on' is distinct from appointment.starts_on::text
    or left(coalesce(p_before ->> 'starts_at', ''), 5) is distinct from to_char(appointment.starts_at, 'HH24:MI')
    or p_before ->> 'service_name' is distinct from appointment.service_name
    or (p_before ->> 'duration_minutes')::integer is distinct from appointment.duration_minutes
    or nullif(p_before ->> 'specialist_id', '')::uuid is distinct from appointment.specialist_id
  );

  if appointment.status = 'confirmed' and before_status is distinct from 'confirmed' then
    insert into public.email_appointment_event_history (appointment_id, event_type)
    values (appointment.id, 'first_confirmed')
    on conflict (appointment_id, event_type) do nothing;
    first_confirmation_transition := found;
  end if;

  if appointment.status = 'cancelled' then
    update public.email_notifications
    set status = 'cancelled', terminal_at = now(), updated_at = now(),
      lease_token = null, leased_at = null, lease_expires_at = null
    where aggregate_type = 'appointment' and aggregate_id = appointment.id
      and event_type in ('booking_reminder_24h', 'booking_care', 'booking_confirmed', 'booking_rescheduled')
      and status = 'pending';
  end if;

  if changed_schedule then
    select existing.payload ->> 'previousDateTime' into first_previous_date_time
    from public.email_notifications existing
    where existing.aggregate_type = 'appointment'
      and existing.aggregate_id = appointment.id
      and existing.event_type = 'booking_rescheduled'
      and existing.status in ('pending', 'processing')
    order by existing.created_at
    limit 1;
    if nullif(first_previous_date_time, '') is not null then
      payload_value := jsonb_set(payload_value, '{previousDateTime}', to_jsonb(first_previous_date_time), true);
    end if;

    update public.email_notifications
    set status = 'cancelled', terminal_at = now(), updated_at = now(),
      lease_token = null, leased_at = null, lease_expires_at = null
    where aggregate_type = 'appointment' and aggregate_id = appointment.id
      and event_type in ('booking_confirmed', 'booking_rescheduled', 'booking_reminder_24h')
      and status = 'pending';
  end if;

  if settings.booking_customer_emails_enabled and recipient <> ''
    and appointment.status = 'confirmed'
    and first_confirmation_transition
    and p_notify_client then
    insert into public.email_notifications (
      event_type, aggregate_type, aggregate_id, event_version, dedupe_key,
      recipient_email, locale, template_key, template_version, payload, due_at
    ) values (
      'booking_confirmed', 'appointment', appointment.id, version_number,
      'booking_confirmed:' || appointment.id || ':first',
      recipient, coalesce(appointment.locale, client.locale, settings.default_locale, 'bg'),
      'booking_confirmed', 1, payload_value, now()
    ) on conflict (dedupe_key) do nothing;
  end if;

  if settings.booking_customer_emails_enabled and recipient <> ''
    and appointment.status = 'confirmed'
    and changed_schedule and p_notify_client then
    insert into public.email_notifications (
      event_type, aggregate_type, aggregate_id, event_version, dedupe_key,
      recipient_email, locale, template_key, template_version, payload, due_at
    ) values (
      'booking_rescheduled', 'appointment', appointment.id, version_number,
      'booking_rescheduled:' || appointment.id || ':v' || version_number,
      recipient, coalesce(appointment.locale, client.locale, settings.default_locale, 'bg'),
      'booking_rescheduled', 1, payload_value, now() + interval '2 minutes'
    ) on conflict (dedupe_key) do nothing;
  end if;

  if settings.booking_customer_emails_enabled and recipient <> ''
    and appointment.status = 'cancelled'
    and before_status is distinct from 'cancelled'
    and p_notify_client then
    insert into public.email_notifications (
      event_type, aggregate_type, aggregate_id, event_version, dedupe_key,
      recipient_email, locale, template_key, template_version, payload, due_at
    ) values (
      'booking_cancelled', 'appointment', appointment.id, version_number,
      'booking_cancelled:' || appointment.id || ':v' || version_number,
      recipient, coalesce(appointment.locale, client.locale, settings.default_locale, 'bg'),
      'booking_cancelled', 1, payload_value, now()
    ) on conflict (dedupe_key) do nothing;
  end if;

  if settings.booking_customer_emails_enabled and recipient <> ''
    and appointment.customer_email_notifications_enabled
    and appointment.status = 'confirmed'
    and reminder_due > now()
    and (before_status is distinct from 'confirmed' or changed_schedule) then
    insert into public.email_notifications (
      event_type, aggregate_type, aggregate_id, event_version, dedupe_key,
      recipient_email, locale, template_key, template_version, payload, due_at
    ) values (
      'booking_reminder_24h', 'appointment', appointment.id, version_number,
      'booking_reminder_24h:' || appointment.id || ':v' || version_number,
      recipient, coalesce(appointment.locale, client.locale, settings.default_locale, 'bg'),
      'booking_reminder_24h', 1, payload_value, reminder_due
    ) on conflict (dedupe_key) do nothing;
  end if;

  if settings.care_emails_enabled and recipient <> ''
    and appointment.status = 'completed'
    and before_status is distinct from 'completed'
    and client.care_email_consent_at is not null
    and client.care_email_withdrawn_at is null
    and client.care_email_consent_email_hash = public.email_address_hash(recipient)
    and settings.email_review_url ~* '^https://' then
    insert into public.email_notifications (
      event_type, aggregate_type, aggregate_id, event_version, dedupe_key,
      recipient_email, locale, template_key, template_version, payload, due_at
    ) values (
      'booking_care', 'appointment', appointment.id, version_number,
      'booking_care:' || appointment.id || ':v' || version_number,
      recipient, coalesce(appointment.locale, client.locale, settings.default_locale, 'bg'),
      'booking_care', 1, payload_value, care_due
    ) on conflict (dedupe_key) do nothing;
  end if;
end;
$$;

-- The drifted remote function still returns void. PostgreSQL cannot change a
-- function return type with CREATE OR REPLACE, and catalog inspection confirmed
-- that this API boundary has no database dependants.
drop function if exists public.admin_save_record_with_audit(
  text, jsonb, uuid, text, jsonb
);

create or replace function public.admin_save_record_with_audit(
  p_record_type text,
  p_record jsonb,
  p_actor_user_id uuid,
  p_action text,
  p_audit_metadata jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  prior_consent_at timestamptz;
  prior_consent_source text;
  prior_consent_email_hash text;
  prior_withdrawn_at timestamptz;
  expected_consent_at timestamptz;
  expected_consent_source text;
  expected_withdrawn_at timestamptz;
  next_consent_at timestamptz;
  next_consent_source text;
  next_consent_email_hash text;
  next_withdrawn_at timestamptz;
  consent_changed boolean := false;
  care_fields_supplied boolean := false;
begin
  if not exists (
    select 1 from public.admin_profiles profile
    where profile.user_id = p_actor_user_id and profile.status = 'active'
  ) then raise exception using errcode = '42501', message = 'admin_record_forbidden'; end if;

  if p_record_type = 'client' then
    care_fields_supplied := p_record ?| array[
      'care_email_consent_at', 'care_email_consent_source', 'care_email_withdrawn_at'
    ];
    if care_fields_supplied
      and not exists (
        select 1 from public.admin_profiles profile
        where profile.user_id = p_actor_user_id and profile.status = 'active'
          and profile.role::text in ('owner', 'administrator')
      ) then raise exception using errcode = '42501', message = 'care_email_consent_forbidden'; end if;
    if care_fields_supplied then
      if not (p_record ?& array[
        'care_email_expected_consent_at',
        'care_email_expected_consent_source',
        'care_email_expected_withdrawn_at'
      ]) then
        raise exception using errcode = '22023', message = 'care_email_consent_expectation_required';
      end if;
      select client.care_email_consent_at, client.care_email_consent_source,
        client.care_email_consent_email_hash, client.care_email_withdrawn_at
      into prior_consent_at, prior_consent_source, prior_consent_email_hash, prior_withdrawn_at
      from public.admin_clients client
      where client.id = p_record ->> 'id'
      for update;
      expected_consent_at := nullif(p_record ->> 'care_email_expected_consent_at', '')::timestamptz;
      expected_consent_source := nullif(p_record ->> 'care_email_expected_consent_source', '');
      expected_withdrawn_at := nullif(p_record ->> 'care_email_expected_withdrawn_at', '')::timestamptz;
      if prior_consent_at is distinct from expected_consent_at
        or prior_consent_source is distinct from expected_consent_source
        or prior_withdrawn_at is distinct from expected_withdrawn_at then
        raise exception using errcode = '40001', message = 'care_email_consent_conflict';
      end if;
      if nullif(p_record ->> 'care_email_withdrawn_at', '') is not null then
        next_consent_at := prior_consent_at;
        next_consent_source := prior_consent_source;
        next_consent_email_hash := prior_consent_email_hash;
        next_withdrawn_at := now();
      else
        if coalesce(p_record ->> 'email', '') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
          raise exception using errcode = '22023', message = 'invalid_care_email_consent';
        end if;
        next_consent_at := now();
        next_consent_source := 'admin_recorded';
        next_consent_email_hash := public.email_address_hash(p_record ->> 'email');
        next_withdrawn_at := null;
      end if;
      consent_changed := prior_consent_at is distinct from next_consent_at
        or prior_consent_source is distinct from next_consent_source
        or prior_consent_email_hash is distinct from next_consent_email_hash
        or prior_withdrawn_at is distinct from next_withdrawn_at;
    end if;
    perform public.admin_save_record_with_audit_pre_email(
      p_record_type,
      p_record
        - 'care_email_consent_at'
        - 'care_email_consent_source'
        - 'care_email_withdrawn_at'
        - 'care_email_expected_consent_at'
        - 'care_email_expected_consent_source'
        - 'care_email_expected_withdrawn_at',
      p_actor_user_id, p_action, p_audit_metadata
    );
    if care_fields_supplied then
      update public.admin_clients set
        care_email_consent_at = next_consent_at,
        care_email_consent_source = next_consent_source,
        care_email_consent_email_hash = next_consent_email_hash,
        care_email_withdrawn_at = next_withdrawn_at
      where id = p_record ->> 'id';
    end if;
    if care_fields_supplied and consent_changed then
      insert into public.admin_audit_log (actor_user_id, action, entity_table, entity_id, metadata)
      values (p_actor_user_id, 'client.care_email_consent', 'admin_clients', p_record ->> 'id',
        jsonb_strip_nulls(jsonb_build_object(
          'source', next_consent_source,
          'consented', next_consent_at is not null,
          'consent_at', next_consent_at,
          'withdrawn', next_withdrawn_at is not null,
          'withdrawn_at', next_withdrawn_at
        )));
    end if;
    return (
      select jsonb_build_object(
        'care_email_consent_at', client.care_email_consent_at,
        'care_email_consent_source', client.care_email_consent_source,
        'care_email_withdrawn_at', client.care_email_withdrawn_at
      )
      from public.admin_clients client
      where client.id = p_record ->> 'id'
    );
  else
    perform public.admin_save_record_with_audit_pre_email(
      p_record_type, p_record, p_actor_user_id, p_action, p_audit_metadata
    );
    return null;
  end if;
end;
$$;

create or replace function public.gift_claim_abandoned_pending_orders(
  p_limit integer default 25
)
returns table (
  order_id uuid,
  payment_intent_id text,
  certificate_code text,
  locale text,
  amount_eur_cents integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit not between 1 and 25 then
    raise exception 'invalid abandoned gift cleanup batch';
  end if;

  delete from public.gift_certificate_orders
  where status = 'pending'
    and order_payload is null
    and created_at < now() - interval '90 days';

  return query
  with candidates as (
    select gift_order.id
    from public.gift_certificate_orders gift_order
    where gift_order.status = 'pending'
      and gift_order.order_payload is not null
      and gift_order.created_at < now() - interval '7 days'
      and (
        gift_order.cleanup_claimed_at is null
        or gift_order.cleanup_claimed_at < now() - interval '30 minutes'
      )
    order by gift_order.created_at
    for update skip locked
    limit p_limit
  )
  update public.gift_certificate_orders gift_order
  set cleanup_claimed_at = now(), updated_at = now()
  from candidates
  where gift_order.id = candidates.id
  returning gift_order.id, gift_order.payment_intent_id,
    gift_order.certificate_code, gift_order.locale, gift_order.amount_eur_cents;
end;
$$;

create or replace function public.gift_redact_abandoned_pending_order(
  p_order_id uuid,
  p_payment_intent_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.gift_certificate_orders
  set idempotency_key = null,
      payload_hash = null,
      purchaser_email = '',
      purchaser_name = 'redacted',
      recipient_email = null,
      recipient_name = 'redacted',
      recipient_message = null,
      service_items = '[]'::jsonb,
      order_payload = null,
      cleanup_claimed_at = null,
      last_fulfillment_error = 'abandoned_pending_order_redacted',
      updated_at = now()
  where id = p_order_id
    and status = 'pending'
    and order_payload is not null
    and created_at < now() - interval '7 days'
    and payment_intent_id is not distinct from nullif(btrim(p_payment_intent_id), '');
  return found;
end;
$$;

-- Restore the same least-privilege boundary as the canonical migrations.
revoke all on function public.email_enqueue_appointment_transition_impl(jsonb, jsonb, boolean) from public, anon, authenticated, service_role;
revoke all on function public.admin_save_record_with_audit(text, jsonb, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.public_booking_confirm_session_v5(
  text, uuid, integer, text, text, text, text, text, text, text, text, boolean, boolean
) from public, anon, authenticated;
revoke all on function public.email_claim_notifications(integer, integer) from public, anon, authenticated;
revoke all on function public.email_prepare_claimed_notification(uuid, uuid) from public, anon, authenticated;
revoke all on function public.email_cancel_notification(uuid, text) from public, anon, authenticated;
revoke all on function public.email_record_webhook_event(text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.email_unsubscribe_care_by_notification(uuid) from public, anon, authenticated;
revoke all on function public.gift_claim_abandoned_pending_orders(integer) from public, anon, authenticated;
revoke all on function public.gift_redact_abandoned_pending_order(uuid, text) from public, anon, authenticated;

grant execute on function public.admin_save_record_with_audit(text, jsonb, uuid, text, jsonb) to service_role;
grant execute on function public.public_booking_confirm_session_v5(
  text, uuid, integer, text, text, text, text, text, text, text, text, boolean, boolean
) to service_role;
grant execute on function public.email_claim_notifications(integer, integer) to service_role;
grant execute on function public.email_prepare_claimed_notification(uuid, uuid) to service_role;
grant execute on function public.email_cancel_notification(uuid, text) to service_role;
grant execute on function public.email_record_webhook_event(text, text, text, text, timestamptz) to service_role;
grant execute on function public.email_unsubscribe_care_by_notification(uuid) to service_role;
grant execute on function public.gift_claim_abandoned_pending_orders(integer) to service_role;
grant execute on function public.gift_redact_abandoned_pending_order(uuid, text) to service_role;

comment on function public.public_booking_confirm_session_v5(
  text, uuid, integer, text, text, text, text, text, text, text, text, boolean, boolean
) is 'Atomic public booking confirmation, optional care consent, and feature-gated email enqueue.';

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_clients'
      and column_name = 'care_email_consent_email_hash'
  ) then
    raise exception 'care email consent hash repair failed';
  end if;

  if to_regprocedure('public.gift_claim_abandoned_pending_orders(integer)') is null
    or to_regprocedure('public.gift_redact_abandoned_pending_order(uuid,text)') is null then
    raise exception 'gift cleanup function repair failed';
  end if;
end;
$$;
