import { NextResponse } from "next/server";

import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
} from "@/lib/supabase/admin";

const appointmentIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,199}$/;

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
  if (!authorization.ok) {
    return jsonError(authorization.message, authorization.statusCode);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Некорректный запрос.", 400);
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return jsonError("Некорректный запрос.", 400);
  }

  const record = payload as Record<string, unknown>;
  if (
    Object.keys(record).some((key) => key !== "appointmentId" && key !== "purpose") ||
    typeof record.appointmentId !== "string" ||
    !appointmentIdPattern.test(record.appointmentId) ||
    typeof record.purpose !== "string" ||
    record.purpose.trim().length < 3 ||
    record.purpose.trim().length > 200
  ) {
    return jsonError("Укажите запись и причину просмотра контактов.", 400);
  }

  const { data, error } = await client.rpc("admin_reveal_appointment_contact", {
    p_actor_user_id: authorization.userId,
    p_appointment_id: record.appointmentId,
    p_purpose: record.purpose.trim(),
  }) as unknown as {
    data: { email?: string; phone?: string; preferredContact?: string } | null;
    error: { message: string } | null;
  };

  if (error) {
    if (error.message.includes("contact_reveal_forbidden")) return jsonError("Forbidden", 403);
    if (error.message.includes("appointment_not_found")) return jsonError("Запись не найдена.", 404);
    if (error.message.includes("contact_reveal_rate_limited")) {
      return jsonError("Слишком много просмотров контактов. Доступ временно ограничен.", 429);
    }
    console.error("Admin contact reveal failed", error.message);
    return jsonError("Не удалось открыть контакты клиента.", 500);
  }

  return NextResponse.json({ contact: data ?? { email: "", phone: "", preferredContact: "phone" } });
}
