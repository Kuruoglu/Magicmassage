// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyEmailPreferenceToken } from "@/email/preferences-token";
import { POST } from "./route";

const rpc = vi.fn();

vi.mock("@/email/preferences-token", () => ({
  verifyEmailPreferenceToken: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({ rpc })),
}));

describe("care email unsubscribe API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockReset();
    vi.mocked(verifyEmailPreferenceToken).mockReturnValue({
      notificationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });

  it("withdraws consent only after an explicit POST", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const response = await POST(new Request("https://example.com/api/public/email-preferences/unsubscribe", {
      body: JSON.stringify({ token: "signed-token" }),
      headers: { "content-type": "application/json", origin: "https://example.com" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("email_unsubscribe_care_by_notification", {
      p_notification_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });

  it("does not touch the database for an invalid token", async () => {
    vi.mocked(verifyEmailPreferenceToken).mockReturnValue(null);
    const response = await POST(new Request("https://example.com/api/public/email-preferences/unsubscribe", {
      body: JSON.stringify({ token: "invalid" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin mutation", async () => {
    const response = await POST(new Request("https://example.com/api/public/email-preferences/unsubscribe", {
      body: JSON.stringify({ token: "signed-token" }),
      headers: { "content-type": "application/json", origin: "https://attacker.example" },
      method: "POST",
    }));

    expect(response.status).toBe(403);
    expect(verifyEmailPreferenceToken).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
