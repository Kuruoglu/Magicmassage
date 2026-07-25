// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeSupabaseAdminAccess } from "@/lib/supabase/admin";
import { GET } from "./route";

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>();
  return {
    ...actual,
    authorizeSupabaseAdminAccess: vi.fn(),
    createSupabaseAdminClient: vi.fn(() => ({})),
  };
});

describe("admin email template preview API", () => {
  beforeEach(() => {
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValue({
      mode: "supabase",
      ok: true,
      role: "owner",
      userId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("returns a no-store preview rendered by the versioned template path", async () => {
    const response = await GET(new Request(
      "https://example.com/api/admin/email-template-preview?eventType=gift_recipient&locale=bg",
      { headers: { authorization: "Bearer aal2-token" } },
    ));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(result.preview).toMatchObject({ templateVersion: 1 });
    expect(result.preview.subject).toContain("Magic Massage Natali");
    expect(result.preview.text).toContain("GIFT-EXAMPLE");
    expect(result.preview.html).toContain('<html lang="bg">');
  });

  it("rejects unsupported events and locales", async () => {
    const response = await GET(new Request(
      "https://example.com/api/admin/email-template-preview?eventType=marketing&locale=de",
    ));

    expect(response.status).toBe(400);
  });

  it("keeps previews unavailable to specialists", async () => {
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValue({
      message: "Forbidden",
      mode: "supabase",
      ok: false,
      statusCode: 403,
    });

    const response = await GET(new Request(
      "https://example.com/api/admin/email-template-preview?eventType=booking_confirmed&locale=ru",
    ));

    expect(response.status).toBe(403);
  });
});
