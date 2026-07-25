import { NextResponse } from "next/server";

import { verifyEmailPreferenceToken } from "@/email/preferences-token";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Invalid email preference request.", 403);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid or expired email preference link.", 400);
  }

  const token = typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).token
    : undefined;
  if (typeof token !== "string" || token.length > 4096) {
    return jsonError("Invalid or expired email preference link.", 400);
  }

  const verified = verifyEmailPreferenceToken(token);
  if (!verified) return jsonError("Invalid or expired email preference link.", 400);

  const client = createSupabaseAdminClient();
  if (!client) return jsonError("Email preferences are temporarily unavailable.", 503);

  const { data, error } = await client.rpc("email_unsubscribe_care_by_notification", {
    p_notification_id: verified.notificationId,
  }) as unknown as {
    data: boolean | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("Care email preference update failed", error.message);
    return jsonError("Email preferences are temporarily unavailable.", 503);
  }
  if (!data) return jsonError("Invalid or expired email preference link.", 400);

  return NextResponse.json({ ok: true });
}
