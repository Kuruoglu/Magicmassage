import { NextResponse } from "next/server";

import type { CalendarBlock, CalendarBlockKind } from "@/admin/domain";
import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
} from "@/lib/supabase/admin";

type CalendarBlockPayload = {
  blockDate: string;
  endsAt: string;
  id?: string;
  internalNote: string;
  kind: CalendarBlockKind;
  specialistId?: string;
  startsAt: string;
  version?: number;
};

type RpcResult = {
  data: Record<string, unknown> | null;
  error: { code?: string; message: string } | null;
};

type CalendarBlockRpcClient = {
  rpc(functionName: string, parameters: Record<string, unknown>): PromiseLike<RpcResult>;
};

type CalendarBlockAccess =
  | { ok: false; response: NextResponse }
  | { actorUserId: string; client: CalendarBlockRpcClient; ok: true; specialistId?: string };

const allowedKinds = new Set<CalendarBlockKind>(["personal", "unavailable", "other"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function isRealIsoDate(value: string) {
  if (!datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isCalendarBlockPayload(value: unknown, requireId: boolean): value is CalendarBlockPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const allowedKeys = ["blockDate", "endsAt", "id", "internalNote", "kind", "specialistId", "startsAt", "version"];

  return (
    Object.keys(record).every((key) => allowedKeys.includes(key)) &&
    typeof record.blockDate === "string" &&
    isRealIsoDate(record.blockDate) &&
    typeof record.startsAt === "string" &&
    timePattern.test(record.startsAt) &&
    typeof record.endsAt === "string" &&
    timePattern.test(record.endsAt) &&
    record.startsAt < record.endsAt &&
    typeof record.kind === "string" &&
    allowedKinds.has(record.kind as CalendarBlockKind) &&
    typeof record.internalNote === "string" &&
    record.internalNote.length <= 2000 &&
    (record.specialistId === undefined || (typeof record.specialistId === "string" && uuidPattern.test(record.specialistId))) &&
    (record.id === undefined || (typeof record.id === "string" && uuidPattern.test(record.id))) &&
    (record.version === undefined || (Number.isInteger(record.version) && (record.version as number) > 0)) &&
    (!requireId || typeof record.version === "number") &&
    (!requireId || typeof record.id === "string")
  );
}

function mapCalendarBlock(data: Record<string, unknown>): CalendarBlock | null {
  if (
    typeof data.id !== "string" ||
    typeof data.block_date !== "string" ||
    typeof data.starts_at !== "string" ||
    typeof data.ends_at !== "string" ||
    typeof data.kind !== "string" ||
    !allowedKinds.has(data.kind as CalendarBlockKind)
  ) {
    return null;
  }

  return {
    blockDate: data.block_date,
    endsAt: data.ends_at.slice(0, 5),
    id: data.id,
    internalNote: typeof data.internal_note === "string" ? data.internal_note : "",
    kind: data.kind as CalendarBlockKind,
    specialistId: typeof data.specialist_id === "string" ? data.specialist_id : undefined,
    startsAt: data.starts_at.slice(0, 5),
    version: typeof data.version === "number" ? data.version : 1,
  };
}

function mapRpcError(error: { code?: string; message: string }) {
  if (error.message.includes("calendar_block_conflict") || error.code === "23P01") {
    return errorResponse(
      "Это время пересекается с записью клиента или другой блокировкой. Сначала перенесите запись или измените интервал.",
      409,
    );
  }
  if (error.message.includes("calendar_block_not_found") || error.code === "P0002") {
    return errorResponse("Недоступное время не найдено.", 404);
  }
  if (error.message.includes("calendar_block_concurrent_update") || error.code === "40001") {
    return errorResponse("Недоступное время уже изменено. Обновите страницу и повторите действие.", 409);
  }
  if (error.message.includes("invalid_calendar_block") || error.code === "22023") {
    return errorResponse("Проверьте дату, время и тип блокировки.", 400);
  }
  if (error.message.includes("calendar_block_forbidden") || error.code === "42501") {
    return errorResponse("Forbidden", 403);
  }

  console.error("Admin calendar block mutation failed", error.message);
  return errorResponse("Не удалось изменить недоступное время.", 500);
}

async function authorize(request: Request): Promise<CalendarBlockAccess> {
  const client = createSupabaseAdminClient();
  if (!client) return { ok: false, response: errorResponse("Forbidden", 403) };

  const authorization = await authorizeSupabaseAdminAccess(
    client,
    getBearerToken(request.headers.get("authorization")),
    { allowedRoles: ["owner", "administrator", "specialist"] },
  );
  if (!authorization.ok) {
    return { ok: false, response: errorResponse(authorization.message, authorization.statusCode) };
  }

  return {
    actorUserId: authorization.userId,
    client: client as unknown as CalendarBlockRpcClient,
    ok: true,
    specialistId: authorization.specialistId,
  };
}

async function parseJson(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    return undefined;
  }
}

async function upsert(request: Request, requireId: boolean): Promise<NextResponse> {
  const access = await authorize(request);
  if (!access.ok) return access.response;

  const payload = await parseJson(request);
  if (!isCalendarBlockPayload(payload, requireId)) {
    return errorResponse("Проверьте дату, время и тип блокировки.", 400);
  }

  const { data, error } = await access.client.rpc("admin_mutate_specialist_calendar_block", {
    p_action: "upsert",
    p_actor_user_id: access.actorUserId,
    p_block_date: payload.blockDate,
    p_block_id: payload.id ?? null,
    p_ends_at: payload.endsAt,
    p_internal_note: payload.internalNote.trim(),
    p_kind: payload.kind,
    p_specialist_id: access.specialistId ?? payload.specialistId ?? null,
    p_starts_at: payload.startsAt,
    p_expected_version: payload.version ?? null,
  });
  if (error) return mapRpcError(error);

  const block = data ? mapCalendarBlock(data) : null;
  return block
    ? NextResponse.json({ block })
    : errorResponse("Не удалось прочитать сохраненное недоступное время.", 500);
}

export async function POST(request: Request): Promise<NextResponse> {
  return upsert(request, false);
}

export async function PATCH(request: Request): Promise<NextResponse> {
  return upsert(request, true);
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const access = await authorize(request);
  if (!access.ok) return access.response;

  const payload = await parseJson(request);
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload) ||
    Object.keys(payload).some((key) => key !== "id" && key !== "version" && key !== "specialistId") ||
    typeof (payload as Record<string, unknown>).id !== "string" ||
    !uuidPattern.test((payload as { id: string }).id) ||
    !Number.isInteger((payload as Record<string, unknown>).version) ||
    ((payload as { version: number }).version <= 0)
  ) {
    return errorResponse("Недоступное время не найдено.", 400);
  }

  const { data, error } = await access.client.rpc("admin_mutate_specialist_calendar_block", {
    p_action: "delete",
    p_actor_user_id: access.actorUserId,
    p_block_date: null,
    p_block_id: (payload as { id: string }).id,
    p_ends_at: null,
    p_internal_note: null,
    p_kind: null,
    p_specialist_id: access.specialistId ?? null,
    p_starts_at: null,
    p_expected_version: (payload as { version: number }).version,
  });
  if (error) return mapRpcError(error);

  return NextResponse.json({ deleted: data?.deleted === true });
}
