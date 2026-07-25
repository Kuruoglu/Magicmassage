// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeSupabaseAdminAccess } from "@/lib/supabase/admin";
import { adminSessionLifetimeSeconds } from "@/lib/supabase/admin-session-cookie";

import { POST } from "./route";

const rpc = vi.fn(async () => ({ data: null, error: null }));

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>();

  return {
    ...actual,
    authorizeSupabaseAdminAccess: vi.fn(),
    createSupabaseAdminClient: vi.fn(() => ({ rpc })),
  };
});

describe("admin session cookie", () => {
  beforeEach(() => {
    rpc.mockClear();
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValue({
      mode: "supabase",
      ok: true,
      role: "editor",
      userId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("scopes authenticated cookies to the admin UI and private media proxy", async () => {
    const response = await POST(new Request("https://example.com/api/admin/auth/session", {
      headers: { authorization: "Bearer admin-token" },
      method: "POST",
    }));
    const cookies = response.headers.getSetCookie();

    expect(response.status).toBe(200);
    expect(cookies).toHaveLength(2);
    expect(cookies).toEqual(expect.arrayContaining([
      expect.stringContaining("Path=/admin"),
      expect.stringContaining("Path=/api/media/admin"),
    ]));
    expect(cookies.every((cookie) =>
      cookie.includes(`Max-Age=${adminSessionLifetimeSeconds}`)
    )).toBe(true);
    expect(cookies.every((cookie) => cookie.includes("HttpOnly") && /SameSite=Lax/i.test(cookie))).toBe(true);
    expect(cookies.some((cookie) => /Path=\/(?:;|$)/.test(cookie))).toBe(false);
    expect(rpc).toHaveBeenCalledWith("admin_mark_login", {
      p_actor_user_id: "11111111-1111-4111-8111-111111111111",
    });
  });
});
