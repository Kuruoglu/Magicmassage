// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("@/gift-certificates/stripe-client", () => ({
  getStripeClient: vi.fn(() => ({
    paymentIntents: {
      retrieve: vi.fn(async () => ({
        id: "pi_123",
        status: "succeeded",
        client_secret: "pi_123_secret_456",
        metadata: {
          gift_fulfilled_at: "2026-07-05T12:00:00.000Z",
        },
      })),
    },
  })),
}));

describe("gift certificate payment status route", () => {
  it("returns a sanitized payment status for success UI", async () => {
    const response = await GET(
      new Request(
        "https://example.com/api/gift-certificates/status?payment_intent=pi_123&payment_intent_client_secret=pi_123_secret_456",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      paymentIntentId: "pi_123",
      status: "succeeded",
      fulfilled: true,
    });
  });

  it("requires the PaymentIntent client secret", async () => {
    const response = await GET(
      new Request("https://example.com/api/gift-certificates/status?payment_intent=pi_123"),
    );

    expect(response.status).toBe(400);
  });
});
