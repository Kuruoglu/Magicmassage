// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeSupabaseAdminAccess } from "@/lib/supabase/admin";

import { POST } from "./route";

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>();

  return {
    ...actual,
    authorizeSupabaseAdminAccess: vi.fn(),
    createSupabaseAdminClient: vi.fn(() => ({})),
  };
});

describe("admin session cookie", () => {
  beforeEach(() => {
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
    expect(cookies.every((cookie) => cookie.includes("HttpOnly") && /SameSite=Lax/i.test(cookie))).toBe(true);
    expect(cookies.some((cookie) => /Path=\/(?:;|$)/.test(cookie))).toBe(false);
  });
});
