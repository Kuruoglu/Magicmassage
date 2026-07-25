// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createGiftCertificateOrderStore } from "./order-store";

const persistedRow = {
  id: "01234567-89ab-4def-8123-456789abcdef",
  certificate_code: "MMN-GC-20260705-ABC123XY",
  payment_intent_id: null,
  status: "pending",
  amount_eur_cents: 4500,
  expires_on: "2027-01-05",
  order_payload: {
    locale: "en",
    purchaseMode: "self",
    purchaserName: "Anna",
    purchaserEmail: "anna@example.com",
    recipientName: "Anna",
    deliveryMode: "buyer_only",
    serviceItems: [{ serviceSlug: "classic-massage", sessions: 1 }],
    expiresOn: "2027-01-05",
    totalEurCents: 4500,
  },
};

describe("gift certificate order store", () => {
  it("persists the full validated order before attaching a PaymentIntent", async () => {
    const rpc = vi.fn(async (functionName: string, parameters: Record<string, unknown>) => {
      void parameters;
      return {
        data: functionName === "gift_create_pending_order" ? persistedRow : null,
        error: null,
      };
    });
    const store = createGiftCertificateOrderStore({ rpc });

    expect(store).toBeDefined();
    const order = await store!.createPendingOrder({
      certificateCode: persistedRow.certificate_code,
      idempotencyKey: "browser-submit-1",
      orderId: persistedRow.id,
      order: {
        ...persistedRow.order_payload,
        locale: "en",
        purchaseMode: "self",
        deliveryMode: "buyer_only",
        serviceItems: [{ serviceSlug: "classic-massage", sessions: 1 }],
      },
    });
    await store!.attachPaymentIntent(order.id, "pi_test_123");

    expect(order.purchaserEmail).toBe("anna@example.com");
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "gift_create_pending_order",
      "gift_attach_payment_intent",
    ]);
    expect(rpc.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        p_order_payload: expect.objectContaining({ purchaserEmail: "anna@example.com" }),
        p_payload_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("uses one atomic RPC for paid state, certificate creation, and all outbox rows", async () => {
    const rpc = vi.fn(async () => ({ data: { newly_paid: false }, error: null }));
    const store = createGiftCertificateOrderStore({ rpc });

    await expect(
      store!.markPaidAndEnqueue({
        certificateCode: persistedRow.certificate_code,
        locale: "en",
        orderId: persistedRow.id,
        paymentIntentId: "pi_test_123",
        totalEurCents: 4500,
      }),
    ).resolves.toBe(false);

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("gift_mark_paid_and_enqueue", {
      p_certificate_code: persistedRow.certificate_code,
      p_locale: "en",
      p_order_id: persistedRow.id,
      p_payment_intent_id: "pi_test_123",
      p_total_eur_cents: 4500,
    });
  });

  it("uses the audited reconciliation RPC for an authorized admin recovery", async () => {
    const rpc = vi.fn(async () => ({ data: { newly_paid: false }, error: null }));
    const store = createGiftCertificateOrderStore({ rpc });

    await expect(
      store!.reconcilePaidAndEnqueue({
        actorUserId: "11111111-1111-4111-8111-111111111111",
        certificateCode: persistedRow.certificate_code,
        locale: "en",
        orderId: persistedRow.id,
        paymentIntentId: "pi_test_123",
        totalEurCents: 4500,
      }),
    ).resolves.toBe(false);

    expect(rpc).toHaveBeenCalledWith("admin_reconcile_gift_certificate_order", {
      p_actor_user_id: "11111111-1111-4111-8111-111111111111",
      p_certificate_code: persistedRow.certificate_code,
      p_locale: "en",
      p_order_id: persistedRow.id,
      p_payment_intent_id: "pi_test_123",
      p_total_eur_cents: 4500,
    });
  });

  it("fails closed on malformed persisted PII instead of sending from unchecked data", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        ...persistedRow,
        order_payload: { ...persistedRow.order_payload, purchaserEmail: "not-an-email" },
      },
      error: null,
    }));
    const store = createGiftCertificateOrderStore({ rpc });

    await expect(store!.loadOrder(persistedRow.id)).rejects.toThrow(
      "Gift certificate order storage returned invalid data.",
    );
  });
});
