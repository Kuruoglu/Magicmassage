// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260719110000_gift_certificate_email_outbox.sql",
);
const sql = readFileSync(migrationPath, "utf8");

type DeliveryAttempt = {
  createdAt: number;
  event: "gift_buyer" | "gift_recipient";
  recipient: string;
  status: string;
};

function reconcileLatestDelivery(input: {
  attempts: DeliveryAttempt[];
  buyerEmail: string;
  recipientEmail?: string;
}) {
  const latest = (event: DeliveryAttempt["event"], recipient: string) =>
    input.attempts
      .filter(
        (attempt) =>
          attempt.event === event && attempt.recipient.toLowerCase() === recipient.toLowerCase(),
      )
      .sort((left, right) => right.createdAt - left.createdAt)[0]?.status;
  const buyer = latest("gift_buyer", input.buyerEmail);
  const recipient = input.recipientEmail
    ? latest("gift_recipient", input.recipientEmail)
    : undefined;
  const required = [buyer, ...(input.recipientEmail ? [recipient] : [])];

  if (required.some((status) => ["failed", "suppressed"].includes(status ?? ""))) {
    return "fulfillment_failed";
  }

  return required.every((status) => status === "sent" || status === "delivered")
    ? "fulfilled"
    : "paid";
}

describe("gift certificate email outbox migration", () => {
  it("extends persisted orders without replacing or backfilling historical locks", () => {
    expect(sql).toContain("alter table public.gift_certificate_orders");
    expect(sql).toContain("add column if not exists order_payload jsonb");
    expect(sql).not.toContain("drop table public.gift_certificate_fulfillment_locks");
    expect(sql).not.toMatch(/update\s+public\.gift_certificate_fulfillment_locks/i);
    expect(sql).not.toMatch(/update\s+public\.gift_certificate_orders\s+set\s+order_payload\s*=\s*jsonb/i);
  });

  it("claims abandoned checkout rows for verified cleanup and eventually removes redacted rows", () => {
    const claimFunction = sql.slice(
      sql.indexOf("create or replace function public.gift_claim_abandoned_pending_orders"),
      sql.indexOf("create or replace function public.gift_redact_abandoned_pending_order"),
    );
    const redactFunction = sql.slice(
      sql.indexOf("create or replace function public.gift_redact_abandoned_pending_order"),
      sql.indexOf("create or replace function public.gift_create_pending_order"),
    );

    expect(claimFunction).toContain("for update skip locked");
    expect(claimFunction).toContain("cleanup_claimed_at < now() - interval '30 minutes'");
    expect(claimFunction).toContain("delete from public.gift_certificate_orders");
    expect(claimFunction).toContain("created_at < now() - interval '90 days'");
    expect(redactFunction).toContain("last_fulfillment_error = 'abandoned_pending_order_redacted'");
    expect(redactFunction).toContain("order_payload = null");
    expect(redactFunction).toContain("created_at < now() - interval '7 days'");
    expect(redactFunction).toContain(
      "payment_intent_id is not distinct from nullif(btrim(p_payment_intent_id), '')",
    );
  });

  it("atomically creates the certificate and three independently deduplicated deliveries", () => {
    expect(sql).toContain("create or replace function public.gift_mark_paid_and_enqueue");
    expect(sql).toContain("insert into public.admin_certificates");
    expect(sql).toContain("'gift_buyer'");
    expect(sql).toContain("'gift_recipient'");
    expect(sql).toContain("'owner_gift_purchase'");
    expect(sql).toContain("'gift:' || v_order.id || ':buyer'");
    expect(sql).toContain("'gift:' || v_order.id || ':recipient'");
    expect(sql).toContain("'gift:' || v_order.id || ':owner'");
    expect(sql.match(/on conflict \(dedupe_key\) do nothing/g)).toHaveLength(3);
    expect(sql).toContain("when owner_notifications_enabled then");
    expect(sql).toContain("owner_notification_email");
    expect(sql).not.toContain("p_owner_email");
    expect(sql.match(/'certificate',\s+v_order\.certificate_code/g)).toHaveLength(3);
    expect(sql.match(/'gift_(buyer|recipient)'[\s\S]*?\n\s+1,/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("targets the shared worker schema and keeps delivery payloads minimal", () => {
    for (const column of [
      "event_type",
      "aggregate_type",
      "aggregate_id",
      "dedupe_key",
      "recipient_email",
      "locale",
      "template_key",
      "template_version",
      "payload",
      "due_at",
      "status",
    ]) {
      expect(sql).toContain(column);
    }

    const outboxSection = sql.slice(sql.indexOf("insert into public.email_notifications"));
    expect(outboxSection).not.toContain("purchaser_name");
    expect(outboxSection).not.toContain("recipient_message");
    expect(outboxSection).not.toContain("service_items");
  });

  it("allows webhook retries to recreate only a missing outbox row", () => {
    expect(sql).toContain("v_newly_paid := v_order.status = 'pending'");
    expect(sql).toContain("status = case when status = 'pending' then 'paid' else status end");
    expect(sql).toContain("on conflict (code) do nothing");
    expect(sql.match(/on conflict \(dedupe_key\) do nothing/g)).toHaveLength(3);
    expect(sql).toContain("return jsonb_build_object('newly_paid', v_newly_paid)");
  });

  it("keeps the certificate visibly reconcilable until every customer delivery succeeds", () => {
    expect(sql).toContain("create or replace function public.gift_sync_certificate_delivery_status()");
    expect(sql).toContain("set status = 'fulfillment_failed'");
    expect(sql).toContain("set status = 'fulfilled'");
    expect(sql).toContain("set status = 'pending_pdf'");
    expect(sql).toContain("set status = 'sent'");
    expect(sql).toContain("after update of status on public.email_notifications");
  });

  it("reconciles only the latest buyer and recipient attempts for the current addresses", () => {
    const statusSync = sql.slice(
      sql.indexOf("create or replace function public.gift_sync_certificate_delivery_status()"),
      sql.indexOf("drop trigger if exists gift_sync_certificate_delivery_status"),
    );

    expect(statusSync.match(/order by created_at desc, id desc\s+limit 1/g)).toHaveLength(2);
    expect(statusSync).toContain("event_type = 'gift_buyer'");
    expect(statusSync).toContain("event_type = 'gift_recipient'");
    expect(statusSync).toContain(
      "lower(recipient_email) = lower(v_order.purchaser_email)",
    );
    expect(statusSync).toContain(
      "lower(recipient_email) = lower(v_order.recipient_email)",
    );
    expect(statusSync).not.toContain("event_type in ('gift_buyer', 'gift_recipient')");
  });

  it("allows successful retries to supersede historical failures independently", () => {
    const attempts: DeliveryAttempt[] = [
      { createdAt: 1, event: "gift_buyer", recipient: "same@example.com", status: "failed" },
      { createdAt: 2, event: "gift_buyer", recipient: "same@example.com", status: "sent" },
      { createdAt: 1, event: "gift_recipient", recipient: "same@example.com", status: "suppressed" },
      { createdAt: 3, event: "gift_recipient", recipient: "same@example.com", status: "delivered" },
      { createdAt: 4, event: "gift_recipient", recipient: "old@example.com", status: "failed" },
    ];

    expect(
      reconcileLatestDelivery({
        attempts,
        buyerEmail: "same@example.com",
        recipientEmail: "same@example.com",
      }),
    ).toBe("fulfilled");

    expect(
      reconcileLatestDelivery({
        attempts: [
          ...attempts,
          { createdAt: 5, event: "gift_recipient", recipient: "same@example.com", status: "failed" },
        ],
        buyerEmail: "same@example.com",
        recipientEmail: "same@example.com",
      }),
    ).toBe("fulfillment_failed");
  });

  it("exposes incomplete orders through an owner/admin-only reconciliation query without PII", () => {
    const listFunction = sql.slice(
      sql.indexOf("create or replace function public.admin_list_gift_certificate_reconciliation"),
      sql.indexOf("create or replace function public.admin_reconcile_gift_certificate_order"),
    );

    expect(listFunction).toContain("profile.role in ('owner', 'administrator')");
    expect(listFunction).toContain("certificate.code is null");
    expect(listFunction).toContain("notification.event_type = 'gift_buyer'");
    expect(listFunction).toContain("notification.event_type = 'gift_recipient'");
    expect(listFunction).toContain("gift_order.payment_intent_id is not null and gift_order.order_payload is not null");
    expect(listFunction).not.toMatch(/select[\s\S]*purchaser_email[\s\S]*from public\.gift_certificate_orders/);
  });

  it("reconciliation reuses the atomic fulfillment function and writes an audit event", () => {
    const reconcileFunction = sql.slice(
      sql.indexOf("create or replace function public.admin_reconcile_gift_certificate_order"),
      sql.indexOf("revoke all on function public.gift_create_pending_order"),
    );

    expect(reconcileFunction).toContain("profile.role in ('owner', 'administrator')");
    expect(reconcileFunction).toContain("public.gift_mark_paid_and_enqueue(");
    expect(reconcileFunction).toContain("'gift_certificate.reconcile'");
    expect(reconcileFunction).not.toContain("recipient_email");
  });

  it("fails closed when a certificate code already belongs to a different purchase", () => {
    const fulfillmentFunction = sql.slice(
      sql.indexOf("create or replace function public.gift_mark_paid_and_enqueue"),
      sql.indexOf("create or replace function public.gift_sync_certificate_delivery_status"),
    );

    expect(fulfillmentFunction).toContain("on conflict (code) do nothing");
    expect(fulfillmentFunction).toContain("from public.admin_certificates");
    expect(fulfillmentFunction).toContain("for update");
    expect(fulfillmentFunction).toContain(
      "v_certificate.stripe_payment_intent_id is distinct from p_payment_intent_id",
    );
    expect(fulfillmentFunction).toContain(
      "v_certificate.amount_cents is distinct from v_order.amount_eur_cents",
    );
    expect(fulfillmentFunction).toContain(
      "v_certificate.recipient_name is distinct from v_order.recipient_name",
    );
    expect(fulfillmentFunction).toContain(
      "message = 'gift certificate code belongs to another certificate'",
    );
    expect(fulfillmentFunction.indexOf("from public.admin_certificates")).toBeLessThan(
      fulfillmentFunction.indexOf("insert into public.email_notifications"),
    );
  });

  it("does not surface fresh unpaid checkouts as broken reconciliation items", () => {
    const listFunction = sql.slice(
      sql.indexOf("create or replace function public.admin_list_gift_certificate_reconciliation"),
      sql.indexOf("create or replace function public.admin_reconcile_gift_certificate_order"),
    );

    expect(listFunction).toContain("gift_order.status <> 'pending'");
    expect(listFunction).toContain("gift_order.created_at <= now() - interval '15 minutes'");
    expect(listFunction).toMatch(
      /gift_order\.created_at <= now\(\) - interval '15 minutes'[\s\S]*gift_order\.payment_intent_id is not null/,
    );
  });
});
