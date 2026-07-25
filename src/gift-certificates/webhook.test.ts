// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import type { GiftCertificateOrderStore } from "./order-store";
import {
  finalizePersistedGiftCertificatePayment,
  handleGiftCertificateWebhook,
} from "./webhook";

const orderId = "01234567-89ab-4def-8123-456789abcdef";
const certificateCode = "MMN-GC-20260705-ABC123XY";
const rawBody = JSON.stringify({
  id: "evt_123",
  type: "payment_intent.succeeded",
  data: { object: { id: "pi_123", object: "payment_intent" } },
});
const metadata = {
  gift_order_id: orderId,
  gift_certificate_code: certificateCode,
  gift_total_eur_cents: "4500",
  gift_locale: "en",
  gift_order_schema_version: "v2",
};
const persistedOrder = {
  locale: "en" as const,
  purchaseMode: "self" as const,
  purchaserName: "Anna",
  purchaserEmail: "anna@example.com",
  recipientName: "Anna",
  deliveryMode: "buyer_only" as const,
  serviceItems: [{ serviceSlug: "classic-massage" as const, sessions: 1 }],
  expiresOn: "2027-01-05",
  totalEurCents: 4500,
  certificateCode,
  id: orderId,
  status: "pending" as const,
};

function createOrderStore(overrides: Partial<GiftCertificateOrderStore> = {}) {
  return {
    attachPaymentIntent: vi.fn(),
    createPendingOrder: vi.fn(),
    loadOrder: vi.fn().mockResolvedValue(persistedOrder),
    markPaidAndEnqueue: vi.fn().mockResolvedValue(true),
    reconcilePaidAndEnqueue: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as GiftCertificateOrderStore;
}

function createStripe(overrides: Record<string, unknown> = {}) {
  return {
    webhooks: { constructEvent: vi.fn(() => JSON.parse(rawBody)) },
    paymentIntents: {
      retrieve: vi.fn().mockResolvedValue({
        amount: 4500,
        currency: "eur",
        id: "pi_123",
        livemode: false,
        metadata,
        status: "succeeded",
        ...overrides,
      }),
    },
  };
}

describe("gift certificate Stripe webhook", () => {
  it("validates the Stripe signature before reading or mutating orders", async () => {
    const constructEvent = vi.fn(() => {
      throw new Error("Invalid signature");
    });
    const orderStore = createOrderStore();

    await expect(
      handleGiftCertificateWebhook({
        orderStore,
        rawBody,
        signature: "bad",
        webhookSecret: "whsec_test",
        stripe: {
          webhooks: { constructEvent },
          paymentIntents: { retrieve: vi.fn() },
        },
      }),
    ).rejects.toThrow("Invalid signature");

    expect(constructEvent).toHaveBeenCalledWith(rawBody, "bad", "whsec_test");
    expect(orderStore.loadOrder).not.toHaveBeenCalled();
  });

  it("loads the protected order and atomically queues independent deliveries", async () => {
    const orderStore = createOrderStore();

    const result = await handleGiftCertificateWebhook({
      expectedLivemode: false,
      orderStore,
      rawBody,
      signature: "valid",
      stripe: createStripe(),
      webhookSecret: "whsec_test",
    });

    expect(result).toEqual({ received: true, fulfilled: true });
    expect(orderStore.loadOrder).toHaveBeenCalledWith(orderId);
    expect(orderStore.markPaidAndEnqueue).toHaveBeenCalledWith({
      certificateCode,
      locale: "en",
      orderId,
      paymentIntentId: "pi_123",
      totalEurCents: 4500,
    });
  });

  it("reports duplicate webhook delivery without creating another fulfillment", async () => {
    const orderStore = createOrderStore({
      markPaidAndEnqueue: vi.fn().mockResolvedValue(false),
    });

    await expect(
      handleGiftCertificateWebhook({
        orderStore,
        rawBody,
        signature: "valid",
        stripe: createStripe(),
        webhookSecret: "whsec_test",
      }),
    ).resolves.toEqual({ received: true, fulfilled: false });
  });

  it("rejects missing or obsolete order-reference metadata", async () => {
    const orderStore = createOrderStore();

    await expect(
      handleGiftCertificateWebhook({
        orderStore,
        rawBody,
        signature: "valid",
        stripe: createStripe({ metadata: { gift_order_schema_version: "v1" } }),
        webhookSecret: "whsec_test",
      }),
    ).rejects.toThrow("Missing gift certificate order reference.");

    expect(orderStore.loadOrder).not.toHaveBeenCalled();
  });

  it("rejects amount and currency mismatches before loading the order", async () => {
    const orderStore = createOrderStore();

    await expect(
      handleGiftCertificateWebhook({
        orderStore,
        rawBody,
        signature: "valid",
        stripe: createStripe({ amount: 9999 }),
        webhookSecret: "whsec_test",
      }),
    ).rejects.toThrow("Payment amount does not match gift certificate order.");

    await expect(
      handleGiftCertificateWebhook({
        orderStore,
        rawBody,
        signature: "valid",
        stripe: createStripe({ currency: "usd" }),
        webhookSecret: "whsec_test",
      }),
    ).rejects.toThrow("Payment currency does not match gift certificate order.");
  });

  it("rejects a protected order that differs from the signed payment reference", async () => {
    const orderStore = createOrderStore({
      loadOrder: vi.fn().mockResolvedValue({ ...persistedOrder, totalEurCents: 5000 }),
    });

    await expect(
      handleGiftCertificateWebhook({
        orderStore,
        rawBody,
        signature: "valid",
        stripe: createStripe(),
        webhookSecret: "whsec_test",
      }),
    ).rejects.toThrow("Persisted gift certificate order does not match payment metadata.");

    expect(orderStore.markPaidAndEnqueue).not.toHaveBeenCalled();
  });

  it("rejects live/test mode mismatches", async () => {
    await expect(
      handleGiftCertificateWebhook({
        expectedLivemode: true,
        orderStore: createOrderStore(),
        rawBody,
        signature: "valid",
        stripe: createStripe(),
        webhookSecret: "whsec_test",
      }),
    ).rejects.toThrow("Stripe livemode does not match environment.");
  });

  it("uses the audited idempotent path for an admin reconciliation", async () => {
    const orderStore = createOrderStore();

    await expect(finalizePersistedGiftCertificatePayment({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      expectedLivemode: false,
      orderStore,
      paymentIntent: {
        amount: 4500,
        currency: "eur",
        id: "pi_123",
        livemode: false,
        metadata,
        status: "succeeded",
      },
    })).resolves.toBe(true);

    expect(orderStore.reconcilePaidAndEnqueue).toHaveBeenCalledWith({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      certificateCode,
      locale: "en",
      orderId,
      paymentIntentId: "pi_123",
      totalEurCents: 4500,
    });
    expect(orderStore.markPaidAndEnqueue).not.toHaveBeenCalled();
  });

  it("does not reconcile a PaymentIntent that Stripe has not marked succeeded", async () => {
    const orderStore = createOrderStore();

    await expect(finalizePersistedGiftCertificatePayment({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      orderStore,
      paymentIntent: {
        amount: 4500,
        currency: "eur",
        id: "pi_123",
        metadata,
        status: "requires_payment_method",
      },
    })).rejects.toThrow("Gift certificate payment is not successful.");

    expect(orderStore.loadOrder).not.toHaveBeenCalled();
    expect(orderStore.reconcilePaidAndEnqueue).not.toHaveBeenCalled();
  });

  it("fails closed when a payment provider result omits its status", async () => {
    const orderStore = createOrderStore();

    await expect(finalizePersistedGiftCertificatePayment({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      orderStore,
      paymentIntent: {
        amount: 4500,
        currency: "eur",
        id: "pi_123",
        metadata,
        status: undefined as never,
      },
    })).rejects.toThrow("Gift certificate payment is not successful.");

    expect(orderStore.loadOrder).not.toHaveBeenCalled();
  });
});
