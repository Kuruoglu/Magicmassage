import { NextResponse } from "next/server";

import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
} from "@/lib/supabase/admin";

const notificationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const notificationId = typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).notificationId
    : undefined;
  if (typeof notificationId !== "string" || !notificationIdPattern.test(notificationId)) {
    return jsonError("Некорректное письмо.", 400);
  }

  const { data, error } = await client.rpc("admin_clear_email_suppression_by_notification", {
    p_actor_user_id: authorization.userId,
    p_notification_id: notificationId,
  }) as unknown as {
    data: boolean | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("Admin email suppression release failed", error.message);
    return jsonError("Не удалось снять блокировку адреса.", 500);
  }
  if (!data) return jsonError("Блокировка не найдена или уже снята.", 409);

  return NextResponse.json({ ok: true });
}
