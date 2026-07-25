import { NextResponse } from "next/server";

import { getStripeClient } from "@/gift-certificates/stripe-client";
import { decodeGiftOrderReferenceMetadata } from "@/gift-certificates/metadata";
import { createGiftCertificateOrderStore } from "@/gift-certificates/order-store";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const paymentIntentId = searchParams.get("payment_intent");
  const clientSecret = searchParams.get("payment_intent_client_secret");
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

    const reference = decodeGiftOrderReferenceMetadata(paymentIntent.metadata);
    if (!reference) {
      return NextResponse.json({ error: "Payment status is not available." }, { status: 409 });
    }

    const orderStore = createGiftCertificateOrderStore();
    if (!orderStore) {
      return NextResponse.json(
        { error: "Payment status is temporarily unavailable." },
        { status: 503 },
      );
    }

    const order = await orderStore.loadOrder(reference.orderId);

    if (
      paymentIntent.id !== paymentIntentId ||
      order.id !== reference.orderId ||
      order.paymentIntentId !== paymentIntent.id ||
      order.certificateCode !== reference.certificateCode ||
      order.totalEurCents !== reference.totalEurCents ||
      order.locale !== reference.locale
    ) {
      return NextResponse.json({ error: "Payment status is not available." }, { status: 409 });
    }

    return NextResponse.json({
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      fulfilled: order.status === "fulfilled",
    });
  } catch {
    return NextResponse.json({ error: "Unable to retrieve payment status." }, { status: 400 });
  }
}
