// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { persistAdminRecord } from "@/admin/persistence";

import { POST } from "./route";

const clientPayload = {
  record: {
    email: "irina@example.com",
    history: [],
    id: "client-1",
    language: "bg",
    name: "Irina Test",
    next: "Not scheduled",
    note: "Prefers daytime slots.",
    phone: "+359 88 777 1122",
    preferredContact: "Telegram",
    status: "New client",
    tags: ["BG", "new"],
    telegram: "https://t.me/irina_demo",
    totalSpend: "0 EUR",
    visits: 0,
  },
  type: "client",
} as const;

vi.mock("@/admin/persistence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/admin/persistence")>();

  return {
    ...actual,
    persistAdminRecord: vi.fn(async () => ({ mode: "supabase", ok: true })),
  };
});

describe("admin records persistence API route", () => {
  it("persists valid admin record payloads", async () => {
    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(clientPayload),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ mode: "supabase", ok: true });
    expect(persistAdminRecord).toHaveBeenCalledWith(clientPayload);
  });

  it("rejects invalid admin record payloads", async () => {
    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify({ record: null, type: "client" }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid admin record payload." });
  });

  it("returns server errors for Supabase write failures", async () => {
    vi.mocked(persistAdminRecord).mockResolvedValueOnce({
      message: "admin_clients: permission denied",
      mode: "supabase",
      ok: false,
    });

    const response = await POST(
      new Request("https://example.com/api/admin/records", {
        body: JSON.stringify(clientPayload),
        method: "POST",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: "admin_clients: permission denied",
      mode: "supabase",
      ok: false,
    });
  });
});
