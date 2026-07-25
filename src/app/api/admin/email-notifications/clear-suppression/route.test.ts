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

describe("admin email suppression release API", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValue({
      mode: "supabase",
      ok: true,
      role: "owner",
      userId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("releases a suppression only through the audited RPC", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const response = await POST(new Request("https://example.com/api/admin/email-notifications/clear-suppression", {
      body: JSON.stringify({ notificationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
      headers: { authorization: "Bearer aal2-token", "content-type": "application/json" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("admin_clear_email_suppression_by_notification", {
      p_actor_user_id: "11111111-1111-4111-8111-111111111111",
      p_notification_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });
});
