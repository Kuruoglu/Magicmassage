import { NextResponse } from "next/server";

import { createGiftCertificateOrderStore } from "@/gift-certificates/order-store";
import { getStripeClient } from "@/gift-certificates/stripe-client";
import { handleGiftCertificateWebhook } from "@/gift-certificates/webhook";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripeClient();
  const orderStore = createGiftCertificateOrderStore();

  if (!webhookSecret || !stripe || !orderStore) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  try {
    const rawBody = await request.text();
    const result = await handleGiftCertificateWebhook({
      expectedLivemode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ?? false,
      orderStore,
      rawBody,
      signature: request.headers.get("stripe-signature"),
      stripe,
      webhookSecret,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "Gift certificate webhook failed",
      error instanceof Error ? error.message : "Unknown webhook error",
    );
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 400 });
  }
}
