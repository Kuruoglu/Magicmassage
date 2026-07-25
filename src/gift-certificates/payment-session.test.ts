// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { giftCertificateSalesConfig } from "@/content/gift-certificates";
import { createGiftCertificatePaymentSession } from "./payment-session";
import type { GiftCertificateOrderStore } from "./order-store";

const orderPayload = {
  locale: "en",
  purchaseMode: "self",
  purchaserName: "Anna Buyer",
  purchaserEmail: "anna@example.com",
  recipientName: "Anna Buyer",
  recipientMessage: "Private gift note.",
  deliveryMode: "buyer_only",
  serviceItems: [{ serviceSlug: "classic-massage", sessions: 2 }],
  amountVoucherEur: 100,
  clientTotalEurCents: 1,
};

function createOrderStore() {
  const attachPaymentIntent = vi.fn().mockResolvedValue(undefined);
  const createPendingOrder = vi.fn(async ({ certificateCode, order, orderId }) => ({
    ...order,
    certificateCode,
    id: orderId,
    status: "pending" as const,
  }));

  return {
    attachPaymentIntent,
    createPendingOrder,
    loadOrder: vi.fn(),
    markPaidAndEnqueue: vi.fn(),
    reconcilePaidAndEnqueue: vi.fn(),
  } satisfies GiftCertificateOrderStore;
}

describe("gift certificate payment session", () => {
  it("creates a Stripe PaymentIntent using server-side configured prices", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "pi_test_123",
      client_secret: "pi_test_123_secret_456",
    });

    const orderStore = createOrderStore();
    const result = await createGiftCertificatePaymentSession({
      createOrderId: () => "01234567-89ab-4def-8123-456789abcdef",
      payload: orderPayload,
      now: new Date("2026-07-05T00:00:00.000Z"),
      env: {
        STRIPE_SECRET_KEY: "sk_test_123",
        NEXT_PUBLIC_SITE_URL: "https://example.com",
      },
      stripe: {
        paymentIntents: { create },
      },
      orderStore,
      idempotencyKey: "gift-intent-key",
    });

    const expectedAmount =
      (giftCertificateSalesConfig.sellableServices["classic-massage"].priceEur * 2 +
        100) *
      100;

    expect(result.mode).toBe("stripe");
    expect(result.amountEurCents).toBe(expectedAmount);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: expectedAmount,
        currency: "eur",
        receipt_email: "anna@example.com",
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
      }),
      { idempotencyKey: "gift-intent-key" },
    );
    expect(orderStore.createPendingOrder).toHaveBeenCalledBefore(create);
    expect(orderStore.attachPaymentIntent).toHaveBeenCalledWith(
      "01234567-89ab-4def-8123-456789abcdef",
      "pi_test_123",
    );
    expect(create.mock.calls[0][0].metadata).toEqual({
      gift_order_id: "01234567-89ab-4def-8123-456789abcdef",
      gift_certificate_code: expect.stringMatching(/^MMN-GC-20260705-[A-Z0-9]{8}$/),
      gift_total_eur_cents: String(expectedAmount),
      gift_locale: "en",
      gift_order_schema_version: "v2",
    });
    expect(create.mock.calls[0][0].metadata.gift_certificate_code).toMatch(
      /^MMN-GC-20260705-[A-Z0-9]{8}$/,
    );
    expect(JSON.stringify(create.mock.calls[0][0].metadata)).not.toContain("recipientMessage");
  });

  it("returns demo mode when Stripe is not configured", async () => {
    const result = await createGiftCertificatePaymentSession({
      payload: orderPayload,
      now: new Date("2026-07-05T00:00:00.000Z"),
      env: {},
      stripe: undefined,
    });

    expect(result.mode).toBe("demo");
    expect(result.clientSecret).toBeNull();
  });

  it("blocks Stripe payment creation when durable order persistence is not configured", async () => {
    await expect(
      createGiftCertificatePaymentSession({
        payload: orderPayload,
        now: new Date("2026-07-05T00:00:00.000Z"),
        env: {
          STRIPE_SECRET_KEY: "sk_test_123",
          NEXT_PUBLIC_SITE_URL: "https://example.com",
        },
        stripe: {
          paymentIntents: { create: vi.fn() },
        },
      }),
    ).rejects.toThrow("Gift certificate order persistence is not configured");
  });

  it("blocks live checkout when final prices or the live-payment flag are missing", async () => {
    await expect(
      createGiftCertificatePaymentSession({
        payload: orderPayload,
        now: new Date("2026-07-05T00:00:00.000Z"),
        env: {
          STRIPE_SECRET_KEY: "sk_live_123",
          NEXT_PUBLIC_SITE_URL: "https://example.com",
        },
        stripe: {
          paymentIntents: { create: vi.fn() },
        },
      }),
    ).rejects.toThrow("Live gift certificate payments are disabled");
  });
});
