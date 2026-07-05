import { NextResponse } from "next/server";

import { getStripeClient } from "@/gift-certificates/stripe-client";

export async function GET(request: Request) {
  const paymentIntentId = new URL(request.url).searchParams.get("payment_intent");
  const clientSecret = new URL(request.url).searchParams.get("payment_intent_client_secret");
  const stripe = getStripeClient();

  if (!paymentIntentId || !clientSecret) {
    return NextResponse.json({ error: "Missing payment status parameters." }, { status: 400 });
  }

  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.client_secret !== clientSecret) {
      return NextResponse.json({ error: "Payment status is not available." }, { status: 403 });
    }

    return NextResponse.json({
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      fulfilled: Boolean(paymentIntent.metadata.gift_fulfilled_at),
    });
  } catch {
    return NextResponse.json({ error: "Unable to retrieve payment status." }, { status: 400 });
  }
}
