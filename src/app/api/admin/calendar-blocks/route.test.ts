// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, PATCH, POST } from "./route";

const routeMocks = vi.hoisted(() => ({
  authorization: {
    mode: "supabase",
    ok: true,
    role: "owner",
    userId: "11111111-1111-4111-8111-111111111111",
  } as unknown,
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>();

  return {
    ...actual,
    authorizeSupabaseAdminAccess: vi.fn(async () => routeMocks.authorization),
    createSupabaseAdminClient: vi.fn(() => ({ rpc: routeMocks.rpc })),
  };
});

const block = {
  blockDate: "2026-07-20",
  endsAt: "13:00",
  id: "22222222-2222-4222-8222-222222222222",
  internalNote: "Личная встреча",
  kind: "personal",
  startsAt: "12:00",
};

describe("admin calendar blocks API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.authorization = {
      mode: "supabase",
      ok: true,
      role: "owner",
      userId: "11111111-1111-4111-8111-111111111111",
    };
    routeMocks.rpc.mockResolvedValue({
      data: {
        block_date: block.blockDate,
        ends_at: `${block.endsAt}:00`,
        id: block.id,
        internal_note: block.internalNote,
        kind: block.kind,
        starts_at: `${block.startsAt}:00`,
        version: 1,
      },
      error: null,
    });
  });

  it("creates a block through the audited mutation RPC", async () => {
    const response = await POST(new Request("https://example.com/api/admin/calendar-blocks", {
      body: JSON.stringify(block),
      headers: { authorization: "Bearer owner-token" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ block: { ...block, version: 1 } });
    expect(routeMocks.rpc).toHaveBeenCalledWith("admin_mutate_specialist_calendar_block", expect.objectContaining({
      p_action: "upsert",
      p_actor_user_id: "11111111-1111-4111-8111-111111111111",
      p_block_id: block.id,
      p_expected_version: null,
    }));
  });

  it("allows a specialist to mark only a current walk-in interval", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T09:07:00Z"));
    routeMocks.authorization = {
      mode: "supabase",
      ok: true,
      role: "specialist",
      specialistId: "33333333-3333-4333-8333-333333333333",
      userId: "11111111-1111-4111-8111-111111111111",
    };

    try {
      const response = await POST(new Request("https://example.com/api/admin/calendar-blocks", {
        body: JSON.stringify({
          ...block,
          intent: "walk-in",
          internalNote: "Посетитель без записи",
          kind: "other",
        }),
        headers: { authorization: "Bearer specialist-token" },
        method: "POST",
      }));

      expect(response.status).toBe(200);
      expect(routeMocks.rpc).toHaveBeenCalledWith("admin_mutate_specialist_calendar_block", expect.objectContaining({
        p_action: "upsert",
        p_specialist_id: "33333333-3333-4333-8333-333333333333",
      }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects arbitrary calendar-block management for a specialist", async () => {
    routeMocks.authorization = {
      mode: "supabase",
      ok: true,
      role: "specialist",
      specialistId: "33333333-3333-4333-8333-333333333333",
      userId: "11111111-1111-4111-8111-111111111111",
    };

    const createResponse = await POST(new Request("https://example.com/api/admin/calendar-blocks", {
      body: JSON.stringify(block),
      headers: { authorization: "Bearer specialist-token" },
      method: "POST",
    }));
    const editResponse = await PATCH(new Request("https://example.com/api/admin/calendar-blocks", {
      body: JSON.stringify({ ...block, version: 1 }),
      headers: { authorization: "Bearer specialist-token" },
      method: "PATCH",
    }));
    const deleteResponse = await DELETE(new Request("https://example.com/api/admin/calendar-blocks", {
      body: JSON.stringify({ id: block.id, version: 1 }),
      headers: { authorization: "Bearer specialist-token" },
      method: "DELETE",
    }));

    expect(createResponse.status).toBe(403);
    expect(editResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });

  it("requires an id when editing a block", async () => {
    const payload = {
      blockDate: block.blockDate,
      endsAt: block.endsAt,
      internalNote: block.internalNote,
      kind: block.kind,
      startsAt: block.startsAt,
      version: 1,
    };
    const response = await PATCH(new Request("https://example.com/api/admin/calendar-blocks", {
      body: JSON.stringify(payload),
      headers: { authorization: "Bearer owner-token" },
      method: "PATCH",
    }));

    expect(response.status).toBe(400);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });

  it("returns a conflict when a block overlaps an appointment", async () => {
    routeMocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "23P01", message: "calendar_block_conflict" },
    });
    const response = await POST(new Request("https://example.com/api/admin/calendar-blocks", {
      body: JSON.stringify(block),
      headers: { authorization: "Bearer owner-token" },
      method: "POST",
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Это время пересекается с записью клиента или другой блокировкой. Сначала перенесите запись или измените интервал.",
    });
  });

  it("deletes a block through the same audited mutation RPC", async () => {
    routeMocks.rpc.mockResolvedValue({ data: { deleted: true, id: block.id }, error: null });
    const response = await DELETE(new Request("https://example.com/api/admin/calendar-blocks", {
      body: JSON.stringify({ id: block.id, version: 1 }),
      headers: { authorization: "Bearer owner-token" },
      method: "DELETE",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });
    expect(routeMocks.rpc).toHaveBeenCalledWith("admin_mutate_specialist_calendar_block", expect.objectContaining({
      p_action: "delete",
      p_block_id: block.id,
      p_expected_version: 1,
    }));
  });

  it("maps a stale block version to a conflict", async () => {
    routeMocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "40001", message: "calendar_block_concurrent_update" },
    });
    const response = await PATCH(new Request("https://example.com/api/admin/calendar-blocks", {
      body: JSON.stringify({ ...block, version: 1 }),
      headers: { authorization: "Bearer owner-token" },
      method: "PATCH",
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Недоступное время уже изменено. Обновите страницу и повторите действие.",
    });
  });
});
