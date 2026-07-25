// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { processEmailOutbox } from "./outbox";
import type { EmailNotification } from "./types";

const mocks = vi.hoisted(() => ({
  loadOrder: vi.fn(),
  prepareGift: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({ rpc: mocks.rpc })),
}));
vi.mock("@/gift-certificates/order-store", () => ({
  createGiftCertificateOrderStore: vi.fn(() => ({ loadOrder: mocks.loadOrder })),
}));
vi.mock("@/gift-certificates/outbox", () => ({
  isGiftCertificateOutboxEventType: (value: string) => ["gift_buyer", "gift_recipient", "owner_gift_purchase"].includes(value),
  prepareGiftCertificateOutboxDelivery: mocks.prepareGift,
}));

function row(overrides: Partial<EmailNotification> = {}): EmailNotification {
  return {
    aggregate_id: "appointment-1",
    aggregate_type: "appointment",
    attempt_count: 1,
    dedupe_key: "booking_confirmed:appointment-1:v1",
    due_at: new Date().toISOString(),
    event_type: "booking_confirmed",
    id: "11111111-1111-4111-8111-111111111111",
    lease_token: "22222222-2222-4222-8222-222222222222",
    locale: "en",
    payload: { serviceName: "Massage" },
    recipient_email: "client@example.com",
    template_key: "booking_confirmed",
    template_version: 1,
    ...overrides,
  };
}

function installRpc(notification: EmailNotification, valid = true) {
  mocks.rpc.mockImplementation(async (functionName: string) => {
    if (functionName === "email_claim_notifications") return { data: [notification], error: null };
    if (functionName === "email_prepare_claimed_notification") {
      return { data: { publicBookingEnabled: false, valid }, error: null };
    }
    return { data: functionName === "email_cleanup_personal_data" ? 0 : true, error: null };
  });
}

const env = {
  NEXT_PUBLIC_SITE_URL: "https://example.com",
  NODE_ENV: "test",
  RESEND_API_KEY: "resend-key",
  RESEND_FROM_EMAIL: "Magic <mail@example.com>",
  SUPABASE_SECRET_KEY: "secret",
  SUPABASE_URL: "https://db.example.com",
} satisfies NodeJS.ProcessEnv;

describe("email outbox worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims, validates, sends, completes, and prunes a batch", async () => {
    const notification = row();
    installRpc(notification);
    const fetchEmail = vi.fn<typeof fetch>(async () => (
      new Response(JSON.stringify({ id: "email-1" }), { status: 200 })
    ));

    await expect(processEmailOutbox({ env, fetchEmail })).resolves.toEqual({
      cancelled: 0, claimed: 1, failed: 0, sent: 1,
    });
    expect(fetchEmail.mock.calls[0][1]?.headers).toMatchObject({
      "Idempotency-Key": `email-notification/${notification.id}`,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("email_complete_notification", expect.objectContaining({
      p_notification_id: notification.id,
      p_provider_message_id: "email-1",
    }));
    expect(mocks.rpc).toHaveBeenCalledWith("email_cleanup_personal_data", {});
    expect(mocks.rpc).toHaveBeenCalledWith("email_claim_notifications", expect.objectContaining({
      p_batch_size: 25,
      p_lease_seconds: 900,
    }));
  });

  it("runs retention cleanup before rejecting missing provider configuration", async () => {
    mocks.rpc.mockResolvedValue({ data: 0, error: null });
    await expect(processEmailOutbox({ env: { NODE_ENV: "test" } })).rejects.toThrow("email_worker_not_configured");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("email_cleanup_personal_data", {});
  });

  it.each([[429, true], [503, true], [422, false]])(
    "records HTTP %i with retryable=%s",
    async (status, retryable) => {
      const notification = row();
      installRpc(notification);
      await processEmailOutbox({
        env,
        fetchEmail: vi.fn<typeof fetch>(async () => (
          new Response(JSON.stringify({ message: "failed" }), { status })
        )),
      });
      expect(mocks.rpc).toHaveBeenCalledWith("email_fail_notification", expect.objectContaining({
        p_notification_id: notification.id,
        p_retryable: retryable,
      }));
    },
  );

  it("does not send a notification cancelled by current-state validation", async () => {
    installRpc(row({ event_type: "booking_reminder_24h" }), false);
    const fetchEmail = vi.fn<typeof fetch>(async () => new Response());
    await expect(processEmailOutbox({ env, fetchEmail })).resolves.toMatchObject({ cancelled: 1, sent: 0 });
    expect(fetchEmail).not.toHaveBeenCalled();
  });

  it("revalidates the appointment immediately before provider delivery", async () => {
    const notification = row({ event_type: "booking_rescheduled" });
    let prepareCount = 0;
    mocks.rpc.mockImplementation(async (functionName: string) => {
      if (functionName === "email_claim_notifications") {
        return { data: [notification], error: null };
      }
      if (functionName === "email_prepare_claimed_notification") {
        prepareCount += 1;
        return {
          data: { publicBookingEnabled: false, valid: prepareCount === 1 },
          error: null,
        };
      }
      return {
        data: functionName === "email_cleanup_personal_data" ? 0 : true,
        error: null,
      };
    });
    const fetchEmail = vi.fn<typeof fetch>(async () => new Response());

    await expect(processEmailOutbox({ env, fetchEmail })).resolves.toMatchObject({
      cancelled: 1,
      failed: 0,
      sent: 0,
    });
    expect(prepareCount).toBe(2);
    expect(fetchEmail).not.toHaveBeenCalled();
  });

  it("terminally fails care delivery when a signed unsubscribe cannot be built", async () => {
    installRpc(row({ event_type: "booking_care", template_key: "booking_care" }));
    const fetchEmail = vi.fn<typeof fetch>(async () => new Response());
    await expect(processEmailOutbox({
      env: { ...env, SUPABASE_SECRET_KEY: "" },
      fetchEmail,
    })).resolves.toMatchObject({ failed: 1, sent: 0 });
    expect(fetchEmail).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("email_fail_notification", expect.objectContaining({
      p_error_summary: "care_unsubscribe_not_configured",
      p_retryable: false,
    }));
  });

  it("does not report success when the lease was lost after provider acceptance", async () => {
    const notification = row();
    installRpc(notification);
    const baseImplementation = mocks.rpc.getMockImplementation()!;
    mocks.rpc.mockImplementation(async (functionName: string, parameters: Record<string, unknown>) => {
      if (functionName === "email_complete_notification") return { data: false, error: null };
      return baseImplementation(functionName, parameters);
    });
    const fetchEmail = vi.fn<typeof fetch>(async () => (
      new Response(JSON.stringify({ id: "accepted-email" }), { status: 200 })
    ));
    await expect(processEmailOutbox({ env, fetchEmail })).resolves.toMatchObject({ failed: 1, sent: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith("email_fail_notification", expect.objectContaining({
      p_error_summary: "email_completion_lease_lost",
      p_retryable: true,
    }));
  });

  it("attaches a generated PDF for buyer delivery", async () => {
    installRpc(row({
      aggregate_id: "MMN-GC-1",
      aggregate_type: "certificate",
      event_type: "gift_buyer",
      payload: { gift_order_id: "33333333-3333-4333-8333-333333333333" },
    }));
    mocks.prepareGift.mockResolvedValue({
      certificateCode: "MMN-GC-1",
      order: { purchaserName: "Buyer", recipientName: "Recipient" },
      pdf: { bytes: new Uint8Array([1, 2, 3]), filename: "MMN-GC-1.pdf" },
    });
    const fetchEmail = vi.fn<typeof fetch>(async () => (
      new Response(JSON.stringify({ id: "gift-email" }), { status: 200 })
    ));
    await processEmailOutbox({ env, fetchEmail });
    expect(JSON.parse(String(fetchEmail.mock.calls[0][1]?.body)).attachments).toEqual([
      { content: "AQID", filename: "MMN-GC-1.pdf" },
    ]);
  });

  it("keeps owner gift alerts independent from PDF generation", async () => {
    installRpc(row({
      aggregate_id: "MMN-GC-1",
      aggregate_type: "certificate",
      event_type: "owner_gift_purchase",
      payload: { gift_order_id: "33333333-3333-4333-8333-333333333333" },
    }));
    mocks.loadOrder.mockResolvedValue({ certificateCode: "MMN-GC-1" });
    const fetchEmail = vi.fn<typeof fetch>(async () => (
      new Response(JSON.stringify({ id: "owner-email" }), { status: 200 })
    ));
    await processEmailOutbox({ env, fetchEmail });
    expect(mocks.prepareGift).not.toHaveBeenCalled();
    expect(mocks.loadOrder).toHaveBeenCalled();
    expect(JSON.parse(String(fetchEmail.mock.calls[0][1]?.body)).attachments).toBeUndefined();
  });
});
