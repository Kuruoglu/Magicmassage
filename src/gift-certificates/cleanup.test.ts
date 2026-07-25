import { describe, expect, it, vi } from "vitest";

import { cleanupAbandonedGiftCertificateOrders } from "./cleanup";

const order = {
  amount_eur_cents: 4500,
  certificate_code: "MMN-GC-20260725-ABCDEFGH",
  locale: "en",
  order_id: "11111111-1111-4111-8111-111111111111",
  payment_intent_id: "pi_abandoned",
};

const metadata = {
  gift_certificate_code: order.certificate_code,
  gift_locale: order.locale,
  gift_order_id: order.order_id,
  gift_order_schema_version: "v2",
  gift_total_eur_cents: String(order.amount_eur_cents),
};

function createClient(claimed: unknown[]) {
  return {
    rpc: vi.fn(async (functionName: string) => {
      if (functionName === "gift_claim_abandoned_pending_orders") {
        return { data: claimed, error: null };
      }
      if (functionName === "gift_redact_abandoned_pending_order") {
        return { data: true, error: null };
      }
      if (functionName === "gift_mark_paid_and_enqueue") {
        return { data: { newly_paid: true }, error: null };
      }
      return { data: null, error: { message: "unexpected RPC" } };
    }),
  };
}

describe("abandoned gift certificate cleanup", () => {
  it("redacts stale rows that never received a PaymentIntent", async () => {
    const client = createClient([{ ...order, payment_intent_id: null }]);

    const result = await cleanupAbandonedGiftCertificateOrders({
      client,
      stripe: undefined,
    });

    expect(result).toEqual({
      cancelled: 0,
      claimed: 1,
      failed: 0,
      fulfilled: 0,
      redacted: 1,
    });
    expect(client.rpc).toHaveBeenLastCalledWith(
      "gift_redact_abandoned_pending_order",
      {
        p_order_id: order.order_id,
        p_payment_intent_id: null,
      },
    );
  });

  it("cancels a verified abandoned PaymentIntent before redacting PII", async () => {
    const client = createClient([order]);
    const stripe = {
      paymentIntents: {
        cancel: vi.fn(async () => ({ status: "canceled" as const })),
        retrieve: vi.fn(async () => ({
          amount: order.amount_eur_cents,
          currency: "eur",
          id: order.payment_intent_id,
          livemode: false,
          metadata,
          status: "requires_payment_method" as const,
        })),
      },
    };

    const result = await cleanupAbandonedGiftCertificateOrders({ client, stripe });

    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith(
      order.payment_intent_id,
      { cancellation_reason: "abandoned" },
    );
    expect(result.cancelled).toBe(1);
    expect(result.redacted).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("fulfills a succeeded PaymentIntent instead of redacting it", async () => {
    const client = createClient([order]);
    const stripe = {
      paymentIntents: {
        cancel: vi.fn(),
        retrieve: vi.fn(async () => ({
          amount: order.amount_eur_cents,
          currency: "eur",
          id: order.payment_intent_id,
          livemode: false,
          metadata,
          status: "succeeded" as const,
        })),
      },
    };

    const result = await cleanupAbandonedGiftCertificateOrders({ client, stripe });

    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledWith(
      "gift_mark_paid_and_enqueue",
      expect.objectContaining({
        p_order_id: order.order_id,
        p_payment_intent_id: order.payment_intent_id,
      }),
    );
    expect(result.fulfilled).toBe(1);
    expect(result.redacted).toBe(0);
  });

  it.each([
    { currency: "usd", livemode: false, mismatch: "currency" },
    { currency: "eur", livemode: true, mismatch: "livemode" },
  ])("does not fulfill a succeeded PaymentIntent with a $mismatch mismatch", async ({
    currency,
    livemode,
  }) => {
    const client = createClient([order]);
    const stripe = {
      paymentIntents: {
        cancel: vi.fn(),
        retrieve: vi.fn(async () => ({
          amount: order.amount_eur_cents,
          currency,
          id: order.payment_intent_id,
          livemode,
          metadata,
          status: "succeeded" as const,
        })),
      },
    };

    const result = await cleanupAbandonedGiftCertificateOrders({
      client,
      expectedLivemode: false,
      stripe,
    });

    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
    expect(
      client.rpc.mock.calls.some(([functionName]) =>
        functionName === "gift_mark_paid_and_enqueue"),
    ).toBe(false);
    expect(result.failed).toBe(1);
    expect(result.fulfilled).toBe(0);
  });

  it("does not cancel or redact a PaymentIntent whose signed metadata does not match", async () => {
    const client = createClient([order]);
    const stripe = {
      paymentIntents: {
        cancel: vi.fn(),
        retrieve: vi.fn(async () => ({
          amount: order.amount_eur_cents,
          currency: "eur",
          id: order.payment_intent_id,
          livemode: false,
          metadata: { ...metadata, gift_order_id: "22222222-2222-4222-8222-222222222222" },
          status: "requires_payment_method" as const,
        })),
      },
    };

    const result = await cleanupAbandonedGiftCertificateOrders({ client, stripe });

    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
    expect(
      client.rpc.mock.calls.some(([functionName]) =>
        functionName === "gift_redact_abandoned_pending_order"),
    ).toBe(false);
    expect(result.failed).toBe(1);
  });
});
