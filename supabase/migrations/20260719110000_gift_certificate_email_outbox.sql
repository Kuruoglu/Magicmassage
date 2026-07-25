-- Persist gift orders before Stripe creation and enqueue fulfillment atomically.
-- Existing fulfillment locks are intentionally preserved as historical records.

alter table public.gift_certificate_orders
  add column if not exists idempotency_key text,
  add column if not exists payload_hash text,
  add column if not exists purchase_mode text,
  add column if not exists delivery_mode text,
  add column if not exists recipient_message text,
  add column if not exists service_items jsonb,
  add column if not exists amount_voucher_eur integer,
  add column if not exists expires_on date,
  add column if not exists order_payload jsonb,
  add column if not exists paid_at timestamptz,
  add column if not exists cleanup_claimed_at timestamptz;

create unique index if not exists gift_certificate_orders_idempotency_key_idx
  on public.gift_certificate_orders (idempotency_key)
  where idempotency_key is not null;

create index if not exists gift_certificate_orders_abandoned_cleanup_idx
  on public.gift_certificate_orders (created_at, cleanup_claimed_at)
  where status = 'pending' and order_payload is not null;

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

create or replace function public.gift_create_pending_order(
  p_order_id uuid,
  p_idempotency_key text,
  p_certificate_code text,
  p_payload_hash text,
  p_order_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.gift_certificate_orders%rowtype;
  v_total integer;
  v_amount_voucher integer;
begin
  if p_order_id is null
    or nullif(btrim(p_idempotency_key), '') is null
    or length(p_idempotency_key) > 255
    or p_certificate_code !~ '^MMN-GC-[0-9]{8}-[A-Z0-9]{8}$'
    or p_payload_hash !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_order_payload) <> 'object'
  then
    raise exception 'invalid gift certificate order';
  end if;

  v_total := (p_order_payload ->> 'totalEurCents')::integer;
  v_amount_voucher := nullif(p_order_payload ->> 'amountVoucherEur', '')::integer;

  if v_total <= 0
    or (p_order_payload ->> 'locale') not in ('bg', 'ru', 'ua', 'en')
    or (p_order_payload ->> 'purchaseMode') not in ('self', 'gift')
    or (p_order_payload ->> 'deliveryMode') not in ('buyer_only', 'recipient_email')
    or nullif(btrim(p_order_payload ->> 'purchaserEmail'), '') is null
    or nullif(btrim(p_order_payload ->> 'purchaserName'), '') is null
    or nullif(btrim(p_order_payload ->> 'recipientName'), '') is null
    or jsonb_typeof(p_order_payload -> 'serviceItems') <> 'array'
    or nullif(p_order_payload ->> 'expiresOn', '') is null
  then
    raise exception 'invalid gift certificate order payload';
  end if;

  insert into public.gift_certificate_orders (
    id,
    idempotency_key,
    payload_hash,
    certificate_code,
    locale,
    amount_eur_cents,
    purchaser_email,
    purchaser_name,
    recipient_email,
    recipient_name,
    purchase_mode,
    delivery_mode,
    recipient_message,
    service_items,
    amount_voucher_eur,
    expires_on,
    order_payload,
    status
  )
  values (
    p_order_id,
    btrim(p_idempotency_key),
    p_payload_hash,
    p_certificate_code,
    p_order_payload ->> 'locale',
    v_total,
    lower(p_order_payload ->> 'purchaserEmail'),
    p_order_payload ->> 'purchaserName',
    nullif(lower(p_order_payload ->> 'recipientEmail'), ''),
    p_order_payload ->> 'recipientName',
    p_order_payload ->> 'purchaseMode',
    p_order_payload ->> 'deliveryMode',
    nullif(p_order_payload ->> 'recipientMessage', ''),
    p_order_payload -> 'serviceItems',
    v_amount_voucher,
    (p_order_payload ->> 'expiresOn')::date,
    p_order_payload,
    'pending'
  )
  on conflict (idempotency_key) where idempotency_key is not null do nothing;

  select *
  into v_existing
  from public.gift_certificate_orders
  where idempotency_key = btrim(p_idempotency_key)
  for update;

  if not found or v_existing.payload_hash is distinct from p_payload_hash then
    raise exception 'gift certificate idempotency key was reused with a different order';
  end if;

  return to_jsonb(v_existing);
exception
  when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
    raise exception 'invalid gift certificate order payload';
end;
$$;

create or replace function public.gift_attach_payment_intent(
  p_order_id uuid,
  p_payment_intent_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_payment_intent_id text;
begin
  if p_order_id is null
    or p_payment_intent_id !~ '^pi_[A-Za-z0-9_]+$'
    or length(p_payment_intent_id) > 255
  then
    raise exception 'invalid payment intent reference';
  end if;

  select payment_intent_id
  into v_existing_payment_intent_id
  from public.gift_certificate_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'gift certificate order not found';
  end if;

  if v_existing_payment_intent_id is not null
    and v_existing_payment_intent_id <> p_payment_intent_id
  then
    raise exception 'gift certificate order already has another payment intent';
  end if;

  update public.gift_certificate_orders
  set payment_intent_id = p_payment_intent_id,
      updated_at = now()
  where id = p_order_id;
end;
$$;

create or replace function public.gift_load_order_for_email(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select to_jsonb(gift_order)
  from public.gift_certificate_orders as gift_order
  where gift_order.id = p_order_id
    and gift_order.order_payload is not null;
$$;

create or replace function public.gift_mark_paid_and_enqueue(
  p_order_id uuid,
  p_payment_intent_id text,
  p_certificate_code text,
  p_total_eur_cents integer,
  p_locale text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.gift_certificate_orders%rowtype;
  v_certificate public.admin_certificates%rowtype;
  v_newly_paid boolean;
  v_owner_email text;
begin
  select *
  into v_order
  from public.gift_certificate_orders
  where id = p_order_id
  for update;

  if not found or v_order.order_payload is null then
    raise exception 'gift certificate order not found';
  end if;

  if v_order.payment_intent_id is not null
    and v_order.payment_intent_id <> p_payment_intent_id
  then
    raise exception 'payment intent does not match gift certificate order';
  end if;

  if v_order.certificate_code <> p_certificate_code
    or v_order.amount_eur_cents <> p_total_eur_cents
    or v_order.locale <> p_locale
  then
    raise exception 'payment metadata does not match gift certificate order';
  end if;

  v_newly_paid := v_order.status = 'pending';

  select case
    when owner_notifications_enabled then nullif(lower(btrim(owner_notification_email)), '')
    else null
  end
  into v_owner_email
  from public.admin_site_settings
  where id = 'site';

  update public.gift_certificate_orders
  set payment_intent_id = p_payment_intent_id,
      status = case when status = 'pending' then 'paid' else status end,
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
  where id = v_order.id;

  insert into public.admin_certificates (
    code,
    client_name_snapshot,
    buyer_name,
    buyer_email,
    recipient_name,
    amount_cents,
    currency,
    status,
    stripe_payment_intent_id,
    paid_on,
    expires_on,
    history
  )
  values (
    v_order.certificate_code,
    v_order.recipient_name,
    v_order.purchaser_name,
    v_order.purchaser_email,
    v_order.recipient_name,
    v_order.amount_eur_cents,
    'EUR',
    'pending_pdf',
    p_payment_intent_id,
    current_date,
    v_order.expires_on,
    jsonb_build_array(jsonb_build_object(
      'action', 'paid_online',
      'at', now(),
      'paymentIntentId', p_payment_intent_id
    ))
  )
  on conflict (code) do nothing;

  select *
  into v_certificate
  from public.admin_certificates
  where code = v_order.certificate_code
  for update;

  if not found
    or v_certificate.stripe_payment_intent_id is distinct from p_payment_intent_id
    or v_certificate.amount_cents is distinct from v_order.amount_eur_cents
    or v_certificate.currency is distinct from 'EUR'
    or v_certificate.buyer_name is distinct from v_order.purchaser_name
    or v_certificate.buyer_email is distinct from v_order.purchaser_email
    or v_certificate.recipient_name is distinct from v_order.recipient_name
    or v_certificate.expires_on is distinct from v_order.expires_on
  then
    raise exception using
      errcode = '23505',
      message = 'gift certificate code belongs to another certificate';
  end if;

  insert into public.email_notifications (
    event_type,
    aggregate_type,
    aggregate_id,
    dedupe_key,
    recipient_email,
    locale,
    template_key,
    template_version,
    payload,
    due_at,
    status
  )
  values (
    'gift_buyer',
    'certificate',
    v_order.certificate_code,
    'gift:' || v_order.id || ':buyer',
    v_order.purchaser_email,
    v_order.locale,
    'gift_buyer',
    1,
    jsonb_build_object(
      'gift_order_id', v_order.id,
      'certificate_code', v_order.certificate_code
    ),
    now(),
    'pending'
  )
  on conflict (dedupe_key) do nothing;

  if v_order.delivery_mode = 'recipient_email' and v_order.recipient_email is not null then
    insert into public.email_notifications (
      event_type,
      aggregate_type,
      aggregate_id,
      dedupe_key,
      recipient_email,
      locale,
      template_key,
      template_version,
      payload,
      due_at,
      status
    )
    values (
      'gift_recipient',
      'certificate',
      v_order.certificate_code,
      'gift:' || v_order.id || ':recipient',
      v_order.recipient_email,
      v_order.locale,
      'gift_recipient',
      1,
      jsonb_build_object(
        'gift_order_id', v_order.id,
        'certificate_code', v_order.certificate_code
      ),
      now(),
      'pending'
    )
    on conflict (dedupe_key) do nothing;
  end if;

  if v_owner_email is not null then
    insert into public.email_notifications (
      event_type,
      aggregate_type,
      aggregate_id,
      dedupe_key,
      recipient_email,
      locale,
      template_key,
      template_version,
      payload,
      due_at,
      status
    )
    values (
      'owner_gift_purchase',
      'certificate',
      v_order.certificate_code,
      'gift:' || v_order.id || ':owner',
      v_owner_email,
      'bg',
      'owner_gift_purchase',
      1,
      jsonb_build_object(
        'gift_order_id', v_order.id,
        'certificate_code', v_order.certificate_code
      ),
      now(),
      'pending'
    )
    on conflict (dedupe_key) do nothing;
  end if;

  return jsonb_build_object('newly_paid', v_newly_paid);
end;
$$;

create or replace function public.gift_sync_certificate_delivery_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_order public.gift_certificate_orders%rowtype;
  v_buyer_status text;
  v_recipient_status text;
  v_recipient_required boolean;
begin
  if new.aggregate_type <> 'certificate'
    or new.event_type not in ('gift_buyer', 'gift_recipient')
  then
    return new;
  end if;

  begin
    v_order_id := (new.payload ->> 'gift_order_id')::uuid;
  exception when invalid_text_representation then
    return new;
  end;

  select *
  into v_order
  from public.gift_certificate_orders
  where id = v_order_id;

  if not found then
    return new;
  end if;

  select status::text
  into v_buyer_status
  from public.email_notifications
  where aggregate_type = 'certificate'
    and aggregate_id = v_order.certificate_code
    and event_type = 'gift_buyer'
    and lower(recipient_email) = lower(v_order.purchaser_email)
  order by created_at desc, id desc
  limit 1;

  v_recipient_required := v_order.delivery_mode = 'recipient_email'
    and v_order.recipient_email is not null;

  if v_recipient_required then
    select status::text
    into v_recipient_status
    from public.email_notifications
    where aggregate_type = 'certificate'
      and aggregate_id = v_order.certificate_code
      and event_type = 'gift_recipient'
      and lower(recipient_email) = lower(v_order.recipient_email)
    order by created_at desc, id desc
    limit 1;
  end if;

  if v_buyer_status in ('failed', 'dead_letter', 'suppressed', 'blocked')
    or (v_recipient_required
      and v_recipient_status in ('failed', 'dead_letter', 'suppressed', 'blocked'))
  then
    update public.gift_certificate_orders
    set status = 'fulfillment_failed', updated_at = now()
    where id = v_order_id;

    update public.admin_certificates
    set status = 'pending_pdf', updated_at = now()
    where code = v_order.certificate_code
      and status in ('paid', 'pending_pdf', 'sent');
  elsif v_buyer_status in ('sent', 'delivered')
    and (not v_recipient_required or v_recipient_status in ('sent', 'delivered'))
  then
    update public.gift_certificate_orders
    set status = 'fulfilled', updated_at = now()
    where id = v_order_id;

    update public.admin_certificates
    set status = 'sent', updated_at = now()
    where code = v_order.certificate_code
      and status in ('paid', 'pending_pdf');
  else
    update public.gift_certificate_orders
    set status = 'paid', updated_at = now()
    where id = v_order_id;

    update public.admin_certificates
    set status = 'pending_pdf', updated_at = now()
    where code = v_order.certificate_code
      and status in ('paid', 'pending_pdf');
  end if;

  return new;
end;
$$;

drop trigger if exists gift_sync_certificate_delivery_status
  on public.email_notifications;
create trigger gift_sync_certificate_delivery_status
after update of status on public.email_notifications
for each row
when (old.status is distinct from new.status)
execute function public.gift_sync_certificate_delivery_status();

create or replace function public.admin_list_gift_certificate_reconciliation(
  p_actor_user_id uuid
)
returns table (
  order_id uuid,
  certificate_code text,
  amount_eur_cents integer,
  order_status text,
  created_at timestamptz,
  has_payment_reference boolean,
  has_certificate boolean,
  can_reconcile boolean,
  reconciliation_reason text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1
    from public.admin_profiles profile
    where profile.user_id = p_actor_user_id
      and profile.status = 'active'
      and profile.role in ('owner', 'administrator')
  ) then
    raise exception using errcode = '42501', message = 'gift_reconciliation_forbidden';
  end if;

  return query
  select
    gift_order.id,
    gift_order.certificate_code,
    gift_order.amount_eur_cents,
    gift_order.status,
    gift_order.created_at,
    gift_order.payment_intent_id is not null,
    certificate.code is not null,
    gift_order.payment_intent_id is not null and gift_order.order_payload is not null,
    case
      when gift_order.order_payload is null then 'legacy_order_requires_review'
      when gift_order.payment_intent_id is null then 'payment_reference_missing'
      when certificate.code is null then 'certificate_missing'
      else 'fulfillment_incomplete'
    end
  from public.gift_certificate_orders gift_order
  left join public.admin_certificates certificate
    on certificate.code = gift_order.certificate_code
  where gift_order.status in ('pending', 'paid', 'fulfillment_failed')
    and (
      gift_order.status <> 'pending'
      or (
        gift_order.created_at <= now() - interval '15 minutes'
        and gift_order.payment_intent_id is not null
      )
    )
    and (
      certificate.code is null
      or not exists (
        select 1
        from public.email_notifications notification
        where notification.aggregate_type = 'certificate'
          and notification.aggregate_id = gift_order.certificate_code
          and notification.event_type = 'gift_buyer'
      )
      or (
        gift_order.delivery_mode = 'recipient_email'
        and gift_order.recipient_email is not null
        and not exists (
          select 1
          from public.email_notifications notification
          where notification.aggregate_type = 'certificate'
            and notification.aggregate_id = gift_order.certificate_code
            and notification.event_type = 'gift_recipient'
        )
      )
    )
  order by gift_order.created_at desc, gift_order.id desc
  limit 100;
end;
$$;

create or replace function public.admin_reconcile_gift_certificate_order(
  p_actor_user_id uuid,
  p_order_id uuid,
  p_payment_intent_id text,
  p_certificate_code text,
  p_total_eur_cents integer,
  p_locale text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
begin
  if not exists (
    select 1
    from public.admin_profiles profile
    where profile.user_id = p_actor_user_id
      and profile.status = 'active'
      and profile.role in ('owner', 'administrator')
  ) then
    raise exception using errcode = '42501', message = 'gift_reconciliation_forbidden';
  end if;

  v_result := public.gift_mark_paid_and_enqueue(
    p_order_id,
    p_payment_intent_id,
    p_certificate_code,
    p_total_eur_cents,
    p_locale
  );

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    p_actor_user_id,
    'gift_certificate.reconcile',
    'gift_certificate_orders',
    p_order_id::text,
    jsonb_build_object(
      'certificate_code', p_certificate_code,
      'newly_paid', coalesce((v_result ->> 'newly_paid')::boolean, false)
    )
  );

  return v_result;
end;
$$;

revoke all on function public.gift_create_pending_order(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.gift_claim_abandoned_pending_orders(integer) from public, anon, authenticated;
revoke all on function public.gift_redact_abandoned_pending_order(uuid, text) from public, anon, authenticated;
revoke all on function public.gift_attach_payment_intent(uuid, text) from public, anon, authenticated;
revoke all on function public.gift_load_order_for_email(uuid) from public, anon, authenticated;
revoke all on function public.gift_mark_paid_and_enqueue(uuid, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.gift_sync_certificate_delivery_status() from public, anon, authenticated;
revoke all on function public.admin_list_gift_certificate_reconciliation(uuid) from public, anon, authenticated;
revoke all on function public.admin_reconcile_gift_certificate_order(uuid, uuid, text, text, integer, text) from public, anon, authenticated;

grant execute on function public.gift_create_pending_order(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.gift_claim_abandoned_pending_orders(integer) to service_role;
grant execute on function public.gift_redact_abandoned_pending_order(uuid, text) to service_role;
grant execute on function public.gift_attach_payment_intent(uuid, text) to service_role;
grant execute on function public.gift_load_order_for_email(uuid) to service_role;
grant execute on function public.gift_mark_paid_and_enqueue(uuid, text, text, integer, text) to service_role;
grant execute on function public.admin_list_gift_certificate_reconciliation(uuid) to service_role;
grant execute on function public.admin_reconcile_gift_certificate_order(uuid, uuid, text, text, integer, text) to service_role;

comment on function public.gift_mark_paid_and_enqueue(uuid, text, text, integer, text)
  is 'Atomically marks a persisted gift order paid, creates its certificate, and idempotently queues independent email deliveries.';
