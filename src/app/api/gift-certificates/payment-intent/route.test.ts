// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createGiftCertificatePaymentSession } from "@/gift-certificates/payment-session";

import { clearGiftCertificatePaymentIntentGuardsForTests, POST } from "./route";

const giftFeatureMock = vi.hoisted(() => ({ enabled: true }));

vi.mock("@/content/public-content-runtime", () => ({
  getRuntimeGiftCertificatesEnabled: vi.fn(async () => giftFeatureMock.enabled),
}));

vi.mock("@/gift-certificates/payment-session", () => ({
  createGiftCertificatePaymentSession: vi.fn(async () => ({
    mode: "demo",
    clientSecret: null,
    paymentIntentId: null,
    amountEurCents: 10000,
    certificateCode: "MMN-GC-20260705-ABC123XY",
  })),
}));

describe("gift certificate payment-intent API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    giftFeatureMock.enabled = true;
    clearGiftCertificatePaymentIntentGuardsForTests();
  });

  it("does not create a payment when gift certificates are disabled", async () => {
    giftFeatureMock.enabled = false;

    const response = await POST(
      new Request("https://example.com/api/gift-certificates/payment-intent", {
        body: JSON.stringify({ locale: "en" }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(404);
    expect(createGiftCertificatePaymentSession).not.toHaveBeenCalled();
  });

  it("returns the created payment session without exposing Stripe secrets", async () => {
    const response = await POST(
      new Request("https://example.com/api/gift-certificates/payment-intent", {
        method: "POST",
        body: JSON.stringify({ locale: "en" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      mode: "demo",
      clientSecret: null,
      paymentIntentId: null,
      amountEurCents: 10000,
      certificateCode: "MMN-GC-20260705-ABC123XY",
    });
    expect(createGiftCertificatePaymentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: expect.any(String),
        payload: { locale: "en" },
      }),
    );
  });

  it("rejects browser requests from a different origin", async () => {
    const response = await POST(
      new Request("https://example.com/api/gift-certificates/payment-intent", {
        body: JSON.stringify({ locale: "en" }),
        headers: {
          host: "example.com",
          origin: "https://evil.example",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Unable to create gift certificate payment." });
    expect(createGiftCertificatePaymentSession).not.toHaveBeenCalled();
  });

  it("rejects honeypot submissions before creating a PaymentIntent", async () => {
    const response = await POST(
      new Request("https://example.com/api/gift-certificates/payment-intent", {
        body: JSON.stringify({ locale: "en", website: "https://spam.example" }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(createGiftCertificatePaymentSession).not.toHaveBeenCalled();
  });

  it("reuses the cached session for repeated idempotency keys", async () => {
    const requestInit = {
      body: JSON.stringify({ locale: "en" }),
      headers: {
        "Idempotency-Key": "same-browser-submit",
      },
      method: "POST",
    };

    const first = await POST(new Request("https://example.com/api/gift-certificates/payment-intent", requestInit));
    const second = await POST(new Request("https://example.com/api/gift-certificates/payment-intent", requestInit));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(createGiftCertificatePaymentSession).toHaveBeenCalledTimes(1);
  });
});
