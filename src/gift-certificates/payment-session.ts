import type Stripe from "stripe";
import { randomUUID } from "node:crypto";

import {
  calculateGiftCertificateTotal,
  getGiftCertificateExpiryDate,
  giftCertificateSalesConfig,
} from "@/content/gift-certificates";
import { encodeGiftOrderReferenceMetadata } from "./metadata";
import type { GiftCertificateOrderStore } from "./order-store";
import type {
  GiftCertificatePaymentMetadataOrder,
} from "./types";
import {
  createGiftCertificateCode,
  validateGiftCertificateOrderPayload,
} from "./validation";

type GiftPaymentStripe = {
  paymentIntents: {
    create: (
      params: Stripe.PaymentIntentCreateParams,
      options?: { idempotencyKey?: string },
    ) => Promise<{ id: string; client_secret: string | null }>;
  };
};

type GiftPaymentEnvironment = {
  STRIPE_SECRET_KEY?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  GIFT_CERTIFICATES_ENABLE_LIVE_PAYMENTS?: string;
  GIFT_CERTIFICATES_FINAL_PRICES_CONFIRMED?: string;
};

export type GiftCertificatePaymentSessionInput = {
  createOrderId?: () => string;
  idempotencyKey?: string;
  orderStore?: GiftCertificateOrderStore;
  payload: unknown;
  now?: Date;
  env?: GiftPaymentEnvironment;
  stripe?: GiftPaymentStripe;
};

export type GiftCertificatePaymentSession =
  | {
      mode: "demo";
      clientSecret: null;
      paymentIntentId: null;
      amountEurCents: number;
      certificateCode: string;
    }
  | {
      mode: "stripe";
      clientSecret: string;
      paymentIntentId: string;
      amountEurCents: number;
      certificateCode: string;
    };

function isLiveStripeKey(key: string | undefined): boolean {
  return key?.startsWith("sk_live_") ?? false;
}

function assertLivePaymentSafety(env: GiftPaymentEnvironment) {
  if (!isLiveStripeKey(env.STRIPE_SECRET_KEY)) {
    return;
  }

  const livePaymentsEnabled = env.GIFT_CERTIFICATES_ENABLE_LIVE_PAYMENTS === "true";
  const finalPricesConfirmed = env.GIFT_CERTIFICATES_FINAL_PRICES_CONFIRMED === "true";

  if (
    !livePaymentsEnabled ||
    !finalPricesConfirmed ||
    !giftCertificateSalesConfig.pricesAreFinal
  ) {
    throw new Error(
      "Live gift certificate payments are disabled until final prices and live flags are confirmed.",
    );
  }
}

function buildStatementDescriptor(): string {
  return "MMN GIFT";
}

export async function createGiftCertificatePaymentSession({
  createOrderId = randomUUID,
  payload,
  idempotencyKey,
  orderStore,
  now = new Date(),
  env = process.env as GiftPaymentEnvironment,
  stripe,
}: GiftCertificatePaymentSessionInput): Promise<GiftCertificatePaymentSession> {
  const validation = validateGiftCertificateOrderPayload(payload);

  if (!validation.success) {
    throw new Error(validation.errors.join(" "));
  }

  assertLivePaymentSafety(env);

  const total = calculateGiftCertificateTotal(validation.data);
  const certificateCode = createGiftCertificateCode(now);
  const order: GiftCertificatePaymentMetadataOrder = {
    ...validation.data,
    expiresOn: getGiftCertificateExpiryDate(now),
    totalEurCents: total.totalEurCents,
  };

  if (!stripe || !env.STRIPE_SECRET_KEY) {
    return {
      mode: "demo",
      clientSecret: null,
      paymentIntentId: null,
      amountEurCents: total.totalEurCents,
      certificateCode,
    };
  }

  if (!orderStore) {
    throw new Error("Gift certificate order persistence is not configured.");
  }

  const stableIdempotencyKey = idempotencyKey ?? randomUUID();
  const persistedOrder = await orderStore.createPendingOrder({
    certificateCode,
    idempotencyKey: stableIdempotencyKey,
    order,
    orderId: createOrderId(),
  });

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: total.totalEurCents,
      currency: "eur",
      receipt_email: persistedOrder.purchaserEmail,
      description: `Gift certificate ${persistedOrder.certificateCode}`,
      statement_descriptor: buildStatementDescriptor(),
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      metadata: encodeGiftOrderReferenceMetadata({
        certificateCode: persistedOrder.certificateCode,
        locale: persistedOrder.locale,
        orderId: persistedOrder.id,
        schemaVersion: "v2",
        totalEurCents: persistedOrder.totalEurCents,
      }),
    },
    { idempotencyKey: stableIdempotencyKey },
  );

  if (!paymentIntent.client_secret) {
    throw new Error("Stripe did not return a client secret.");
  }

  await orderStore.attachPaymentIntent(persistedOrder.id, paymentIntent.id);

  return {
    mode: "stripe",
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amountEurCents: persistedOrder.totalEurCents,
    certificateCode: persistedOrder.certificateCode,
  };
}
