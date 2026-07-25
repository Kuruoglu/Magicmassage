// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  createOrderStore: vi.fn(),
  loadOrder: vi.fn(),
  retrieve: vi.fn(),
}));

vi.mock("@/gift-certificates/stripe-client", () => ({
  getStripeClient: vi.fn(() => ({
    paymentIntents: {
      retrieve: mocks.retrieve,
    },
  })),
}));

vi.mock("@/gift-certificates/order-store", () => ({
  createGiftCertificateOrderStore: mocks.createOrderStore,
}));

const orderId = "01234567-89ab-4def-8123-456789abcdef";
const certificateCode = "MMN-GC-20260705-ABC123XY";
const metadata = {
  gift_order_id: orderId,
  gift_certificate_code: certificateCode,
  gift_total_eur_cents: "4500",
  gift_locale: "en",
  gift_order_schema_version: "v2",
};
const persistedOrder = {
  certificateCode,
  id: orderId,
  locale: "en",
  paymentIntentId: "pi_123",
  status: "paid",
  totalEurCents: 4500,
};

function statusRequest(query = "payment_intent=pi_123&payment_intent_client_secret=pi_123_secret_456") {
  return new Request(`https://example.com/api/gift-certificates/status?${query}`);
}

describe("gift certificate payment status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.retrieve.mockResolvedValue({
      client_secret: "pi_123_secret_456",
      id: "pi_123",
      metadata,
      status: "succeeded",
    });
    mocks.loadOrder.mockResolvedValue(persistedOrder);
    mocks.createOrderStore.mockReturnValue({ loadOrder: mocks.loadOrder });
  });

  it("returns fulfilled only for a persisted fulfilled order", async () => {
    mocks.loadOrder.mockResolvedValue({ ...persistedOrder, status: "fulfilled" });

    const response = await GET(statusRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      paymentIntentId: "pi_123",
      status: "succeeded",
      fulfilled: true,
    });
  });

  it.each(["pending", "paid", "fulfillment_failed"])(
    "keeps fulfilled false for a persisted %s order",
    async (status) => {
      mocks.loadOrder.mockResolvedValue({ ...persistedOrder, status });

      const response = await GET(statusRequest());

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        paymentIntentId: "pi_123",
        status: "succeeded",
        fulfilled: false,
      });
    },
  );

  it.each([
    ["missing", {}],
    ["invalid", { ...metadata, gift_certificate_code: "invalid" }],
  ])("fails closed for %s Stripe metadata", async (_label, paymentMetadata) => {
    mocks.retrieve.mockResolvedValue({
      client_secret: "pi_123_secret_456",
      id: "pi_123",
      metadata: paymentMetadata,
      status: "succeeded",
    });

    const response = await GET(statusRequest());

    expect(response.status).toBe(409);
    expect(mocks.createOrderStore).not.toHaveBeenCalled();
    expect(mocks.loadOrder).not.toHaveBeenCalled();
  });

  it("fails closed when gift order persistence is unavailable", async () => {
    mocks.createOrderStore.mockReturnValue(undefined);

    const response = await GET(statusRequest());

    expect(response.status).toBe(503);
    expect(mocks.loadOrder).not.toHaveBeenCalled();
  });

  it.each([
    ["Stripe response PaymentIntent", {}, { id: "pi_other" }],
    ["order ID", { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, {}],
    ["persisted PaymentIntent", { paymentIntentId: "pi_other" }, {}],
    ["certificate code", { certificateCode: "MMN-GC-20260705-ZZZZZZZZ" }, {}],
    ["total", { totalEurCents: 5000 }, {}],
    ["locale", { locale: "bg" }, {}],
  ])("fails closed when the %s does not match", async (_label, orderOverride, paymentOverride) => {
    mocks.loadOrder.mockResolvedValue({ ...persistedOrder, ...orderOverride });
    mocks.retrieve.mockResolvedValue({
      client_secret: "pi_123_secret_456",
      id: "pi_123",
      metadata,
      status: "succeeded",
      ...paymentOverride,
    });

    const response = await GET(statusRequest());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Payment status is not available.",
    });
  });

  it("requires the PaymentIntent client secret", async () => {
    const response = await GET(statusRequest("payment_intent=pi_123"));

    expect(response.status).toBe(400);
  });
});
