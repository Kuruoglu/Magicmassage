import type Stripe from "stripe";

import { calculateGiftCertificateTotal } from "@/content/gift-certificates";
import { decodeGiftOrderMetadata, toFulfillmentOrder } from "./metadata";
import type { GiftCertificateEmailResult } from "./email";
import {
  sendGiftCertificateBuyerEmail,
  sendGiftCertificateRecipientEmail,
} from "./email";
import {
  generateGiftCertificatePdf,
  type GiftCertificatePdf,
} from "./pdf";
import type { GiftCertificatePaymentMetadataOrder } from "./types";

type WebhookStripe = {
  webhooks: {
    constructEvent: (rawBody: string, signature: string, secret: string) => Stripe.Event;
  };
  paymentIntents: {
    retrieve: (id: string) => Promise<{
      id: string;
      amount?: number;
      currency?: string;
      livemode?: boolean;
      metadata: Record<string, string | undefined>;
    }>;
    update: (
      id: string,
      params: { metadata: Record<string, string | null> },
    ) => Promise<unknown>;
  };
};

type HandleGiftCertificateWebhookInput = {
  rawBody: string;
  signature: string | null;
  webhookSecret: string;
  stripe: WebhookStripe;
  fulfill?: (input: {
    certificateCode: string;
    order: ReturnType<typeof toFulfillmentOrder>;
    paymentIntentId: string;
  }) => Promise<GiftCertificateEmailResult>;
  generatePdf?: (input: {
    certificateCode: string;
    order: ReturnType<typeof toFulfillmentOrder>;
  }) => Promise<GiftCertificatePdf>;
  sendBuyerEmail?: (input: {
    certificateCode: string;
    order: ReturnType<typeof toFulfillmentOrder>;
    pdf: GiftCertificatePdf;
  }) => Promise<string>;
  sendRecipientEmail?: (input: {
    certificateCode: string;
    order: ReturnType<typeof toFulfillmentOrder>;
    pdf: GiftCertificatePdf;
  }) => Promise<string | null>;
  now?: Date;
};

function getPaymentIntentId(event: Stripe.Event): string | undefined {
  const object = event.data.object as { id?: string; object?: string };

  return object.object === "payment_intent" ? object.id : undefined;
}

function verifyPaymentIntentMatchesOrder(
  paymentIntent: { amount?: number; currency?: string },
  order: GiftCertificatePaymentMetadataOrder,
) {
  const total = calculateGiftCertificateTotal(order);

  if (paymentIntent.amount !== undefined && paymentIntent.amount !== total.totalEurCents) {
    throw new Error("Payment amount does not match gift certificate order.");
  }

  if (paymentIntent.currency !== undefined && paymentIntent.currency.toLowerCase() !== "eur") {
    throw new Error("Payment currency does not match gift certificate order.");
  }
}

export async function handleGiftCertificateWebhook({
  rawBody,
  signature,
  webhookSecret,
  stripe,
  fulfill,
  generatePdf = generateGiftCertificatePdf,
  sendBuyerEmail = sendGiftCertificateBuyerEmail,
  sendRecipientEmail = sendGiftCertificateRecipientEmail,
  now = new Date(),
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

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.metadata.gift_fulfilled_at) {
    return { received: true, fulfilled: false };
  }

  const certificateCode = paymentIntent.metadata.gift_certificate_code;
  const metadataOrder = decodeGiftOrderMetadata(paymentIntent.metadata);

  if (!certificateCode || !metadataOrder) {
    throw new Error("Missing gift certificate metadata.");
  }

  verifyPaymentIntentMatchesOrder(paymentIntent, metadataOrder);

  const order = toFulfillmentOrder(metadataOrder);

  if (fulfill) {
    const emailResult = await fulfill({
      certificateCode,
      order,
      paymentIntentId,
    });

    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        gift_fulfilled_at: now.toISOString(),
        gift_buyer_email_id: emailResult.buyerEmailId,
        gift_recipient_email_id: emailResult.recipientEmailId,
      },
    });

    return { received: true, fulfilled: true };
  }

  const pdf = await generatePdf({ certificateCode, order });
  const existingBuyerEmailId = paymentIntent.metadata.gift_buyer_email_id;
  const buyerEmailId =
    existingBuyerEmailId ??
    (await sendBuyerEmail({
      certificateCode,
      order,
      pdf,
    }));

  if (!existingBuyerEmailId) {
    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        gift_buyer_email_id: buyerEmailId,
      },
    });
  }

  const needsRecipientEmail = order.deliveryMode === "recipient_email" && order.recipientEmail;
  const existingRecipientEmailId = paymentIntent.metadata.gift_recipient_email_id;
  const recipientEmailId =
    existingRecipientEmailId ??
    (needsRecipientEmail
      ? await sendRecipientEmail({
          certificateCode,
          order,
          pdf,
        })
      : null);

  if (needsRecipientEmail && !existingRecipientEmailId) {
    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        gift_recipient_email_id: recipientEmailId,
      },
    });
  }

  await stripe.paymentIntents.update(paymentIntentId, {
    metadata: {
      gift_fulfilled_at: now.toISOString(),
      gift_buyer_email_id: buyerEmailId,
      gift_recipient_email_id: recipientEmailId,
    },
  });

  return { received: true, fulfilled: true };
}
