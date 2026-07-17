import { NextResponse } from "next/server";

import type { SpecialistScheduleDay } from "@/admin/domain";
import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
} from "@/lib/supabase/admin";

type SpecialistSchedulePayload = {
  expectedVersion: number;
  specialistId: string;
  weeklySchedule: SpecialistScheduleDay[];
};

type SpecialistScheduleRpcData = {
  specialist?: {
    id?: unknown;
    schedule_version?: unknown;
    weekly_schedule?: unknown;
  };
  working_days?: unknown;
  working_hours?: unknown;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const payloadKeys = new Set(["expectedVersion", "specialistId", "weeklySchedule"]);
const scheduleDayKeys = new Set(["weekday", "isWorking", "startsAt", "endsAt"]);

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function mapWeeklySchedule(value: unknown): SpecialistScheduleDay[] | null {
  if (!Array.isArray(value) || value.length !== 7) return null;

  const weekdays = new Set<number>();
  const schedule: SpecialistScheduleDay[] = [];

  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) return null;

    const day = candidate as Record<string, unknown>;
    if (
      Object.keys(day).length !== scheduleDayKeys.size ||
      Object.keys(day).some((key) => !scheduleDayKeys.has(key)) ||
      !Number.isInteger(day.weekday) ||
      (day.weekday as number) < 1 ||
      (day.weekday as number) > 7 ||
      weekdays.has(day.weekday as number) ||
      typeof day.isWorking !== "boolean" ||
      typeof day.startsAt !== "string" ||
      !timePattern.test(day.startsAt) ||
      typeof day.endsAt !== "string" ||
      !timePattern.test(day.endsAt)
    ) {
      return null;
    }

    const startsAtMinutes = timeToMinutes(day.startsAt);
    const endsAtMinutes = timeToMinutes(day.endsAt);
    if (
      startsAtMinutes % 30 !== 0 ||
      endsAtMinutes % 30 !== 0 ||
      startsAtMinutes >= endsAtMinutes
    ) {
      return null;
    }

    const weekday = day.weekday as number;
    weekdays.add(weekday);
    schedule.push({
      endsAt: day.endsAt,
      isWorking: day.isWorking,
      startsAt: day.startsAt,
      weekday,
    });
  }

  return weekdays.size === 7
    ? schedule.sort((left, right) => left.weekday - right.weekday)
    : null;
}

function parsePayload(value: unknown): SpecialistSchedulePayload | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const payload = value as Record<string, unknown>;
  if (
    Object.keys(payload).length !== payloadKeys.size ||
    Object.keys(payload).some((key) => !payloadKeys.has(key)) ||
    !Number.isInteger(payload.expectedVersion) ||
    (payload.expectedVersion as number) < 1 ||
    typeof payload.specialistId !== "string" ||
    !uuidPattern.test(payload.specialistId)
  ) {
    return null;
  }

  const weeklySchedule = mapWeeklySchedule(payload.weeklySchedule);
  return weeklySchedule
    ? {
        expectedVersion: payload.expectedVersion as number,
        specialistId: payload.specialistId,
        weeklySchedule,
      }
    : null;
}

function mapRpcError(error: { code?: string; message: string }) {
  if (error.code === "42501" || error.message.includes("specialist_schedule_forbidden")) {
    return errorResponse("Forbidden", 403);
  }
  if (error.code === "P0002" || error.message.includes("specialist_not_found")) {
    return errorResponse("Specialist not found.", 404);
  }
  if (error.code === "22023" || error.message.includes("invalid_specialist_schedule")) {
    return errorResponse("Invalid specialist schedule.", 400);
  }
  if (error.code === "40001" || error.message.includes("stale_specialist_schedule")) {
    return errorResponse("График уже изменён в другой сессии. Обновите страницу и повторите.", 409);
  }

  console.error("Admin specialist schedule save failed", error.message);
  return errorResponse("Unable to save specialist schedule.", 500);
}

export async function POST(request: Request): Promise<NextResponse> {
  const client = createSupabaseAdminClient();
  if (!client) return errorResponse("Forbidden", 403);

  const authorization = await authorizeSupabaseAdminAccess(
    client,
    getBearerToken(request.headers.get("authorization")),
    { allowedRoles: ["owner", "administrator"] },
  );
  if (!authorization.ok) {
    return errorResponse(authorization.message, authorization.statusCode);
  }

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return errorResponse("Invalid specialist schedule.", 400);
  }

  const payload = parsePayload(rawPayload);
  if (!payload) return errorResponse("Invalid specialist schedule.", 400);

  const { data, error } = await client.rpc("admin_save_specialist_schedule_v2", {
    p_actor_user_id: authorization.userId,
    p_expected_version: payload.expectedVersion,
    p_specialist_id: payload.specialistId,
    p_weekly_schedule: payload.weeklySchedule,
  }) as unknown as {
    data: SpecialistScheduleRpcData | null;
    error: { code?: string; message: string } | null;
  };

  if (error) return mapRpcError(error);

  const weeklySchedule = mapWeeklySchedule(data?.specialist?.weekly_schedule);
  if (
    typeof data?.specialist?.id !== "string" ||
    !uuidPattern.test(data.specialist.id) ||
    !Number.isInteger(data.specialist.schedule_version) ||
    (data.specialist.schedule_version as number) < 1 ||
    !weeklySchedule ||
    typeof data.working_days !== "string" ||
    typeof data.working_hours !== "string"
  ) {
    console.error("Admin specialist schedule RPC returned an invalid result");
    return errorResponse("Unable to read saved specialist schedule.", 500);
  }

  return NextResponse.json({
    specialist: {
      id: data.specialist.id,
      scheduleVersion: data.specialist.schedule_version,
      weeklySchedule,
    },
    workingDays: data.working_days,
    workingHours: data.working_hours,
  });
}
