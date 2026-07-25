-- Transactional email outbox for booking and gift-certificate delivery.
-- All mutation and worker functions are service-role boundaries; no browser
-- role receives direct access to recipient addresses or delivery history.

alter table public.admin_site_settings
  add column if not exists booking_customer_emails_enabled boolean not null default false,
  add column if not exists owner_notifications_enabled boolean not null default false,
  add column if not exists care_emails_enabled boolean not null default false,
  add column if not exists owner_notification_email text not null default '',
  add column if not exists email_review_url text not null default '';

alter table public.admin_site_settings
  drop constraint if exists admin_site_settings_owner_notification_email_check,
  drop constraint if exists admin_site_settings_email_review_url_check;
alter table public.admin_site_settings
  add constraint admin_site_settings_owner_notification_email_check check (
    owner_notification_email = ''
    or owner_notification_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  add constraint admin_site_settings_email_review_url_check check (
    email_review_url = '' or email_review_url ~* '^https://'
  );

alter table public.admin_clients
  add column if not exists care_email_consent_at timestamptz,
  add column if not exists care_email_consent_source text,
  add column if not exists care_email_consent_email_hash text,
  add column if not exists care_email_withdrawn_at timestamptz;

alter table public.admin_clients
  drop constraint if exists admin_clients_care_email_consent_source_check,
  drop constraint if exists admin_clients_care_email_consent_shape_check;
alter table public.admin_clients
  add constraint admin_clients_care_email_consent_source_check check (
    care_email_consent_source is null
    or care_email_consent_source in ('public_booking', 'admin_recorded')
  );

alter table public.admin_appointments
  add column if not exists customer_email_notifications_enabled boolean not null default false;

create function public.email_apply_appointment_notification_preference()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  configured_preference text := current_setting('app.customer_email_notifications_enabled', true);
begin
  if configured_preference in ('true', 'false') then
    new.customer_email_notifications_enabled := configured_preference::boolean;
  end if;
  return new;
end;
$$;

drop trigger if exists apply_email_notification_preference on public.admin_appointments;
create trigger apply_email_notification_preference
before insert or update on public.admin_appointments
for each row execute function public.email_apply_appointment_notification_preference();

alter table public.admin_site_settings
  add constraint admin_site_settings_care_email_configuration_check check (
    not care_emails_enabled or email_review_url ~* '^https://[^[:space:]]+$'
  ),
  add constraint admin_site_settings_owner_email_configuration_check check (
    not owner_notifications_enabled
    or owner_notification_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

create table public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'booking_confirmed', 'booking_rescheduled', 'booking_cancelled',
    'booking_reminder_24h', 'booking_care', 'owner_new_public_booking',
    'gift_buyer', 'gift_recipient', 'owner_gift_purchase'
  )),
  aggregate_type text not null check (aggregate_type in ('appointment', 'certificate')),
  aggregate_id text not null,
  event_version integer not null default 1 check (event_version > 0),
  dedupe_key text not null unique,
  recipient_email text,
  locale text not null default 'bg' check (locale in ('bg', 'ru', 'ua', 'en')),
  template_key text not null,
  template_version integer not null default 1 check (template_version > 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  due_at timestamptz not null default now(),
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'sent', 'delivered', 'failed', 'cancelled', 'suppressed')
  ),
  -- One initial delivery attempt plus the configured eight retries.
  attempt_count integer not null default 0 check (attempt_count between 0 and 9),
  lease_token uuid,
  leased_at timestamptz,
  lease_expires_at timestamptz,
  last_error_summary text,
  provider_message_id text,
  provider_status text,
  sent_at timestamptz,
  delivered_at timestamptz,
  terminal_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(aggregate_id) between 1 and 200),
  check (char_length(dedupe_key) between 1 and 300),
  check (recipient_email is null or recipient_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  check (
    (status = 'processing' and lease_token is not null and lease_expires_at is not null)
    or status <> 'processing'
  )
);

create index email_notifications_claim_idx
  on public.email_notifications (due_at, created_at)
  where status in ('pending', 'processing');
create index email_notifications_aggregate_idx
  on public.email_notifications (aggregate_type, aggregate_id, created_at desc);
create unique index email_notifications_provider_message_uidx
  on public.email_notifications (provider_message_id)
  where provider_message_id is not null;

create table public.email_webhook_events (
  event_id text primary key,
  event_type text not null check (event_type in (
    'sent', 'delivered', 'delivery_delayed', 'failed', 'bounced', 'suppressed', 'complained'
  )),
  provider_message_id text not null,
  recipient_email text,
  occurred_at timestamptz,
  created_at timestamptz not null default now()
);

create index email_webhook_events_message_idx
  on public.email_webhook_events (provider_message_id, created_at desc);

create table public.email_suppressions (
  email_hash text primary key check (email_hash ~ '^[a-f0-9]{64}$'),
  reason text not null check (reason in ('bounced', 'complained', 'suppressed')),
  provider_event_id text references public.email_webhook_events(event_id) on delete set null,
  suppressed_at timestamptz not null default now(),
  cleared_at timestamptz,
  cleared_by uuid references auth.users(id) on delete set null
);

create table public.email_appointment_event_history (
  appointment_id text not null references public.admin_appointments(id) on delete cascade,
  event_type text not null check (event_type = 'first_confirmed'),
  first_recorded_at timestamptz not null default now(),
  primary key (appointment_id, event_type)
);

alter table public.email_notifications enable row level security;
alter table public.email_webhook_events enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.email_appointment_event_history enable row level security;

revoke all on table public.email_notifications from public, anon, authenticated;
revoke all on table public.email_webhook_events from public, anon, authenticated;
revoke all on table public.email_suppressions from public, anon, authenticated;
revoke all on table public.email_appointment_event_history from public, anon, authenticated;
grant select, insert, update, delete on public.email_notifications to service_role;
grant select, insert, update, delete on public.email_webhook_events to service_role;
grant select, insert, update, delete on public.email_suppressions to service_role;
grant select, insert, update, delete on public.email_appointment_event_history to service_role;

create function public.email_address_hash(p_email text)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select encode(sha256(convert_to(lower(btrim(p_email)), 'UTF8')), 'hex');
$$;

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

create function public.email_current_appointment_recipient(p_appointment_id text)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    -- Public booking contact details are immutable per-booking snapshots. A returning
    -- client's CRM profile may intentionally retain a different historical address.
    when appointment.origin = 'public'
      then nullif(lower(btrim(appointment.public_email_snapshot)), '')
    else nullif(lower(btrim(client.email)), '')
  end
  from public.admin_appointments appointment
  join public.admin_clients client on client.id = appointment.client_id
  where appointment.id = p_appointment_id;
$$;

create function public.email_current_notification_recipient(p_notification_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  notification public.email_notifications%rowtype;
  resolved text;
begin
  select * into notification from public.email_notifications where id = p_notification_id;
  if not found then return null; end if;
  if notification.aggregate_type = 'appointment'
    and notification.event_type <> 'owner_new_public_booking' then
    resolved := public.email_current_appointment_recipient(notification.aggregate_id);
  elsif notification.event_type in ('owner_new_public_booking', 'owner_gift_purchase') then
    select lower(btrim(owner_notification_email)) into resolved
    from public.admin_site_settings where id = 'site' and owner_notifications_enabled;
  else
    resolved := lower(btrim(notification.recipient_email));
  end if;
  return nullif(resolved, '');
end;
$$;

create function public.email_appointment_payload(
  p_appointment_id text,
  p_previous jsonb default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  appointment public.admin_appointments%rowtype;
  client public.admin_clients%rowtype;
  contact public.admin_contact_settings%rowtype;
  specialist_name text;
begin
  select * into appointment from public.admin_appointments where id = p_appointment_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'email_appointment_not_found';
  end if;
  select * into client from public.admin_clients where id = appointment.client_id;
  select * into contact from public.admin_contact_settings where id = 'site';
  select display_name into specialist_name from public.admin_specialists where id = appointment.specialist_id;

  return jsonb_strip_nulls(jsonb_build_object(
    'clientName', appointment.client_name_snapshot,
    'serviceName', appointment.service_name,
    'specialistName', specialist_name,
    'date', appointment.starts_on,
    'time', to_char(appointment.starts_at, 'HH24:MI'),
    'durationMinutes', appointment.duration_minutes,
    'price', case when appointment.price_cents_snapshot is null then null else
      to_char(appointment.price_cents_snapshot / 100.0, 'FM999999990.00') || ' ' || appointment.currency_snapshot end,
    'address', contact.address,
    'salonContact', concat_ws(' · ', nullif(contact.phone, ''), nullif(contact.email, '')),
    'publicReference', appointment.public_reference,
    'previousDateTime', case when p_previous is null then null else
      (p_previous ->> 'starts_on') || ' ' || left(p_previous ->> 'starts_at', 5) end,
    'newDateTime', appointment.starts_on::text || ' ' || to_char(appointment.starts_at, 'HH24:MI')
  ));
end;
$$;

-- Stable composition boundary. Its implementation is installed below; PL/pgSQL
-- resolves the private implementation when the RPC is first invoked.
create function public.email_enqueue_appointment_transition(
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
begin
  perform public.email_enqueue_appointment_transition_impl(p_before, p_after, p_notify_client);
end;
$$;

create function public.email_claim_notifications(
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

create function public.email_prepare_claimed_notification(
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

create function public.email_complete_notification(
  p_notification_id uuid,
  p_lease_token uuid,
  p_provider_message_id text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  completed boolean := false;
begin
  if nullif(btrim(p_provider_message_id), '') is null then
    raise exception using errcode = '22023', message = 'invalid_provider_message_id';
  end if;
  update public.email_notifications
  set status = 'sent', provider_status = 'sent', provider_message_id = p_provider_message_id,
    sent_at = coalesce(sent_at, now()), terminal_at = now(), updated_at = now(),
    last_error_summary = null, lease_token = null, leased_at = null, lease_expires_at = null
  where id = p_notification_id and status = 'processing' and lease_token = p_lease_token;
  completed := found;
  if not completed then return false; end if;

  update public.email_notifications notification
  set
    status = case
      when exists (select 1 from public.email_webhook_events event
        where event.provider_message_id = p_provider_message_id
          and event.event_type in ('bounced', 'suppressed', 'complained')) then 'suppressed'
      when exists (select 1 from public.email_webhook_events event
        where event.provider_message_id = p_provider_message_id and event.event_type = 'delivered') then 'delivered'
      when exists (select 1 from public.email_webhook_events event
        where event.provider_message_id = p_provider_message_id and event.event_type = 'failed') then 'failed'
      else 'sent'
    end,
    provider_status = case
      when exists (select 1 from public.email_webhook_events event
        where event.provider_message_id = p_provider_message_id
          and event.event_type in ('bounced', 'suppressed', 'complained')) then 'suppressed'
      when exists (select 1 from public.email_webhook_events event
        where event.provider_message_id = p_provider_message_id and event.event_type = 'delivered') then 'delivered'
      when exists (select 1 from public.email_webhook_events event
        where event.provider_message_id = p_provider_message_id and event.event_type = 'failed') then 'failed'
      else 'sent'
    end,
    delivered_at = case when exists (
      select 1 from public.email_webhook_events event
      where event.provider_message_id = p_provider_message_id and event.event_type = 'delivered'
    ) then coalesce(notification.delivered_at, now()) else notification.delivered_at end,
    updated_at = now()
  where notification.id = p_notification_id;
  return true;
end;
$$;

create function public.email_fail_notification(
  p_notification_id uuid,
  p_lease_token uuid,
  p_error_summary text,
  p_retryable boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  attempts integer;
  retry_delay interval;
begin
  select attempt_count into attempts
  from public.email_notifications
  where id = p_notification_id and status = 'processing' and lease_token = p_lease_token
  for update;
  if not found then return false; end if;

  retry_delay := case attempts
    when 1 then interval '1 minute'
    when 2 then interval '5 minutes'
    when 3 then interval '15 minutes'
    when 4 then interval '1 hour'
    when 5 then interval '3 hours'
    when 6 then interval '6 hours'
    when 7 then interval '12 hours'
    else interval '24 hours'
  end;

  update public.email_notifications
  set status = case when p_retryable and attempts <= 8 then 'pending' else 'failed' end,
    due_at = case when p_retryable and attempts <= 8 then now() + retry_delay else due_at end,
    terminal_at = case when p_retryable and attempts <= 8 then null else now() end,
    last_error_summary = left(coalesce(nullif(btrim(p_error_summary), ''), 'email_delivery_failed'), 500),
    updated_at = now(), lease_token = null, leased_at = null, lease_expires_at = null
  where id = p_notification_id;
  return true;
end;
$$;

create function public.email_cancel_notification(
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

create function public.email_record_webhook_event(
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

create function public.email_cleanup_personal_data()
returns integer
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  affected integer := 0;
  changed integer := 0;
  retention_days integer;
begin
  select audit_log_retention_days into retention_days
  from public.admin_site_settings where id = 'site';
  retention_days := greatest(coalesce(retention_days, 365), 1);
  update public.email_webhook_events event
  set recipient_email = null
  where event.recipient_email is not null
    and (
      event.created_at < now() - interval '90 days'
      or exists (
        select 1 from public.email_notifications notification
        where notification.provider_message_id = event.provider_message_id
          and notification.terminal_at < now() - interval '90 days'
      )
    );
  get diagnostics changed = row_count;
  affected := affected + changed;

  update public.email_notifications
  set recipient_email = null,
    payload = jsonb_strip_nulls(jsonb_build_object(
      'publicReference', payload ->> 'publicReference',
      'certificateCode', payload ->> 'certificateCode'
    )),
    updated_at = now()
  where status in ('sent', 'delivered', 'failed', 'cancelled', 'suppressed')
    and terminal_at < now() - interval '90 days'
    and (recipient_email is not null or payload <> '{}'::jsonb);
  get diagnostics changed = row_count;
  affected := affected + changed;

  delete from public.email_webhook_events
  where created_at < now() - make_interval(days => retention_days);
  get diagnostics changed = row_count;
  affected := affected + changed;

  delete from public.email_notifications
  where status in ('sent', 'delivered', 'failed', 'cancelled', 'suppressed')
    and terminal_at < now() - make_interval(days => retention_days);
  get diagnostics changed = row_count;
  affected := affected + changed;
  return affected;
end;
$$;

create function public.public_booking_confirm_session_v5(
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

create function public.email_unsubscribe_care_by_notification(p_notification_id uuid)
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

create function public.admin_list_email_notifications(
  p_aggregate_type text,
  p_aggregate_id text
)
returns table (
  id uuid,
  event_type text,
  status text,
  updated_at timestamptz,
  recipient_email text,
  attempt_count integer,
  last_error_summary text,
  due_at timestamptz,
  provider_message_id text,
  can_retry boolean,
  can_clear_suppression boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select notification.id, notification.event_type, notification.status,
    notification.updated_at, notification.recipient_email, notification.attempt_count,
    notification.last_error_summary, notification.due_at, notification.provider_message_id,
    (
      notification.status = 'failed'
      or (
        notification.status = 'suppressed'
        and current_recipient.email is distinct from lower(notification.recipient_email)
      )
    )
    and current_recipient.email is not null and not exists (
      select 1 from public.email_suppressions suppression
      where suppression.email_hash = public.email_address_hash(current_recipient.email)
        and suppression.cleared_at is null
    ) as can_retry,
    notification.status = 'suppressed' and notification.recipient_email is not null and exists (
      select 1 from public.email_suppressions suppression
      where suppression.email_hash = public.email_address_hash(notification.recipient_email)
        and suppression.cleared_at is null
    ) as can_clear_suppression
  from public.email_notifications notification
  cross join lateral (
    select public.email_current_notification_recipient(notification.id) as email
  ) current_recipient
  where notification.aggregate_type = p_aggregate_type
    and notification.aggregate_id = p_aggregate_id
  order by notification.created_at desc;
$$;

create function public.admin_retry_email_notification(
  p_notification_id uuid,
  p_actor_user_id uuid,
  p_corrected_email text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  original public.email_notifications%rowtype;
  appointment public.admin_appointments%rowtype;
  retry_id uuid := gen_random_uuid();
  retry_recipient text;
  corrected_email text := nullif(lower(btrim(p_corrected_email)), '');
  previous_email text;
begin
  if not exists (
    select 1 from public.admin_profiles profile
    where profile.user_id = p_actor_user_id and profile.status = 'active'
      and profile.role::text in ('owner', 'administrator')
  ) then raise exception using errcode = '42501', message = 'email_retry_forbidden'; end if;
  select * into original from public.email_notifications where id = p_notification_id for update;
  if not found then return false; end if;
  if original.status not in ('failed', 'suppressed') then return false; end if;

  if corrected_email is not null then
    if char_length(corrected_email) > 254
      or corrected_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      or original.aggregate_type <> 'appointment'
      or original.event_type = 'owner_new_public_booking'
      or exists (
        select 1 from public.email_suppressions suppression
        where suppression.email_hash = public.email_address_hash(corrected_email)
          and suppression.cleared_at is null
      ) then
      return false;
    end if;

    select * into appointment
    from public.admin_appointments
    where id = original.aggregate_id
    for update;
    if not found or appointment.origin <> 'public' then return false; end if;

    previous_email := nullif(lower(btrim(appointment.public_email_snapshot)), '');
    if previous_email is distinct from corrected_email then
      update public.admin_appointments
      set public_email_snapshot = corrected_email
      where id = appointment.id;

      insert into public.admin_audit_log (actor_user_id, action, entity_table, entity_id, metadata)
      values (
        p_actor_user_id,
        'appointment.public_email_corrected',
        'admin_appointments',
        appointment.id,
        jsonb_build_object(
          'notification_id', original.id,
          'previous_email_hash', case when previous_email is null then null
            else public.email_address_hash(previous_email) end,
          'corrected_email_hash', public.email_address_hash(corrected_email)
        )
      );
    end if;
  end if;

  retry_recipient := public.email_current_notification_recipient(p_notification_id);
  if retry_recipient is null
    or (original.status = 'suppressed' and retry_recipient = lower(original.recipient_email))
    or exists (select 1 from public.email_suppressions suppression
      where suppression.email_hash = public.email_address_hash(retry_recipient) and suppression.cleared_at is null) then
    return false;
  end if;

  insert into public.email_notifications (
    id, event_type, aggregate_type, aggregate_id, event_version, dedupe_key,
    recipient_email, locale, template_key, template_version, payload, due_at
  ) values (
    retry_id, original.event_type, original.aggregate_type, original.aggregate_id,
    original.event_version + 1, original.dedupe_key || ':retry:' || retry_id,
    retry_recipient, original.locale, original.template_key,
    original.template_version, original.payload, now()
  );
  insert into public.admin_audit_log (actor_user_id, action, entity_table, entity_id, metadata)
  values (p_actor_user_id, 'email.notification_retry', 'email_notifications', retry_id::text,
    jsonb_build_object('original_notification_id', original.id));
  return true;
end;
$$;

create function public.admin_clear_email_suppression_by_notification(
  p_notification_id uuid,
  p_actor_user_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  recipient text;
begin
  if not exists (
    select 1 from public.admin_profiles profile
    where profile.user_id = p_actor_user_id and profile.status = 'active'
      and profile.role::text in ('owner', 'administrator')
  ) then raise exception using errcode = '42501', message = 'email_suppression_clear_forbidden'; end if;
  select lower(recipient_email) into recipient from public.email_notifications
  where id = p_notification_id and status = 'suppressed';
  if not found or recipient is null then return false; end if;
  update public.email_suppressions set cleared_at = now(), cleared_by = p_actor_user_id
  where email_hash = public.email_address_hash(recipient) and cleared_at is null;
  if not found then return false; end if;
  update public.email_notifications set
    status = 'failed', provider_status = 'suppression_cleared', terminal_at = now(), updated_at = now(),
    last_error_summary = 'suppression_cleared_manual_retry_required'
  where id = p_notification_id;
  insert into public.admin_audit_log (actor_user_id, action, entity_table, entity_id, metadata)
  values (p_actor_user_id, 'email.suppression_clear', 'email_suppressions', p_notification_id::text,
    jsonb_build_object('notification_id', p_notification_id));
  return true;
end;
$$;

create function public.email_install_worker_cron()
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  secret_count integer := 0;
  command_text text;
begin
  if to_regnamespace('cron') is null or to_regnamespace('vault') is null or to_regnamespace('net') is null then
    return false;
  end if;
  execute 'select count(*) from vault.decrypted_secrets where name in (''email_worker_url'', ''email_worker_secret'')'
    into secret_count;
  if secret_count <> 2 then return false; end if;

  begin
    execute 'select cron.unschedule(jobid) from cron.job where jobname = ''transactional-email-worker''';
  exception when others then null;
  end;

  command_text := $command$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'email_worker_url'),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_worker_secret'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 600000
    );
  $command$;
  execute 'select cron.schedule($1, $2, $3)'
    using 'transactional-email-worker', '*/5 * * * *', command_text;
  return true;
exception when others then
  raise notice 'Transactional email cron was not installed: %', sqlerrm;
  return false;
end;
$$;

create function public.email_enqueue_appointment_transition_impl(
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

create or replace function public.admin_save_booking_settings_with_audit(
  p_actor_user_id uuid,
  p_settings jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  allowed_keys constant text[] := array[
    'id', 'audit_log_retention_days', 'booking_buffer_minutes', 'business_name',
    'cookie_privacy_mode', 'currency', 'daily_slot_capacity', 'default_locale',
    'default_seo_title', 'email_sender', 'google_calendar_id', 'google_calendar_mode',
    'gift_certificates_enabled', 'reminder_template', 'roles_policy', 'stripe_mode',
    'timezone', 'updated_on', 'working_days', 'working_hours', 'public_booking_enabled',
    'public_booking_daily_limit', 'booking_slot_step_minutes', 'booking_min_lead_minutes',
    'booking_horizon_days', 'booking_hold_minutes', 'booking_customer_emails_enabled',
    'owner_notifications_enabled', 'care_emails_enabled', 'owner_notification_email',
    'email_review_url'
  ];
  saved_settings public.admin_site_settings%rowtype;
begin
  if p_actor_user_id is null or not exists (
    select 1 from public.admin_profiles profile
    where profile.user_id = p_actor_user_id and profile.status = 'active'
      and profile.role::text in ('owner', 'administrator')
  ) then
    raise exception using errcode = '42501', message = 'booking_settings_forbidden';
  end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object'
    or not (p_settings ?& allowed_keys)
    or exists (
      select 1 from jsonb_object_keys(p_settings) supplied(key)
      where not (supplied.key = any(allowed_keys))
    )
    or p_settings ->> 'id' <> 'site'
    or p_settings ->> 'timezone' <> 'Europe/Sofia'
    or p_settings ->> 'currency' <> 'EUR'
    or jsonb_typeof(p_settings -> 'gift_certificates_enabled') <> 'boolean'
    or jsonb_typeof(p_settings -> 'public_booking_enabled') <> 'boolean'
    or jsonb_typeof(p_settings -> 'booking_customer_emails_enabled') <> 'boolean'
    or jsonb_typeof(p_settings -> 'owner_notifications_enabled') <> 'boolean'
    or jsonb_typeof(p_settings -> 'care_emails_enabled') <> 'boolean'
    or (p_settings ->> 'booking_buffer_minutes')::integer not in (15, 30)
    or (p_settings ->> 'public_booking_daily_limit')::integer not between 1 and 8
    or (p_settings ->> 'booking_slot_step_minutes')::integer <> 30
    or (p_settings ->> 'booking_min_lead_minutes')::integer <> 30
    or (p_settings ->> 'booking_horizon_days')::integer not between 1 and 365
    or (p_settings ->> 'booking_hold_minutes')::integer not between 1 and 30
    or ((p_settings ->> 'owner_notifications_enabled')::boolean and
      coalesce(p_settings ->> 'owner_notification_email', '') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    or ((p_settings ->> 'care_emails_enabled')::boolean and
      coalesce(p_settings ->> 'email_review_url', '') !~* '^https://[^[:space:]]+$') then
    raise exception using errcode = '22023', message = 'invalid_booking_settings';
  end if;

  update public.admin_site_settings set
    audit_log_retention_days = (p_settings ->> 'audit_log_retention_days')::integer,
    booking_buffer_minutes = (p_settings ->> 'booking_buffer_minutes')::integer,
    business_name = p_settings ->> 'business_name', cookie_privacy_mode = p_settings ->> 'cookie_privacy_mode',
    currency = p_settings ->> 'currency', daily_slot_capacity = (p_settings ->> 'daily_slot_capacity')::integer,
    default_locale = p_settings ->> 'default_locale', default_seo_title = p_settings ->> 'default_seo_title',
    email_sender = p_settings ->> 'email_sender', google_calendar_id = p_settings ->> 'google_calendar_id',
    google_calendar_mode = p_settings ->> 'google_calendar_mode',
    gift_certificates_enabled = (p_settings ->> 'gift_certificates_enabled')::boolean,
    reminder_template = p_settings ->> 'reminder_template', roles_policy = p_settings ->> 'roles_policy',
    stripe_mode = p_settings ->> 'stripe_mode', timezone = p_settings ->> 'timezone',
    updated_on = (p_settings ->> 'updated_on')::date, working_days = p_settings ->> 'working_days',
    working_hours = p_settings ->> 'working_hours',
    public_booking_enabled = (p_settings ->> 'public_booking_enabled')::boolean,
    public_booking_daily_limit = (p_settings ->> 'public_booking_daily_limit')::integer,
    booking_slot_step_minutes = (p_settings ->> 'booking_slot_step_minutes')::integer,
    booking_min_lead_minutes = (p_settings ->> 'booking_min_lead_minutes')::integer,
    booking_horizon_days = (p_settings ->> 'booking_horizon_days')::integer,
    booking_hold_minutes = (p_settings ->> 'booking_hold_minutes')::integer,
    booking_customer_emails_enabled = (p_settings ->> 'booking_customer_emails_enabled')::boolean,
    owner_notifications_enabled = (p_settings ->> 'owner_notifications_enabled')::boolean,
    care_emails_enabled = (p_settings ->> 'care_emails_enabled')::boolean,
    owner_notification_email = lower(btrim(p_settings ->> 'owner_notification_email')),
    email_review_url = btrim(p_settings ->> 'email_review_url')
  where id = 'site'
  returning * into saved_settings;
  if not found then raise exception using errcode = 'P0002', message = 'booking_settings_not_found'; end if;

  insert into public.admin_audit_log (actor_user_id, action, entity_table, entity_id, metadata)
  values (p_actor_user_id, 'site.booking_settings', 'admin_site_settings', 'site', jsonb_build_object(
    'public_booking_enabled', saved_settings.public_booking_enabled,
    'public_booking_daily_limit', saved_settings.public_booking_daily_limit,
    'booking_buffer_minutes', saved_settings.booking_buffer_minutes,
    'booking_slot_step_minutes', saved_settings.booking_slot_step_minutes,
    'booking_min_lead_minutes', saved_settings.booking_min_lead_minutes,
    'booking_horizon_days', saved_settings.booking_horizon_days,
    'booking_hold_minutes', saved_settings.booking_hold_minutes,
    'working_days', saved_settings.working_days,
    'working_hours', saved_settings.working_hours,
    'booking_customer_emails_enabled', saved_settings.booking_customer_emails_enabled,
    'owner_notifications_enabled', saved_settings.owner_notifications_enabled,
    'care_emails_enabled', saved_settings.care_emails_enabled
  ));
  return to_jsonb(saved_settings);
end;
$$;

alter function public.admin_save_record_with_audit(text, jsonb, uuid, text, jsonb)
  rename to admin_save_record_with_audit_pre_email;

create function public.admin_save_record_with_audit(
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

create function public.admin_save_appointment_with_audit_v2(
  p_record jsonb,
  p_actor_user_id uuid,
  p_action text,
  p_audit_metadata jsonb,
  p_notify_client boolean default true
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  before_record jsonb;
  after_record jsonb;
  has_email boolean;
  notification_preference boolean;
begin
  if p_notify_client is null then
    raise exception using errcode = '22023', message = 'invalid_notify_client';
  end if;
  select to_jsonb(appointment) into before_record
  from public.admin_appointments appointment where appointment.id = p_record ->> 'id';

  select coalesce(
    nullif(lower(btrim(existing.public_email_snapshot)), ''),
    nullif(lower(btrim(client.email)), '')
  ) is not null
  into has_email
  from public.admin_clients client
  left join public.admin_appointments existing on existing.id = p_record ->> 'id'
  where client.id = p_record ->> 'client_id';

  notification_preference := case
    when before_record is null then p_notify_client and coalesce(has_email, false)
    when (before_record ->> 'status') is distinct from 'confirmed'
      and p_record ->> 'status' = 'confirmed' and p_notify_client then coalesce(has_email, false)
    else coalesce((before_record ->> 'customer_email_notifications_enabled')::boolean, false)
  end;
  perform set_config('app.customer_email_notifications_enabled', notification_preference::text, true);

  perform public.admin_save_appointment_with_audit(
    p_record, p_actor_user_id, p_action,
    p_audit_metadata || jsonb_build_object('notifyClient', p_notify_client)
  );
  perform set_config('app.customer_email_notifications_enabled', '', true);

  select to_jsonb(appointment) into after_record
  from public.admin_appointments appointment where appointment.id = p_record ->> 'id';
  perform public.email_enqueue_appointment_transition(before_record, after_record, p_notify_client);
end;
$$;

-- Least-privilege function boundary. Internal composition helpers are callable
-- only by their SECURITY DEFINER parents; API-facing functions require service_role.
revoke all on function public.email_appointment_payload(text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.email_apply_appointment_notification_preference() from public, anon, authenticated, service_role;
revoke all on function public.email_address_hash(text) from public, anon, authenticated, service_role;
revoke all on function public.email_current_appointment_recipient(text) from public, anon, authenticated, service_role;
revoke all on function public.email_current_notification_recipient(uuid) from public, anon, authenticated, service_role;
revoke all on function public.email_enqueue_appointment_transition(jsonb, jsonb, boolean) from public, anon, authenticated, service_role;
revoke all on function public.email_enqueue_appointment_transition_impl(jsonb, jsonb, boolean) from public, anon, authenticated, service_role;
revoke all on function public.admin_save_record_with_audit_pre_email(text, jsonb, uuid, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.admin_save_record_with_audit(text, jsonb, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_save_appointment_with_audit_v2(jsonb, uuid, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.admin_save_booking_settings_with_audit(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.public_booking_confirm_session_v5(
  text, uuid, integer, text, text, text, text, text, text, text, text, boolean, boolean
) from public, anon, authenticated;
revoke all on function public.email_claim_notifications(integer, integer) from public, anon, authenticated;
revoke all on function public.email_prepare_claimed_notification(uuid, uuid) from public, anon, authenticated;
revoke all on function public.email_complete_notification(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.email_fail_notification(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.email_cancel_notification(uuid, text) from public, anon, authenticated;
revoke all on function public.email_record_webhook_event(text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.email_cleanup_personal_data() from public, anon, authenticated;
revoke all on function public.email_unsubscribe_care_by_notification(uuid) from public, anon, authenticated;
revoke all on function public.admin_list_email_notifications(text, text) from public, anon, authenticated;
revoke all on function public.admin_retry_email_notification(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_clear_email_suppression_by_notification(uuid, uuid) from public, anon, authenticated;
revoke all on function public.email_install_worker_cron() from public, anon, authenticated;

grant execute on function public.admin_save_record_with_audit(text, jsonb, uuid, text, jsonb) to service_role;
grant execute on function public.admin_save_appointment_with_audit_v2(jsonb, uuid, text, jsonb, boolean) to service_role;
grant execute on function public.admin_save_booking_settings_with_audit(uuid, jsonb) to service_role;
grant execute on function public.public_booking_confirm_session_v5(
  text, uuid, integer, text, text, text, text, text, text, text, text, boolean, boolean
) to service_role;
grant execute on function public.email_claim_notifications(integer, integer) to service_role;
grant execute on function public.email_prepare_claimed_notification(uuid, uuid) to service_role;
grant execute on function public.email_complete_notification(uuid, uuid, text) to service_role;
grant execute on function public.email_fail_notification(uuid, uuid, text, boolean) to service_role;
grant execute on function public.email_cancel_notification(uuid, text) to service_role;
grant execute on function public.email_record_webhook_event(text, text, text, text, timestamptz) to service_role;
grant execute on function public.email_cleanup_personal_data() to service_role;
grant execute on function public.email_unsubscribe_care_by_notification(uuid) to service_role;
grant execute on function public.admin_list_email_notifications(text, text) to service_role;
grant execute on function public.admin_retry_email_notification(uuid, uuid, text) to service_role;
grant execute on function public.admin_clear_email_suppression_by_notification(uuid, uuid) to service_role;
grant execute on function public.email_install_worker_cron() to service_role;

do $$
begin
  perform public.email_install_worker_cron();
end;
$$;

comment on table public.email_notifications is
  'Transactional outbox. Recipient and payload PII are redacted 90 days after terminal delivery.';
comment on function public.public_booking_confirm_session_v5(
  text, uuid, integer, text, text, text, text, text, text, text, text, boolean, boolean
) is 'Atomic public booking confirmation, optional care consent, and feature-gated email enqueue.';
