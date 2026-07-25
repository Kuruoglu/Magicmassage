// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createGiftCertificatePaymentSession } from "@/gift-certificates/payment-session";

import {
  clearGiftCertificatePaymentIntentGuardsForTests,
  giftCertificatePaymentIntentCacheSizeForTests,
  POST,
} from "./route";

const routeMocks = vi.hoisted(() => ({
  giftEnabled: true,
  rateLimitResponse: null as Response | null,
}));

vi.mock("@/booking/http", () => ({
  enforcePublicBookingRateLimit: vi.fn(async () => routeMocks.rateLimitResponse),
}));

vi.mock("@/content/public-content-runtime", () => ({
  getRuntimeGiftCertificatesEnabled: vi.fn(async () => routeMocks.giftEnabled),
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

function paymentRequest(
  payload: unknown,
  headers: Record<string, string> = {},
) {
  return new Request("https://example.com/api/gift-certificates/payment-intent", {
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
      "idempotency-key": "browser-submit-0001",
      origin: "https://example.com",
      ...headers,
    },
    method: "POST",
  });
}

describe("gift certificate payment-intent API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.giftEnabled = true;
    routeMocks.rateLimitResponse = null;
    clearGiftCertificatePaymentIntentGuardsForTests();
  });

  it("does not create a payment when gift certificates are disabled", async () => {
    routeMocks.giftEnabled = false;
    const response = await POST(paymentRequest({ locale: "en" }));

    expect(response.status).toBe(404);
    expect(createGiftCertificatePaymentSession).not.toHaveBeenCalled();
  });

  it("returns the created payment session without exposing Stripe secrets", async () => {
    const response = await POST(paymentRequest({ locale: "en" }));

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
        idempotencyKey: "browser-submit-0001",
        payload: { locale: "en" },
      }),
    );
  });

  it("rejects browser requests from a different origin", async () => {
    const response = await POST(paymentRequest({ locale: "en" }, {
      host: "example.com",
      origin: "https://evil.example",
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Unable to create gift certificate payment." });
    expect(createGiftCertificatePaymentSession).not.toHaveBeenCalled();
  });

  it("rejects honeypot submissions before creating a PaymentIntent", async () => {
    const response = await POST(paymentRequest({ locale: "en", website: "https://spam.example" }));

    expect(response.status).toBe(400);
    expect(createGiftCertificatePaymentSession).not.toHaveBeenCalled();
  });

  it("reuses the cached session for repeated idempotency keys", async () => {
    const first = await POST(paymentRequest({ locale: "en" }, { "idempotency-key": "same-browser-submit" }));
    const second = await POST(paymentRequest({ locale: "en" }, { "idempotency-key": "same-browser-submit" }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(createGiftCertificatePaymentSession).toHaveBeenCalledTimes(1);
  });

  it("rejects an idempotency key reused with a different order", async () => {
    const headers = { "idempotency-key": "same-browser-submit" };
    const first = await POST(paymentRequest({ locale: "en", purchaserName: "Anna" }, headers));
    const second = await POST(paymentRequest({ locale: "en", purchaserName: "Maria" }, headers));

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(createGiftCertificatePaymentSession).toHaveBeenCalledTimes(1);
  });

  it("requires same-origin JSON with a bounded idempotency key", async () => {
    const missingOrigin = await POST(paymentRequest({ locale: "en" }, { origin: "" }));
    const missingKey = await POST(paymentRequest({ locale: "en" }, { "idempotency-key": "" }));
    const wrongContentType = await POST(paymentRequest({ locale: "en" }, { "content-type": "text/plain" }));
    const oversizedBody = await POST(paymentRequest({ locale: "en", note: "x".repeat(17_000) }));

    expect(missingOrigin.status).toBe(403);
    expect(missingKey.status).toBe(400);
    expect(wrongContentType.status).toBe(400);
    expect(oversizedBody.status).toBe(400);
    expect(createGiftCertificatePaymentSession).not.toHaveBeenCalled();
  });

  it("uses the durable public rate limiter before payment creation", async () => {
    routeMocks.rateLimitResponse = Response.json({ error: "rate_limited" }, { status: 429 });

    const response = await POST(paymentRequest({ locale: "en" }));

    expect(response.status).toBe(429);
    expect(createGiftCertificatePaymentSession).not.toHaveBeenCalled();
  });

  it("keeps the optional response cache bounded", async () => {
    for (let index = 0; index < 270; index += 1) {
      const key = `browser-submit-${String(index).padStart(4, "0")}`;
      const response = await POST(paymentRequest({ locale: "en" }, { "idempotency-key": key }));
      expect(response.status).toBe(200);
    }

    expect(giftCertificatePaymentIntentCacheSizeForTests()).toBe(256);
  });
});
