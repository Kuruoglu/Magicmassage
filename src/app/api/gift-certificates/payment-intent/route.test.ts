// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { POST } from "./route";

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
  });
});
