import "server-only";

import type Stripe from "stripe";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { decodeGiftOrderReferenceMetadata } from "./metadata";
import { getStripeClient } from "./stripe-client";

type RpcResult = { data?: unknown; error: { message?: string } | null };

type GiftCleanupRpcClient = {
  rpc(
    functionName: string,
    parameters: Record<string, unknown>,
  ): PromiseLike<RpcResult>;
};

type GiftCleanupStripe = {
  paymentIntents: {
    cancel(
      id: string,
      params: Stripe.PaymentIntentCancelParams,
    ): Promise<{ status: Stripe.PaymentIntent.Status }>;
    retrieve(id: string): Promise<{
      amount: number;
      currency: string;
      id: string;
      livemode: boolean;
      metadata: Record<string, string>;
      status: Stripe.PaymentIntent.Status;
    }>;
  };
};

type AbandonedGiftOrder = {
  amountEurCents: number;
  certificateCode: string;
  locale: "bg" | "ru" | "ua" | "en";
  orderId: string;
  paymentIntentId?: string;
};

export type GiftCleanupResult = {
  cancelled: number;
  claimed: number;
  failed: number;
  fulfilled: number;
  redacted: number;
};

const cancellablePaymentIntentStatuses = new Set<Stripe.PaymentIntent.Status>([
  "processing",
  "requires_action",
  "requires_capture",
  "requires_confirmation",
  "requires_payment_method",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAbandonedGiftOrder(value: unknown): AbandonedGiftOrder | undefined {
  if (!isRecord(value)) return undefined;

  const orderId = value.order_id;
  const paymentIntentId = value.payment_intent_id;
  const certificateCode = value.certificate_code;
  const locale = value.locale;
  const amountEurCents = value.amount_eur_cents;

  if (
    typeof orderId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(orderId) ||
    (paymentIntentId !== null &&
      paymentIntentId !== undefined &&
      (typeof paymentIntentId !== "string" || !paymentIntentId.startsWith("pi_"))) ||
    typeof certificateCode !== "string" ||
    !/^MMN-GC-\d{8}-[A-Z0-9]{8}$/.test(certificateCode) ||
    !["bg", "ru", "ua", "en"].includes(String(locale)) ||
    !Number.isInteger(amountEurCents) ||
    Number(amountEurCents) <= 0
  ) {
    return undefined;
  }

  return {
    amountEurCents: Number(amountEurCents),
    certificateCode,
    locale: locale as AbandonedGiftOrder["locale"],
    orderId,
    paymentIntentId: typeof paymentIntentId === "string" ? paymentIntentId : undefined,
  };
}

async function callRpc(
  client: GiftCleanupRpcClient,
  functionName: string,
  parameters: Record<string, unknown>,
) {
  const { data, error } = await client.rpc(functionName, parameters);
  if (error) {
    throw new Error(error.message ?? `${functionName} failed`);
  }
  return data;
}

async function redactOrder(client: GiftCleanupRpcClient, order: AbandonedGiftOrder) {
  return (
    await callRpc(client, "gift_redact_abandoned_pending_order", {
      p_order_id: order.orderId,
      p_payment_intent_id: order.paymentIntentId ?? null,
    })
  ) === true;
}

async function fulfillSucceededOrder(
  client: GiftCleanupRpcClient,
  order: AbandonedGiftOrder,
) {
  return (
    isRecord(
      await callRpc(client, "gift_mark_paid_and_enqueue", {
        p_certificate_code: order.certificateCode,
        p_locale: order.locale,
        p_order_id: order.orderId,
        p_payment_intent_id: order.paymentIntentId,
        p_total_eur_cents: order.amountEurCents,
      }),
    )
  );
}

export async function cleanupAbandonedGiftCertificateOrders({
  batchSize = 25,
  client = createSupabaseAdminClient() as unknown as GiftCleanupRpcClient | null,
  expectedLivemode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ?? false,
  stripe = getStripeClient() as GiftCleanupStripe | undefined,
}: {
  batchSize?: number;
  client?: GiftCleanupRpcClient | null;
  expectedLivemode?: boolean;
  stripe?: GiftCleanupStripe;
} = {}): Promise<GiftCleanupResult> {
  const result: GiftCleanupResult = {
    cancelled: 0,
    claimed: 0,
    failed: 0,
    fulfilled: 0,
    redacted: 0,
  };
  if (!client) return result;

  const claimed = await callRpc(client, "gift_claim_abandoned_pending_orders", {
    p_limit: batchSize,
  });
  if (!Array.isArray(claimed)) {
    throw new Error("Abandoned gift cleanup returned invalid data.");
  }

  const orders = claimed.map(parseAbandonedGiftOrder);
  result.claimed = claimed.length;
  result.failed += orders.filter((order) => !order).length;

  for (const order of orders) {
    if (!order) continue;

    try {
      if (!order.paymentIntentId) {
        if (await redactOrder(client, order)) {
          result.redacted += 1;
        } else {
          result.failed += 1;
        }
        continue;
      }
      if (!stripe) {
        result.failed += 1;
        continue;
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
      const metadata = decodeGiftOrderReferenceMetadata(paymentIntent.metadata);
      if (
        paymentIntent.id !== order.paymentIntentId ||
        paymentIntent.amount !== order.amountEurCents ||
        paymentIntent.currency.toLowerCase() !== "eur" ||
        paymentIntent.livemode !== expectedLivemode ||
        !metadata ||
        metadata.orderId !== order.orderId ||
        metadata.certificateCode !== order.certificateCode ||
        metadata.locale !== order.locale ||
        metadata.totalEurCents !== order.amountEurCents
      ) {
        result.failed += 1;
        continue;
      }

      if (paymentIntent.status === "succeeded") {
        if (await fulfillSucceededOrder(client, order)) result.fulfilled += 1;
        continue;
      }

      let finalStatus: Stripe.PaymentIntent.Status = paymentIntent.status;
      if (cancellablePaymentIntentStatuses.has(finalStatus)) {
        const cancelled = await stripe.paymentIntents.cancel(order.paymentIntentId, {
          cancellation_reason: "abandoned",
        });
        finalStatus = cancelled.status;
        if (finalStatus === "canceled") result.cancelled += 1;
      }

      if (finalStatus === "canceled") {
        if (await redactOrder(client, order)) {
          result.redacted += 1;
        } else {
          result.failed += 1;
        }
      } else {
        result.failed += 1;
      }
    } catch (error) {
      result.failed += 1;
      console.error(
        "Abandoned gift certificate cleanup failed",
        error instanceof Error ? error.message : "unknown_error",
      );
    }
  }

  return result;
}
