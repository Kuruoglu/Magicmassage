import { NextResponse } from "next/server";

import { handleGiftCertificateWebhook } from "@/gift-certificates/webhook";
import { getStripeClient } from "@/gift-certificates/stripe-client";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripeClient();

  if (!webhookSecret || !stripe) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  try {
    const rawBody = await request.text();
    const result = await handleGiftCertificateWebhook({
      rawBody,
      signature: request.headers.get("stripe-signature"),
      webhookSecret,
      stripe,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 400 });
  }
}
