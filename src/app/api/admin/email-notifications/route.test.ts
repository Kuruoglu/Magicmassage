// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeSupabaseAdminAccess } from "@/lib/supabase/admin";
import { GET } from "./route";

const rpc = vi.fn();

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>();
  return {
    ...actual,
    authorizeSupabaseAdminAccess: vi.fn(),
    createSupabaseAdminClient: vi.fn(() => ({ rpc })),
  };
});

describe("admin email notification API", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValue({
      mode: "supabase",
      ok: true,
      role: "owner",
      userId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("returns a masked, bounded delivery projection", async () => {
    rpc.mockResolvedValue({
      data: [{
        event_type: "booking_confirmation",
        can_clear_suppression: false,
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        payload: { clientNote: "must-not-leak" },
        recipient_email: "natali@example.com",
        status: "delivered",
        updated_at: "2026-07-19T12:00:00Z",
      }],
      error: null,
    });

    const response = await GET(new Request(
      "https://example.com/api/admin/email-notifications?aggregateType=appointment&aggregateId=apt-1",
      { headers: { authorization: "Bearer aal2-token" } },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      notifications: [{
        canClearSuppression: false,
        canRetry: false,
        eventType: "booking_confirmation",
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        recipientMasked: "na****@example.com",
        status: "delivered",
        updatedAt: "2026-07-19T12:00:00Z",
      }],
    });
    expect(rpc).toHaveBeenCalledWith("admin_list_email_notifications", {
      p_aggregate_id: "apt-1",
      p_aggregate_type: "appointment",
    });
  });

  it("keeps delivery data away from specialists", async () => {
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValue({
      message: "Forbidden",
      mode: "supabase",
      ok: false,
      statusCode: 403,
    });

    const response = await GET(new Request(
      "https://example.com/api/admin/email-notifications?aggregateType=appointment&aggregateId=apt-1",
    ));

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
});
