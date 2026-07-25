import { createHmac, timingSafeEqual } from "node:crypto";

const acceptedEvents = new Set([
  "sent", "delivered", "delivery_delayed", "failed", "bounced", "suppressed", "complained",
]);

function webhookKey(secret: string) {
  const encoded = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  try {
    return Buffer.from(encoded, "base64");
  } catch {
    return Buffer.from(encoded, "utf8");
  }
}

export function verifyResendWebhook(input: {
  body: string;
  id: string | null;
  now?: number;
  secret: string;
  signature: string | null;
  timestamp: string | null;
}) {
  if (!input.id || !input.signature || !input.timestamp || !/^\d+$/.test(input.timestamp)) return false;
  const timestamp = Number(input.timestamp);
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 5 * 60) return false;

  const expected = createHmac("sha256", webhookKey(input.secret))
    .update(`${input.id}.${input.timestamp}.${input.body}`)
    .digest("base64");

  return input.signature.split(" ").some((candidate) => {
    const [version, encoded] = candidate.split(",", 2);
    if (version !== "v1" || !encoded) return false;
    const actualBuffer = Buffer.from(encoded);
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  });
}

export type ParsedResendWebhook = {
  eventType: string;
  messageId: string;
  occurredAt: string | null;
  recipientEmail: string | null;
};

export function parseResendWebhook(body: string): ParsedResendWebhook | null {
  try {
    const parsed = JSON.parse(body) as {
      created_at?: unknown;
      data?: { email_id?: unknown; to?: unknown };
      type?: unknown;
    };
    const eventType = typeof parsed.type === "string" ? parsed.type.replace(/^email\./, "") : "";
    const messageId = parsed.data && typeof parsed.data.email_id === "string" ? parsed.data.email_id : "";
    if (!acceptedEvents.has(eventType) || !messageId) return null;
    const recipients = parsed.data?.to;
    const recipientEmail = Array.isArray(recipients) && typeof recipients[0] === "string"
      ? recipients[0].trim().toLowerCase()
      : null;

    return {
      eventType,
      messageId,
      occurredAt: typeof parsed.created_at === "string" ? parsed.created_at : null,
      recipientEmail,
    };
  } catch {
    return null;
  }
}
