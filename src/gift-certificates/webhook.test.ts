// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearGiftCertificateWebhookLocksForTests, handleGiftCertificateWebhook } from "./webhook";

const rawBody = JSON.stringify({
  id: "evt_123",
  type: "payment_intent.succeeded",
  data: {
    object: {
      id: "pi_123",
      object: "payment_intent",
      metadata: {
        gift_certificate_code: "MMN-GC-20260705-ABC123XY",
        gift_order_1:
          '{"locale":"en","purchaseMode":"self","purchaserName":"Anna","purchaserEmail":"anna@example.com","recipientName":"Anna","deliveryMode":"buyer_only","serviceItems":[{"serviceSlug":"classic-massage","sessions":1}],"expiresOn":"2027-01-05"}',
      },
    },
  },
});

describe("gift certificate Stripe webhook", () => {
  beforeEach(() => {
    clearGiftCertificateWebhookLocksForTests();
  });

  it("validates the Stripe signature before fulfillment", async () => {
    const constructEvent = vi.fn(() => {
      throw new Error("Invalid signature");
    });

    await expect(
      handleGiftCertificateWebhook({
        rawBody,
        signature: "bad",
        webhookSecret: "whsec_test",
        stripe: {
          webhooks: { constructEvent },
          paymentIntents: { retrieve: vi.fn(), update: vi.fn() },
        },
        fulfill: vi.fn(),
      }),
    ).rejects.toThrow("Invalid signature");

    expect(constructEvent).toHaveBeenCalledWith(rawBody, "bad", "whsec_test");
  });

  it("fulfills successful payments once and stores idempotency metadata", async () => {
    const paymentIntent = {
      id: "pi_123",
      metadata: {
        gift_certificate_code: "MMN-GC-20260705-ABC123XY",
        gift_order_1:
          '{"locale":"en","purchaseMode":"self","purchaserName":"Anna","purchaserEmail":"anna@example.com","recipientName":"Anna","deliveryMode":"buyer_only","serviceItems":[{"serviceSlug":"classic-massage","sessions":1}],"expiresOn":"2027-01-05","totalEurCents":4500}',
      },
    };
    const fulfill = vi.fn().mockResolvedValue({
      buyerEmailId: "email_buyer",
      recipientEmailId: null,
    });
    const update = vi.fn().mockResolvedValue({});

    const result = await handleGiftCertificateWebhook({
      rawBody,
      signature: "valid",
      webhookSecret: "whsec_test",
      stripe: {
        webhooks: { constructEvent: vi.fn(() => JSON.parse(rawBody)) },
        paymentIntents: {
          retrieve: vi.fn().mockResolvedValue(paymentIntent),
          update,
        },
      },
      fulfill,
      now: new Date("2026-07-05T12:00:00.000Z"),
    });

    expect(result).toEqual({ received: true, fulfilled: true });
    expect(fulfill).toHaveBeenCalledWith(
      expect.objectContaining({
        certificateCode: "MMN-GC-20260705-ABC123XY",
      }),
    );
    expect(update).toHaveBeenCalledWith("pi_123", {
      metadata: expect.objectContaining({
        gift_fulfilled_at: "2026-07-05T12:00:00.000Z",
        gift_buyer_email_id: "email_buyer",
      }),
    });
  });

  it("skips already fulfilled payments", async () => {
    const fulfill = vi.fn();

    const result = await handleGiftCertificateWebhook({
      rawBody,
      signature: "valid",
      webhookSecret: "whsec_test",
      stripe: {
        webhooks: { constructEvent: vi.fn(() => JSON.parse(rawBody)) },
        paymentIntents: {
          retrieve: vi.fn().mockResolvedValue({
            id: "pi_123",
            metadata: {
              gift_fulfilled_at: "2026-07-05T12:00:00.000Z",
            },
          }),
          update: vi.fn(),
        },
      },
      fulfill,
    });

    expect(result).toEqual({ received: true, fulfilled: false });
    expect(fulfill).not.toHaveBeenCalled();
  });

  it("does not fulfill duplicate events when the fulfillment lock is already held", async () => {
    const fulfill = vi.fn();

    const result = await handleGiftCertificateWebhook({
      rawBody,
      signature: "valid",
      webhookSecret: "whsec_test",
      stripe: {
        webhooks: { constructEvent: vi.fn(() => JSON.parse(rawBody)) },
        paymentIntents: {
          retrieve: vi.fn().mockResolvedValue({
            id: "pi_123",
            metadata: {
              gift_certificate_code: "MMN-GC-20260705-ABC123XY",
              gift_order_1:
                '{"locale":"en","purchaseMode":"self","purchaserName":"Anna","purchaserEmail":"anna@example.com","recipientName":"Anna","deliveryMode":"buyer_only","serviceItems":[{"serviceSlug":"classic-massage","sessions":1}],"expiresOn":"2027-01-05","totalEurCents":4500}',
            },
          }),
          update: vi.fn(),
        },
      },
      claimFulfillment: vi.fn(async () => false),
      fulfill,
    });

    expect(result).toEqual({ received: true, fulfilled: false });
    expect(fulfill).not.toHaveBeenCalled();
  });

  it("rejects corrupted metadata without fulfillment", async () => {
    const fulfill = vi.fn();

    await expect(
      handleGiftCertificateWebhook({
        rawBody,
        signature: "valid",
        webhookSecret: "whsec_test",
        stripe: {
          webhooks: { constructEvent: vi.fn(() => JSON.parse(rawBody)) },
          paymentIntents: {
            retrieve: vi.fn().mockResolvedValue({
              id: "pi_123",
              metadata: {
                gift_certificate_code: "MMN-GC-20260705-ABC123XY",
                gift_order_1: "{broken",
              },
            }),
            update: vi.fn(),
          },
        },
        fulfill,
      }),
    ).rejects.toThrow("Missing gift certificate metadata.");

    expect(fulfill).not.toHaveBeenCalled();
  });

  it("rejects amount mismatches before fulfillment", async () => {
    const fulfill = vi.fn();

    await expect(
      handleGiftCertificateWebhook({
        rawBody,
        signature: "valid",
        webhookSecret: "whsec_test",
        stripe: {
          webhooks: { constructEvent: vi.fn(() => JSON.parse(rawBody)) },
          paymentIntents: {
            retrieve: vi.fn().mockResolvedValue({
              amount: 9999,
              currency: "eur",
              id: "pi_123",
              metadata: {
                gift_certificate_code: "MMN-GC-20260705-ABC123XY",
                gift_order_1:
                  '{"locale":"en","purchaseMode":"self","purchaserName":"Anna","purchaserEmail":"anna@example.com","recipientName":"Anna","deliveryMode":"buyer_only","serviceItems":[{"serviceSlug":"classic-massage","sessions":1}],"expiresOn":"2027-01-05","totalEurCents":4500}',
              },
            }),
            update: vi.fn(),
          },
        },
        fulfill,
      }),
    ).rejects.toThrow("Payment amount does not match gift certificate order.");

    expect(fulfill).not.toHaveBeenCalled();
  });

  it("rejects live/test mode mismatches", async () => {
    await expect(
      handleGiftCertificateWebhook({
        expectedLivemode: true,
        rawBody,
        signature: "valid",
        webhookSecret: "whsec_test",
        stripe: {
          webhooks: { constructEvent: vi.fn(() => JSON.parse(rawBody)) },
          paymentIntents: {
            retrieve: vi.fn().mockResolvedValue({
              id: "pi_123",
              livemode: false,
              metadata: {
                gift_certificate_code: "MMN-GC-20260705-ABC123XY",
                gift_order_1:
                  '{"locale":"en","purchaseMode":"self","purchaserName":"Anna","purchaserEmail":"anna@example.com","recipientName":"Anna","deliveryMode":"buyer_only","serviceItems":[{"serviceSlug":"classic-massage","sessions":1}],"expiresOn":"2027-01-05","totalEurCents":4500}',
              },
            }),
            update: vi.fn(),
          },
        },
        fulfill: vi.fn(),
      }),
    ).rejects.toThrow("Stripe livemode does not match environment.");
  });

  it("does not resend buyer email when retrying after recipient delivery failed", async () => {
    const sendBuyerEmail = vi.fn();
    const sendRecipientEmail = vi.fn().mockResolvedValue("email_recipient");
    const update = vi.fn().mockResolvedValue({});

    const result = await handleGiftCertificateWebhook({
      rawBody,
      signature: "valid",
      webhookSecret: "whsec_test",
      stripe: {
        webhooks: { constructEvent: vi.fn(() => JSON.parse(rawBody)) },
        paymentIntents: {
          retrieve: vi.fn().mockResolvedValue({
            id: "pi_123",
            metadata: {
              gift_certificate_code: "MMN-GC-20260705-ABC123XY",
              gift_buyer_email_id: "email_buyer",
              gift_order_1:
                '{"locale":"en","purchaseMode":"gift","purchaserName":"Anna","purchaserEmail":"anna@example.com","recipientName":"Maria","recipientEmail":"maria@example.com","deliveryMode":"recipient_email","serviceItems":[{"serviceSlug":"classic-massage","sessions":1}],"expiresOn":"2027-01-05","totalEurCents":4500}',
            },
          }),
          update,
        },
      },
      sendBuyerEmail,
      sendRecipientEmail,
      generatePdf: vi.fn().mockResolvedValue({
        filename: "certificate.pdf",
        bytes: new Uint8Array([1]),
        searchableText: "certificate",
      }),
      now: new Date("2026-07-05T12:00:00.000Z"),
    });

    expect(result).toEqual({ received: true, fulfilled: true });
    expect(sendBuyerEmail).not.toHaveBeenCalled();
    expect(sendRecipientEmail).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith("pi_123", {
      metadata: expect.objectContaining({
        gift_recipient_email_id: "email_recipient",
      }),
    });
  });
});
