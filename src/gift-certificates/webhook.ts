import type Stripe from "stripe";

import { calculateGiftCertificateTotal } from "@/content/gift-certificates";
import { decodeGiftOrderReferenceMetadata } from "./metadata";
import type { GiftCertificateOrderStore } from "./order-store";

type WebhookStripe = {
  webhooks: {
    constructEvent: (rawBody: string, signature: string, secret: string) => Stripe.Event;
  };
  paymentIntents: {
    retrieve: (id: string) => Promise<GiftCertificatePaymentIntentForFulfillment>;
  };
};

export type GiftCertificatePaymentIntentForFulfillment = {
  amount?: number;
  currency?: string;
  id: string;
  livemode?: boolean;
  metadata: Record<string, string | undefined>;
  status: string;
};

type HandleGiftCertificateWebhookInput = {
  expectedLivemode?: boolean;
  orderStore?: GiftCertificateOrderStore;
  rawBody: string;
  signature: string | null;
  stripe: WebhookStripe;
  webhookSecret: string;
};

function getPaymentIntentId(event: Stripe.Event): string | undefined {
  const object = event.data.object as { id?: string; object?: string };

  return object.object === "payment_intent" ? object.id : undefined;
}

export async function finalizePersistedGiftCertificatePayment({
  actorUserId,
  expectedLivemode,
  orderStore,
  paymentIntent,
}: {
  actorUserId?: string;
  expectedLivemode?: boolean;
  orderStore: GiftCertificateOrderStore;
  paymentIntent: GiftCertificatePaymentIntentForFulfillment;
}) {
  if (paymentIntent.status !== "succeeded") {
    throw new Error("Gift certificate payment is not successful.");
  }

  if (expectedLivemode !== undefined && paymentIntent.livemode !== expectedLivemode) {
    throw new Error("Stripe livemode does not match environment.");
  }

  const reference = decodeGiftOrderReferenceMetadata(paymentIntent.metadata);

  if (!reference) {
    throw new Error("Missing gift certificate order reference.");
  }

  if (paymentIntent.amount !== reference.totalEurCents) {
    throw new Error("Payment amount does not match gift certificate order.");
  }

  if (paymentIntent.currency?.toLowerCase() !== "eur") {
    throw new Error("Payment currency does not match gift certificate order.");
  }

  const order = await orderStore.loadOrder(reference.orderId);
  const calculatedTotal = calculateGiftCertificateTotal(order).totalEurCents;

  if (
    order.id !== reference.orderId ||
    order.certificateCode !== reference.certificateCode ||
    order.locale !== reference.locale ||
    order.totalEurCents !== reference.totalEurCents ||
    calculatedTotal !== reference.totalEurCents ||
    (order.paymentIntentId !== undefined && order.paymentIntentId !== paymentIntent.id)
  ) {
    throw new Error("Persisted gift certificate order does not match payment metadata.");
  }

  const input = {
    certificateCode: reference.certificateCode,
    locale: reference.locale,
    orderId: reference.orderId,
    paymentIntentId: paymentIntent.id,
    totalEurCents: reference.totalEurCents,
  };

  return actorUserId
    ? orderStore.reconcilePaidAndEnqueue({ ...input, actorUserId })
    : orderStore.markPaidAndEnqueue(input);
}

export async function handleGiftCertificateWebhook({
  expectedLivemode,
  orderStore,
  rawBody,
  signature,
  stripe,
  webhookSecret,
}: HandleGiftCertificateWebhookInput) {
  if (!signature) {
    throw new Error("Missing Stripe signature.");
  }

  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

  if (event.type !== "payment_intent.succeeded") {
    return { received: true, fulfilled: false };
  }

  const paymentIntentId = getPaymentIntentId(event);

  if (!paymentIntentId) {
    throw new Error("Missing PaymentIntent id.");
  }

  if (!orderStore) {
    throw new Error("Gift certificate order persistence is not configured.");
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const newlyPaid = await finalizePersistedGiftCertificatePayment({
    expectedLivemode,
    orderStore,
    paymentIntent,
  });

  return { received: true, fulfilled: newlyPaid };
}
