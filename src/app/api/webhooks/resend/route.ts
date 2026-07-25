import { NextResponse } from "next/server";

import { parseResendWebhook, verifyResendWebhook } from "@/email/webhook";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RpcClient = {
  rpc(functionName: string, parameters: Record<string, unknown>): PromiseLike<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });

  const body = await request.text();
  const svixId = request.headers.get("svix-id");
  if (!verifyResendWebhook({
    body,
    id: svixId,
    secret,
    signature: request.headers.get("svix-signature"),
    timestamp: request.headers.get("svix-timestamp"),
  })) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const event = parseResendWebhook(body);
  if (!event) return NextResponse.json({ ignored: true });
  const client = createSupabaseAdminClient() as unknown as RpcClient | null;
  if (!client || !svixId) return NextResponse.json({ error: "webhook_unavailable" }, { status: 503 });

  const { error } = await client.rpc("email_record_webhook_event", {
    p_event_id: svixId,
    p_event_type: event.eventType,
    p_occurred_at: event.occurredAt,
    p_provider_message_id: event.messageId,
    p_recipient_email: event.recipientEmail,
  });
  if (error) {
    console.error("Resend webhook persistence failed", error.message ?? "unknown_error");
    return NextResponse.json({ error: "webhook_persistence_failed" }, { status: 503 });
  }

  return NextResponse.json({ received: true });
}
