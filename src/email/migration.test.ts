import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260719100000_transactional_email_outbox.sql"), "utf8");
const publicBookingSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260716100000_multi_specialist_access_security.sql"),
  "utf8",
);

describe("transactional email outbox migration", () => {
  it("protects the outbox, webhook ledger, and suppression registry with RLS", () => {
    for (const table of ["email_notifications", "email_webhook_events", "email_suppressions"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
    }
  });

  it("claims bounded work with skip-locked leases and owns the retry schedule in SQL", () => {
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("limit p_batch_size");
    expect(sql).toContain("p_batch_size not between 1 and 25");
    for (const delay of ["1 minute", "5 minutes", "15 minutes", "1 hour", "3 hours", "6 hours", "12 hours", "24 hours"]) {
      expect(sql).toContain(`interval '${delay}'`);
    }
    expect(sql).toContain("lease_expired_after_final_attempt");
    expect(sql).toContain("notification.attempt_count >= 9");
    expect(sql).toContain("notification.attempt_count < 9");
    expect(sql).toContain("p_retryable and attempts <= 8");
    expect(sql).toContain("attempt_count between 0 and 9");
  });

  it("queues booking confirmation atomically in v5 without granting browser execution", () => {
    const transitionBoundary = sql.indexOf("create function public.email_enqueue_appointment_transition(");
    const functionStart = sql.indexOf("create function public.public_booking_confirm_session_v5");
    const transitionImplementation = sql.indexOf("create function public.email_enqueue_appointment_transition_impl(");
    const grant = sql.indexOf("grant execute on function public.public_booking_confirm_session_v5");
    expect(transitionBoundary).toBeGreaterThan(-1);
    expect(transitionBoundary).toBeLessThan(functionStart);
    expect(transitionImplementation).toBeGreaterThan(functionStart);
    expect(sql.match(/create function public\.email_enqueue_appointment_transition\(/g)).toHaveLength(1);
    expect(functionStart).toBeGreaterThan(-1);
    expect(sql.slice(functionStart, grant)).toContain("public.public_booking_confirm_session_v4(");
    expect(sql.slice(functionStart, grant)).toContain("email_enqueue_appointment_transition");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql.slice(grant, grant + 220)).toContain("to service_role");
  });

  it("persists the notification preference inside the original appointment write without a second version bump", () => {
    const v2Start = sql.indexOf("create function public.admin_save_appointment_with_audit_v2(");
    const grantsStart = sql.indexOf("-- Least-privilege function boundary", v2Start);
    const v2 = sql.slice(v2Start, grantsStart);
    expect(sql).toContain("create trigger apply_email_notification_preference");
    expect(sql).toContain("current_setting('app.customer_email_notifications_enabled', true)");
    expect(v2).toContain("set_config('app.customer_email_notifications_enabled', notification_preference::text, true)");
    expect(v2).not.toContain("update public.admin_appointments");
  });

  it("records the first confirmation independently of feature flags and never queues it twice", () => {
    expect(sql).toContain("create table public.email_appointment_event_history");
    expect(sql).toContain("values (appointment.id, 'first_confirmed')");
    expect(sql).toContain("and first_confirmation_transition");
    expect(sql).toContain("'booking_confirmed:' || appointment.id || ':first'");
    expect(sql).toContain("alter table public.email_appointment_event_history enable row level security");
  });

  it("uses each public booking's submitted email even when the returning client profile is old or empty", () => {
    const recipientHelperStart = sql.indexOf("create function public.email_current_appointment_recipient");
    const recipientHelperEnd = sql.indexOf("create function public.email_current_notification_recipient", recipientHelperStart);
    const recipientHelper = sql.slice(recipientHelperStart, recipientHelperEnd);
    expect(recipientHelperStart).toBeGreaterThan(-1);
    expect(recipientHelper).toContain("when appointment.origin = 'public'");
    expect(recipientHelper).toContain("appointment.public_email_snapshot");
    expect(recipientHelper).toContain("else nullif(lower(btrim(client.email)), '')");
    expect(recipientHelper.indexOf("appointment.public_email_snapshot")).toBeLessThan(
      recipientHelper.indexOf("client.email"),
    );

    const publicConfirmStart = publicBookingSql.indexOf("create or replace function public.public_booking_confirm(");
    const publicConfirmEnd = publicBookingSql.indexOf("revoke all on function public.public_booking_confirm(", publicConfirmStart);
    const publicConfirm = publicBookingSql.slice(publicConfirmStart, publicConfirmEnd);
    expect(publicConfirm).toContain("public_phone_snapshot, public_email_snapshot");
    expect(publicConfirm).toContain("btrim(p_phone), nullif(lower(btrim(p_email)), '')");
    expect(publicConfirm).not.toContain("email = excluded.email");
  });

  it("expires late reminders and replaces stale appointment recipients from the authoritative booking source", () => {
    expect(sql).toContain("notification.due_at + interval '30 minutes'");
    expect(sql).toContain("reminder_delivery_window_expired");
    expect(sql).toContain("recipient_address_changed");
    expect(sql).toContain("'recipient-replacement:' || notification.id");
    expect(sql).toContain("retry_recipient := public.email_current_notification_recipient");
    expect(sql).toContain("retry_recipient, original.locale");
  });

  it("cancels stale schedule snapshots and revalidates the current appointment time", () => {
    const prepareStart = sql.indexOf("create function public.email_prepare_claimed_notification");
    const prepareEnd = sql.indexOf("create function public.email_complete_notification", prepareStart);
    const prepareFunction = sql.slice(prepareStart, prepareEnd);
    const enqueueStart = sql.indexOf("create function public.email_enqueue_appointment_transition_impl");
    const enqueueEnd = sql.indexOf(
      "create or replace function public.admin_save_booking_settings_with_audit",
      enqueueStart,
    );
    const enqueueFunction = sql.slice(enqueueStart, enqueueEnd);

    expect(prepareFunction).toContain("schedule_is_current := coalesce(");
    expect(prepareFunction).toContain(
      "notification.payload ->> 'date' = appointment.starts_on::text",
    );
    expect(prepareFunction).toContain(
      "notification.payload ->> 'time' = to_char(appointment.starts_at, 'HH24:MI')",
    );
    expect(prepareFunction.match(/and schedule_is_current/g)).toHaveLength(5);
    expect(enqueueFunction).toContain(
      "event_type in ('booking_confirmed', 'booking_rescheduled', 'booking_reminder_24h')",
    );
  });

  it("corrects a public booking snapshot and audits hashes before retrying a bounced address", () => {
    const retryStart = sql.indexOf("create function public.admin_retry_email_notification");
    const retryEnd = sql.indexOf("create function public.admin_clear_email_suppression_by_notification", retryStart);
    const retryFunction = sql.slice(retryStart, retryEnd);
    expect(retryFunction).toContain("p_corrected_email text default null");
    expect(retryFunction).toContain("appointment.origin <> 'public'");
    expect(retryFunction).toContain("set public_email_snapshot = corrected_email");
    expect(retryFunction).toContain("'appointment.public_email_corrected'");
    expect(retryFunction).toContain("'previous_email_hash'");
    expect(retryFunction).toContain("'corrected_email_hash'");
    expect(retryFunction).not.toContain("'previous_email',");
    expect(retryFunction).not.toContain("'corrected_email',");
  });

  it("queues public care mail to the booking snapshot selected by the shared recipient helper", () => {
    const enqueueStart = sql.indexOf("create function public.email_enqueue_appointment_transition_impl");
    const enqueueEnd = sql.indexOf("create or replace function public.admin_save_booking_settings_with_audit", enqueueStart);
    const enqueueFunction = sql.slice(enqueueStart, enqueueEnd);
    expect(enqueueFunction).toContain("recipient := coalesce(public.email_current_appointment_recipient(appointment.id), '')");
    expect(enqueueFunction).toContain("client.care_email_consent_at is not null");
    expect(enqueueFunction).toContain("client.care_email_withdrawn_at is null");
    expect(enqueueFunction).toContain(
      "client.care_email_consent_email_hash = public.email_address_hash(recipient)",
    );
    expect(enqueueFunction).toContain("'booking_care', 1, payload_value, care_due");
  });

  it("binds public care consent to the appointment snapshot without requiring a stale CRM email match", () => {
    const confirmStart = sql.indexOf("create function public.public_booking_confirm_session_v5");
    const confirmEnd = sql.indexOf("create function public.email_unsubscribe_care_by_notification", confirmStart);
    const confirmFunction = sql.slice(confirmStart, confirmEnd);

    expect(confirmFunction).toContain(
      "nullif(lower(btrim(p_email)), '') is distinct from nullif(lower(btrim(appointment.public_email_snapshot)), '')",
    );
    expect(confirmFunction).not.toContain(
      "nullif(lower(btrim(client.email)), '') is distinct from",
    );
    expect(confirmFunction).toContain(
      "care_email_consent_email_hash = public.email_address_hash(appointment.public_email_snapshot)",
    );
    expect(confirmFunction.indexOf("raise exception using errcode = '22023'")).toBeLessThan(
      confirmFunction.indexOf("care_email_consent_at = now()"),
    );
  });

  it("never cancels or suppresses an actively processing provider delivery", () => {
    const enqueueStart = sql.indexOf("create function public.email_enqueue_appointment_transition_impl");
    const enqueueEnd = sql.indexOf("create or replace function public.admin_save_booking_settings_with_audit", enqueueStart);
    const enqueueFunction = sql.slice(enqueueStart, enqueueEnd);

    expect(enqueueFunction).toContain("and status = 'pending'");
    expect(enqueueFunction).not.toContain("and status in ('pending', 'processing')");
    expect(sql).toContain("where notification.status = 'pending'");
    expect(sql).toContain("where id = p_notification_id and status = 'pending'");
    expect(sql).toContain("where lower(recipient_email) = normalized_email and status = 'pending'");
    expect(sql.match(/status in \('pending', 'processing'\)/g)).toHaveLength(2);
  });

  it("uses optimistic consent expectations and server-owned consent timestamps", () => {
    const saveStart = sql.indexOf("create function public.admin_save_record_with_audit(");
    const saveEnd = sql.indexOf("create function public.admin_save_appointment_with_audit_v2", saveStart);
    const saveFunction = sql.slice(saveStart, saveEnd);

    expect(saveFunction).toContain("care_email_consent_expectation_required");
    expect(saveFunction).toContain("care_email_consent_conflict");
    expect(saveFunction).toContain("for update");
    expect(saveFunction).toContain("next_consent_at := now()");
    expect(saveFunction).toContain("next_consent_source := 'admin_recorded'");
    expect(saveFunction).toContain("next_withdrawn_at := now()");
  });

  it("provides audited retry, suppression clear, unsubscribe, and 90-day redaction", () => {
    expect(sql).toContain("create function public.admin_retry_email_notification");
    expect(sql).toContain("create function public.admin_clear_email_suppression_by_notification");
    expect(sql).toContain("create function public.email_unsubscribe_care_by_notification");
    expect(sql).toContain("interval '90 days'");
    expect(sql).toContain("set recipient_email = null");
    expect(sql).toContain("make_interval(days => retention_days)");
    expect(sql).toContain("email_hash text primary key");
    expect(sql).not.toContain("email_normalized text primary key");
  });

  it("preserves terminal webhook precedence for out-of-order delivery events", () => {
    expect(sql).toContain("when status = 'suppressed' then 'suppressed'");
    expect(sql.indexOf("when status = 'suppressed' then 'suppressed'")).toBeLessThan(
      sql.indexOf("when p_event_type = 'delivered' then 'delivered'"),
    );
    expect(sql).toContain("when status = 'delivered' then 'delivered'");
    expect(sql).toContain("when status = 'failed' then 'failed'");
    expect(sql).toContain("from public.email_webhook_events event");
    expect(sql).toContain("where event.provider_message_id = p_provider_message_id");
  });

  it("schedules care for the next Sofia day after the completed transition", () => {
    expect(sql).toContain("(now() at time zone 'Europe/Sofia')::date + 1 + time '10:00'");
    expect(sql).toContain("'booking_care', 1, payload_value, care_due");
    expect(sql).not.toContain("greatest(care_due, now())");
  });

  it("keeps email settings disabled by default and enforces required HTTPS/email configuration", () => {
    expect(sql).toContain("booking_customer_emails_enabled boolean not null default false");
    expect(sql).toContain("owner_notifications_enabled boolean not null default false");
    expect(sql).toContain("care_emails_enabled boolean not null default false");
    expect(sql).toContain("not care_emails_enabled or email_review_url");
    expect(sql).toContain("not owner_notifications_enabled");
  });

  it("gives the HTTPS cron invocation enough time for a bounded batch", () => {
    expect(sql).toContain("timeout_milliseconds := 600000");
    expect(sql).toContain("'*/5 * * * *'");
  });
});
