import { NextResponse } from "next/server";

import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
} from "@/lib/supabase/admin";

const alertIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SecurityAlertRow = {
  actor_name?: unknown;
  alert_type?: unknown;
  created_at?: unknown;
  event_count?: unknown;
  id?: unknown;
  resolved_at?: unknown;
  severity?: unknown;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function normalizeAlert(row: SecurityAlertRow) {
  if (
    typeof row.id !== "string" ||
    !alertIdPattern.test(row.id) ||
    typeof row.alert_type !== "string" ||
    typeof row.severity !== "string" ||
    typeof row.created_at !== "string"
  ) {
    return null;
  }

  return {
    actorName: typeof row.actor_name === "string" && row.actor_name.trim()
      ? row.actor_name.trim()
      : "Сотрудник",
    alertType: row.alert_type,
    createdAt: row.created_at,
    eventCount: typeof row.event_count === "number" && Number.isInteger(row.event_count)
      ? row.event_count
      : 0,
    id: row.id,
    severity: row.severity,
  };
}

async function authorize(request: Request) {
  const client = createSupabaseAdminClient();
  if (!client) return { error: jsonError("Forbidden", 403) } as const;

  const authorization = await authorizeSupabaseAdminAccess(
    client,
    getBearerToken(request.headers.get("authorization")),
    { allowedRoles: ["owner", "administrator"] },
  );
  if (!authorization.ok) {
    return { error: jsonError(authorization.message, authorization.statusCode) } as const;
  }

  return { authorization, client } as const;
}

export async function GET(request: Request) {
  const access = await authorize(request);
  if ("error" in access) return access.error!;

  const { data, error } = await access.client.rpc("admin_list_security_alerts", {}) as unknown as {
    data: SecurityAlertRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("Admin security alerts lookup failed", error.message);
    return jsonError("Не удалось загрузить предупреждения безопасности.", 500);
  }

  return NextResponse.json({
    alerts: (data ?? []).map(normalizeAlert).filter((alert) => alert !== null),
  });
}

export async function PATCH(request: Request) {
  const access = await authorize(request);
  if ("error" in access) return access.error!;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Некорректный запрос.", 400);
  }

  const id = typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).id
    : undefined;
  if (typeof id !== "string" || !alertIdPattern.test(id)) {
    return jsonError("Некорректное предупреждение.", 400);
  }

  const { data, error } = await access.client.rpc("admin_resolve_security_alert", {
    p_actor_user_id: access.authorization.userId,
    p_alert_id: id,
  }) as unknown as {
    data: boolean | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("Admin security alert resolution failed", error.message);
    return jsonError("Не удалось закрыть предупреждение безопасности.", 500);
  }
  if (!data) return jsonError("Предупреждение не найдено.", 404);

  return NextResponse.json({ ok: true });
}
