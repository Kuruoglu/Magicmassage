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

describe("admin email notification retry API", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValue({
      mode: "supabase",
      ok: true,
      role: "administrator",
      userId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("requeues through the audited database RPC", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const response = await POST(new Request("https://example.com/api/admin/email-notifications/retry", {
      body: JSON.stringify({ notificationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
      headers: { authorization: "Bearer aal2-token", "content-type": "application/json" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("admin_retry_email_notification", {
      p_actor_user_id: "11111111-1111-4111-8111-111111111111",
      p_corrected_email: null,
      p_notification_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });

  it("normalizes a corrected public-booking address inside the audited retry", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const response = await POST(new Request("https://example.com/api/admin/email-notifications/retry", {
      body: JSON.stringify({
        correctedEmail: " Corrected.Client@Example.com ",
        notificationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
      headers: { authorization: "Bearer aal2-token", "content-type": "application/json" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("admin_retry_email_notification", {
      p_actor_user_id: "11111111-1111-4111-8111-111111111111",
      p_corrected_email: "corrected.client@example.com",
      p_notification_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });

  it("rejects an invalid corrected address before the database call", async () => {
    const response = await POST(new Request("https://example.com/api/admin/email-notifications/retry", {
      body: JSON.stringify({
        correctedEmail: "not-an-email",
        notificationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
      headers: { authorization: "Bearer aal2-token", "content-type": "application/json" },
      method: "POST",
    }));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not expose corrected-recipient retry to specialists", async () => {
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValue({
      message: "Forbidden",
      mode: "supabase",
      ok: false,
      statusCode: 403,
    });
    const response = await POST(new Request("https://example.com/api/admin/email-notifications/retry", {
      body: JSON.stringify({
        correctedEmail: "corrected@example.com",
        notificationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
      headers: { authorization: "Bearer specialist-token", "content-type": "application/json" },
      method: "POST",
    }));

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
    expect(authorizeSupabaseAdminAccess).toHaveBeenCalledWith(
      expect.anything(),
      "specialist-token",
      { allowedRoles: ["owner", "administrator"] },
    );
  });
});
