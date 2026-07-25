import { NextResponse } from "next/server";

import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
} from "@/lib/supabase/admin";

const notificationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const client = createSupabaseAdminClient();
  if (!client) return jsonError("Forbidden", 403);

  const authorization = await authorizeSupabaseAdminAccess(
    client,
    getBearerToken(request.headers.get("authorization")),
    { allowedRoles: ["owner", "administrator"] },
  );
  if (!authorization.ok) return jsonError(authorization.message, authorization.statusCode);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Некорректный запрос.", 400);
  }

  const record = typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : null;
  const notificationId = record?.notificationId;
  if (typeof notificationId !== "string" || !notificationIdPattern.test(notificationId)) {
    return jsonError("Некорректное письмо.", 400);
  }
  const correctedEmailValue = record?.correctedEmail;
  if (correctedEmailValue !== undefined && correctedEmailValue !== null
    && typeof correctedEmailValue !== "string") {
    return jsonError("Некорректный email.", 400);
  }
  const correctedEmail = typeof correctedEmailValue === "string"
    ? correctedEmailValue.trim().toLowerCase()
    : "";
  if (correctedEmail && (correctedEmail.length > 254 || !emailPattern.test(correctedEmail))) {
    return jsonError("Некорректный email.", 400);
  }

  const { data, error } = await client.rpc("admin_retry_email_notification", {
    p_actor_user_id: authorization.userId,
    p_corrected_email: correctedEmail || null,
    p_notification_id: notificationId,
  }) as unknown as {
    data: boolean | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("Admin email notification retry failed", error.message);
    return jsonError("Не удалось повторить отправку.", 500);
  }
  if (!data) return jsonError("Письмо нельзя отправить повторно.", 409);

  return NextResponse.json({ ok: true });
}
