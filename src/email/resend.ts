import type { RenderedEmail } from "./types";

export class EmailSendError extends Error {
  constructor(message: string, public readonly retryable: boolean, public readonly status?: number) {
    super(message);
    this.name = "EmailSendError";
  }
}

type SendEmailInput = RenderedEmail & {
  attachments?: Array<{ content: string; filename: string }>;
  from: string;
  idempotencyKey: string;
  replyTo?: string;
  to: string;
};

export async function sendEmailWithResend(
  input: SendEmailInput,
  apiKey: string,
  fetchEmail: typeof fetch = fetch,
) {
  let response: Response;
  try {
    response = await fetchEmail("https://api.resend.com/emails", {
      body: JSON.stringify({
        attachments: input.attachments,
        from: input.from,
        html: input.html,
        reply_to: input.replyTo,
        subject: input.subject,
        text: input.text,
        to: [input.to],
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new EmailSendError("resend_network_error", true);
  }

  const body = await response.json().catch(() => ({})) as { id?: unknown; message?: unknown; name?: unknown };
  if (!response.ok) {
    const retryable = response.status === 408
      || response.status === 429
      || response.status >= 500
      || (response.status === 409 && body.name === "concurrent_idempotent_requests");
    throw new EmailSendError(
      typeof body.message === "string" ? body.message.slice(0, 500) : `resend_http_${response.status}`,
      retryable,
      response.status,
    );
  }

  if (typeof body.id !== "string" || !body.id) throw new EmailSendError("resend_invalid_response", true);
  return body.id;
}
