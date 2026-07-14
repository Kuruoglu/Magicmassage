// @vitest-environment node

import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("admin logout cookie", () => {
  it("expires both path-scoped admin token cookies", async () => {
    const response = await POST();
    const cookies = response.headers.getSetCookie();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(cookies).toHaveLength(2);
    expect(cookies).toEqual(expect.arrayContaining([
      expect.stringMatching(/Path=\/admin(?:;|$)/),
      expect.stringMatching(/Path=\/api\/media\/admin(?:;|$)/),
    ]));
    expect(cookies.every((cookie) => /Max-Age=0/i.test(cookie) && /Expires=/i.test(cookie))).toBe(true);
    expect(cookies.every((cookie) => cookie.includes("HttpOnly") && /SameSite=Lax/i.test(cookie))).toBe(true);
    expect(cookies.some((cookie) => /Path=\/(?:;|$)/.test(cookie))).toBe(false);
  });
});
