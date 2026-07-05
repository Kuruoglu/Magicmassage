// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { giftCertificateSalesConfig } from "@/content/gift-certificates";
import { createGiftCertificatePaymentSession } from "./payment-session";

const orderPayload = {
  locale: "en",
  purchaseMode: "self",
  purchaserName: "Anna Buyer",
  purchaserEmail: "anna@example.com",
  recipientName: "Anna Buyer",
  deliveryMode: "buyer_only",
  serviceItems: [{ serviceSlug: "classic-massage", sessions: 2 }],
  amountVoucherEur: 100,
  clientTotalEurCents: 1,
};

describe("gift certificate payment session", () => {
  it("creates a Stripe PaymentIntent using server-side configured prices", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "pi_test_123",
      client_secret: "pi_test_123_secret_456",
    });

    const result = await createGiftCertificatePaymentSession({
      payload: orderPayload,
      now: new Date("2026-07-05T00:00:00.000Z"),
      env: {
        STRIPE_SECRET_KEY: "sk_test_123",
        NEXT_PUBLIC_SITE_URL: "https://example.com",
        RESEND_API_KEY: "re_test",
        RESEND_FROM_EMAIL: "Magic Massage Natali <gifts@example.com>",
      },
      stripe: {
        paymentIntents: { create },
      },
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
    );
    expect(create.mock.calls[0][0].metadata.gift_order_001).toEqual(expect.any(String));
    expect(create.mock.calls[0][0].metadata.gift_certificate_code).toMatch(
      /^MMN-GC-20260705-[A-Z0-9]{8}$/,
    );
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

  it("blocks Stripe payment creation when email delivery is not configured", async () => {
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
    ).rejects.toThrow("Gift certificate email delivery is not configured");
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
