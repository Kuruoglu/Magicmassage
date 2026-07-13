import { NextResponse } from "next/server";

import { handleGiftCertificateWebhook } from "@/gift-certificates/webhook";
import { getStripeClient } from "@/gift-certificates/stripe-client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type GiftFulfillmentLockOrder = {
  locale: string;
  purchaserEmail: string;
  purchaserName: string;
  recipientEmail?: string;
  recipientName: string;
};

function createSupabaseFulfillmentClaim() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return undefined;
  }

  return async (
    paymentIntentId: string,
    order: GiftFulfillmentLockOrder,
    certificateCode: string,
    amountEurCents: number,
  ) => {
    const { error: orderError } = await supabase.from("gift_certificate_orders").upsert(
      {
        amount_eur_cents: amountEurCents,
        certificate_code: certificateCode,
        locale: order.locale,
        payment_intent_id: paymentIntentId,
        purchaser_email: order.purchaserEmail,
        purchaser_name: order.purchaserName,
        recipient_email: order.recipientEmail ?? null,
        recipient_name: order.recipientName,
        status: "paid",
      },
      { onConflict: "payment_intent_id" },
    );

    if (orderError) {
      console.error("Gift certificate order upsert failed", orderError.message);
      throw new Error("Gift certificate order persistence failed.");
    }

    const { error } = await supabase.from("gift_certificate_fulfillment_locks").insert({
      certificate_code: certificateCode,
      payment_intent_id: paymentIntentId,
    });

    if (error) {
      const lockError = error.message.toLowerCase();

      if (lockError.includes("duplicate") || lockError.includes("23505")) {
        return false;
      }

      console.error("Gift certificate fulfillment lock failed", error.message);
      throw new Error("Gift certificate fulfillment lock failed.");
    }

    return true;
  };
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripeClient();

  if (!webhookSecret || !stripe) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  try {
    const rawBody = await request.text();
    const result = await handleGiftCertificateWebhook({
      expectedLivemode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ?? false,
      rawBody,
      signature: request.headers.get("stripe-signature"),
      webhookSecret,
      stripe,
      claimFulfillment: createSupabaseFulfillmentClaim(),
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 400 });
  }
}
