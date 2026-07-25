import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseResendWebhook, verifyResendWebhook } from "./webhook";

describe("Resend webhook verification", () => {
  it("verifies the raw request body and parses accepted delivery events", () => {
    const body = JSON.stringify({ data: { email_id: "email-1", to: ["CLIENT@example.com"] }, type: "email.delivered" });
    const id = "msg_1";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const secretBytes = Buffer.from("webhook-secret");
    const secret = `whsec_${secretBytes.toString("base64")}`;
    const signature = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${body}`).digest("base64");

    expect(verifyResendWebhook({ body, id, secret, signature: `v1,${signature}`, timestamp })).toBe(true);
    expect(parseResendWebhook(body)).toMatchObject({
      eventType: "delivered",
      messageId: "email-1",
      recipientEmail: "client@example.com",
    });
  });

  it("rejects stale signatures and ignores open/click tracking", () => {
    expect(verifyResendWebhook({
      body: "{}", id: "id", now: 1_000, secret: "secret", signature: "v1,bad", timestamp: "1",
    })).toBe(false);
    expect(parseResendWebhook(JSON.stringify({ data: { email_id: "email-1" }, type: "email.opened" }))).toBeNull();
  });
});
