// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeSupabaseAdminAccess } from "@/lib/supabase/admin";
import { GET, PATCH } from "./route";

const rpc = vi.fn();

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>();
  return {
    ...actual,
    authorizeSupabaseAdminAccess: vi.fn(),
    createSupabaseAdminClient: vi.fn(() => ({ rpc })),
  };
});

describe("admin security alerts API", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValue({
      mode: "supabase",
      ok: true,
      role: "owner",
      userId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("returns only normalized non-PII alert fields", async () => {
    rpc.mockResolvedValue({
      data: [{
        actor_name: "Yana",
        alert_type: "bulk_contact_reveal",
        created_at: "2026-07-16T12:00:00Z",
        event_count: 20,
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        metadata: { email: "must-not-leak@example.com" },
        resolved_at: null,
        severity: "warning",
      }],
      error: null,
    });

    const response = await GET(new Request("https://example.com/api/admin/security-alerts", {
      headers: { authorization: "Bearer aal2-token" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      alerts: [{
        actorName: "Yana",
        alertType: "bulk_contact_reveal",
        createdAt: "2026-07-16T12:00:00Z",
        eventCount: 20,
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        severity: "warning",
      }],
    });
    expect(rpc).toHaveBeenCalledWith("admin_list_security_alerts", {});
  });

  it("resolves an alert through the audited RPC", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    const response = await PATCH(new Request("https://example.com/api/admin/security-alerts", {
      body: JSON.stringify({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
      headers: { authorization: "Bearer aal2-token", "content-type": "application/json" },
      method: "PATCH",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("admin_resolve_security_alert", {
      p_actor_user_id: "11111111-1111-4111-8111-111111111111",
      p_alert_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });

  it("keeps alerts restricted to owners and administrators", async () => {
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValue({
      message: "Forbidden",
      mode: "supabase",
      ok: false,
      statusCode: 403,
    });

    const response = await GET(new Request("https://example.com/api/admin/security-alerts", {
      headers: { authorization: "Bearer specialist-token" },
    }));

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
});
