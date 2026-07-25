// @vitest-environment node

import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const rpc = vi.hoisted(() => vi.fn(async () => ({ data: true, error: null })));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn(() => ({ rpc })) }));

function request(body: string, valid = true) {
  const secretBytes = Buffer.from("webhook-secret");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const id = "svix-event-1";
  const signature = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${body}`).digest("base64");
  return new Request("https://example.com/api/webhooks/resend", {
    body,
    headers: {
      "svix-id": id,
      "svix-signature": valid ? `v1,${signature}` : "v1,invalid",
      "svix-timestamp": timestamp,
    },
    method: "POST",
  });
}

describe("Resend webhook route", () => {
  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = `whsec_${Buffer.from("webhook-secret").toString("base64")}`;
    vi.clearAllMocks();
  });

  it("rejects an invalid raw-body signature", async () => {
    expect((await POST(request("{}", false))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("persists accepted events by svix id so duplicates are idempotent in SQL", async () => {
    const body = JSON.stringify({
      created_at: new Date().toISOString(),
      data: { email_id: "email-1", to: ["client@example.com"] },
      type: "email.delivered",
    });
    expect((await POST(request(body))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("email_record_webhook_event", expect.objectContaining({
      p_event_id: "svix-event-1",
      p_event_type: "delivered",
      p_provider_message_id: "email-1",
    }));
  });
});
