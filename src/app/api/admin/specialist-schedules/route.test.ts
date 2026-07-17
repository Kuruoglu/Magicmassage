// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeSupabaseAdminAccess } from "@/lib/supabase/admin";
import { POST } from "./route";

const rpc = vi.fn();

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>();
  return {
    ...actual,
    authorizeSupabaseAdminAccess: vi.fn(),
    createSupabaseAdminClient: vi.fn(() => ({ rpc })),
  };
});

const specialistId = "22222222-2222-4222-8222-222222222222";
const actorUserId = "11111111-1111-4111-8111-111111111111";
const weeklySchedule = Array.from({ length: 7 }, (_, index) => ({
  endsAt: index === 5 ? "17:00" : "19:00",
  isWorking: index < 6,
  startsAt: index === 5 ? "10:00" : "09:30",
  weekday: index + 1,
}));

function createRequest(body: unknown) {
  return new Request("https://example.com/api/admin/specialist-schedules", {
    body: JSON.stringify(body),
    headers: {
      authorization: "Bearer aal2-token",
      "content-type": "application/json",
    },
    method: "POST",
  });
}

describe("admin specialist schedules API", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValue({
      mode: "supabase",
      ok: true,
      role: "owner",
      userId: actorUserId,
    });
  });

  it("saves and maps a complete weekly schedule through the audited RPC", async () => {
    rpc.mockResolvedValue({
      data: {
        specialist: {
          id: specialistId,
          schedule_version: 4,
          weekly_schedule: [...weeklySchedule].reverse(),
        },
        working_days: "Mon,Tue,Wed,Thu,Fri,Sat",
        working_hours: "09:30-19:00",
      },
      error: null,
    });

    const response = await POST(createRequest({ expectedVersion: 3, specialistId, weeklySchedule }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      specialist: { id: specialistId, scheduleVersion: 4, weeklySchedule },
      workingDays: "Mon,Tue,Wed,Thu,Fri,Sat",
      workingHours: "09:30-19:00",
    });
    expect(authorizeSupabaseAdminAccess).toHaveBeenCalledWith(
      expect.anything(),
      "aal2-token",
      { allowedRoles: ["owner", "administrator"] },
    );
    expect(rpc).toHaveBeenCalledWith("admin_save_specialist_schedule_v2", {
      p_actor_user_id: actorUserId,
      p_expected_version: 3,
      p_specialist_id: specialistId,
      p_weekly_schedule: weeklySchedule,
    });
  });

  it("denies roles outside owner and administrator before calling the RPC", async () => {
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValue({
      message: "Forbidden",
      mode: "supabase",
      ok: false,
      statusCode: 403,
    });

    const response = await POST(createRequest({ expectedVersion: 3, specialistId, weeklySchedule }));

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid version", { expectedVersion: 0, specialistId, weeklySchedule }],
    ["invalid UUID", { specialistId: "not-a-uuid", weeklySchedule }],
    ["missing weekday", { specialistId, weeklySchedule: weeklySchedule.slice(0, 6) }],
    ["duplicate weekday", {
      specialistId,
      weeklySchedule: weeklySchedule.map((day, index) => index === 6 ? { ...day, weekday: 6 } : day),
    }],
    ["quarter-hour time", {
      specialistId,
      weeklySchedule: weeklySchedule.map((day, index) => index === 0 ? { ...day, startsAt: "09:15" } : day),
    }],
    ["non-increasing hours", {
      specialistId,
      weeklySchedule: weeklySchedule.map((day, index) => index === 0 ? { ...day, endsAt: day.startsAt } : day),
    }],
    ["unexpected key", { specialistId, weeklySchedule, unexpected: true }],
  ])("rejects %s", async (_label, body) => {
    const response = await POST(createRequest({ expectedVersion: 3, ...body }));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps a missing specialist without exposing database details", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "specialist_not_found: internal context" },
    });

    const response = await POST(createRequest({ expectedVersion: 3, specialistId, weeklySchedule }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Specialist not found." });
  });

  it("returns a conflict for a stale complete-schedule update", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "stale_specialist_schedule" },
    });

    const response = await POST(createRequest({ expectedVersion: 2, specialistId, weeklySchedule }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "График уже изменён в другой сессии. Обновите страницу и повторите.",
    });
  });
});
