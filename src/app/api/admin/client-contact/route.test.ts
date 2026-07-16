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

describe("admin appointment contact reveal", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValue({
      mode: "supabase",
      ok: true,
      role: "specialist",
      specialistId: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("returns contact data only through the audited RPC", async () => {
    rpc.mockResolvedValue({
      data: { email: "client@example.com", phone: "+359871234567", preferredContact: "phone" },
      error: null,
    });
    const response = await POST(new Request("https://example.com/api/admin/client-contact", {
      body: JSON.stringify({ appointmentId: "appointment-public-1", purpose: "Связаться по текущей записи" }),
      headers: { authorization: "Bearer aal2-token", "content-type": "application/json" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      contact: { email: "client@example.com", phone: "+359871234567", preferredContact: "phone" },
    });
    expect(rpc).toHaveBeenCalledWith("admin_reveal_appointment_contact", {
      p_actor_user_id: "11111111-1111-4111-8111-111111111111",
      p_appointment_id: "appointment-public-1",
      p_purpose: "Связаться по текущей записи",
    });
  });

  it("does not return contact data when assignment validation fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "contact_reveal_forbidden" } });
    const response = await POST(new Request("https://example.com/api/admin/client-contact", {
      body: JSON.stringify({ appointmentId: "appointment-public-1", purpose: "Связаться по записи" }),
      headers: { authorization: "Bearer aal2-token", "content-type": "application/json" },
      method: "POST",
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });
});
