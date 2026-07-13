// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { runAdminUserAction } from "@/admin/admin-user-actions";

import { POST } from "./route";

const invitePayload = {
  action: "invite",
  user: {
    accessNote: "Tax exports only.",
    email: "accountant@example.com",
    name: "Accountant Example",
    role: "accountant",
  },
} as const;

vi.mock("@/admin/admin-user-actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/admin/admin-user-actions")>();

  return {
    ...actual,
    runAdminUserAction: vi.fn(async () => ({
      message: "Admin user invitation saved in Supabase.",
      mode: "supabase",
      ok: true,
      userId: "00000000-0000-0000-0000-000000000002",
    })),
  };
});

describe("admin users API route", () => {
  it("runs valid admin user invite actions", async () => {
    const response = await POST(
      new Request("https://example.com/api/admin/users", {
        body: JSON.stringify(invitePayload),
        headers: {
          authorization: "Bearer owner-token",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Admin user invitation saved in Supabase.",
      mode: "supabase",
      ok: true,
      userId: "00000000-0000-0000-0000-000000000002",
    });
    expect(runAdminUserAction).toHaveBeenCalledWith(invitePayload, { actorToken: "owner-token" });
  });

  it("rejects invalid admin user payloads", async () => {
    const response = await POST(
      new Request("https://example.com/api/admin/users", {
        body: JSON.stringify({
          action: "updateProfile",
          user: {
            email: "viewer@example.com",
            id: "local-demo-id",
            name: "Viewer Example",
            role: "viewer",
          },
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid admin user payload." });
  });

  it("returns server errors for Supabase Auth write failures", async () => {
    vi.mocked(runAdminUserAction).mockResolvedValueOnce({
      message: "Admin user action failed.",
      mode: "supabase",
      ok: false,
    });

    const response = await POST(
      new Request("https://example.com/api/admin/users", {
        body: JSON.stringify(invitePayload),
        headers: {
          authorization: "Bearer owner-token",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: "Admin user action failed.",
      mode: "supabase",
      ok: false,
    });
  });

  it("returns unauthorized responses for missing owner authentication", async () => {
    vi.mocked(runAdminUserAction).mockResolvedValueOnce({
      message: "Admin user action requires an authenticated owner.",
      mode: "supabase",
      ok: false,
      statusCode: 401,
    });

    const response = await POST(
      new Request("https://example.com/api/admin/users", {
        body: JSON.stringify(invitePayload),
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      message: "Admin user action requires an authenticated owner.",
      mode: "supabase",
      ok: false,
      statusCode: 401,
    });
    expect(runAdminUserAction).toHaveBeenCalledWith(invitePayload, { actorToken: undefined });
  });
});
