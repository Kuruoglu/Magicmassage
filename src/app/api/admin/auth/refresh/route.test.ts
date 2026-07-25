// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeSupabaseAdminAccess } from "@/lib/supabase/admin";
import { adminSessionLifetimeSeconds } from "@/lib/supabase/admin-session-cookie";

import { POST } from "./route";

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>();

  return {
    ...actual,
    authorizeSupabaseAdminAccess: vi.fn(),
    createSupabaseAdminClient: vi.fn(() => ({})),
  };
});

describe("admin session refresh", () => {
  beforeEach(() => {
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValue({
      mode: "supabase",
      ok: true,
      role: "owner",
      userId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("replaces both admin cookies with the refreshed access token for eight hours", async () => {
    const response = await POST(new Request("https://example.com/api/admin/auth/refresh", {
      headers: { authorization: "Bearer refreshed-admin-token" },
      method: "POST",
    }));
    const cookies = response.headers.getSetCookie();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(cookies).toHaveLength(2);
    expect(cookies.every((cookie) =>
      cookie.includes(`Max-Age=${adminSessionLifetimeSeconds}`)
      && cookie.includes("refreshed-admin-token")
    )).toBe(true);
    expect(cookies).toEqual(expect.arrayContaining([
      expect.stringContaining("Path=/admin"),
      expect.stringContaining("Path=/api/media/admin"),
    ]));
  });

  it("does not issue cookies when the refreshed token is not an active MFA admin session", async () => {
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValueOnce({
      message: "Multi-factor authentication required",
      mode: "supabase",
      ok: false,
      statusCode: 401,
    });

    const response = await POST(new Request("https://example.com/api/admin/auth/refresh", {
      headers: { authorization: "Bearer aal1-token" },
      method: "POST",
    }));

    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });
});
