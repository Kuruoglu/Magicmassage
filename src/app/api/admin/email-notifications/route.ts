import { NextResponse } from "next/server";

import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
} from "@/lib/supabase/admin";

const aggregateIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const allowedAggregateTypes = new Set(["appointment", "certificate"]);

type EmailNotificationRow = {
  can_clear_suppression?: unknown;
  can_retry?: unknown;
  event_type?: unknown;
  id?: unknown;
  recipient_email?: unknown;
  status?: unknown;
  updated_at?: unknown;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function maskEmail(value: string) {
  const [local, domain] = value.trim().split("@");
  if (!local || !domain) return "";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function normalizeNotification(row: EmailNotificationRow) {
  if (
    typeof row.id !== "string" ||
    typeof row.event_type !== "string" ||
    typeof row.status !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    return null;
  }

  const recipient = typeof row.recipient_email === "string" ? row.recipient_email : "";
  return {
    canClearSuppression: row.can_clear_suppression === true,
    canRetry: row.can_retry === true,
    eventType: row.event_type,
    id: row.id,
    recipientMasked: maskEmail(recipient),
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: Request) {
  const client = createSupabaseAdminClient();
  if (!client) return jsonError("Forbidden", 403);

  const authorization = await authorizeSupabaseAdminAccess(
    client,
    getBearerToken(request.headers.get("authorization")),
    { allowedRoles: ["owner", "administrator"] },
  );
  if (!authorization.ok) return jsonError(authorization.message, authorization.statusCode);

  const url = new URL(request.url);
  const aggregateType = url.searchParams.get("aggregateType") ?? "";
  const aggregateId = url.searchParams.get("aggregateId") ?? "";
  if (!allowedAggregateTypes.has(aggregateType) || !aggregateIdPattern.test(aggregateId)) {
    return jsonError("Invalid email notification lookup.", 400);
  }

  const { data, error } = await client.rpc("admin_list_email_notifications", {
    p_aggregate_id: aggregateId,
    p_aggregate_type: aggregateType,
  }) as unknown as {
    data: EmailNotificationRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("Admin email notification lookup failed", error.message);
    return jsonError("Не удалось загрузить статусы писем.", 500);
  }

  return NextResponse.json({
    notifications: (data ?? []).map(normalizeNotification).filter((item) => item !== null),
  });
}
