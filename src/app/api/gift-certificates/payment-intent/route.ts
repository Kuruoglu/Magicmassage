import { NextResponse } from "next/server";

import { createGiftCertificatePaymentSession } from "@/gift-certificates/payment-session";
import { getStripeClient } from "@/gift-certificates/stripe-client";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const session = await createGiftCertificatePaymentSession({
      payload,
      stripe: getStripeClient(),
    });

    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create payment.";
    const status = message.includes("Live gift certificate payments are disabled") ? 403 : 400;

    return NextResponse.json(
      { error: "Unable to create gift certificate payment." },
      { status },
    );
  }
}
