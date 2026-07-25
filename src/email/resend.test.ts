import { describe, expect, it, vi } from "vitest";

import { EmailSendError, sendEmailWithResend } from "./resend";

const input = {
  attachments: [{ content: "cGRm", filename: "certificate.pdf" }],
  from: "Magic <mail@example.com>",
  html: "<p>Hello</p>",
  idempotencyKey: "email-notification/111",
  replyTo: "studio@example.com",
  subject: "Subject",
  text: "Hello",
  to: "client@example.com",
};

describe("Resend transport", () => {
  it("sends a stable idempotency key and optional attachment", async () => {
    const fetchEmail = vi.fn<typeof fetch>(async () => (
      new Response(JSON.stringify({ id: "email-1" }), { status: 200 })
    ));

    await expect(sendEmailWithResend(input, "api-key", fetchEmail)).resolves.toBe("email-1");
    expect(fetchEmail.mock.calls[0][1]?.headers).toMatchObject({
      "Idempotency-Key": "email-notification/111",
    });
    expect(JSON.parse(String(fetchEmail.mock.calls[0][1]?.body))).toMatchObject({
      attachments: input.attachments,
      reply_to: "studio@example.com",
    });
  });

  it("classifies rate limits as retryable and validation failures as terminal", async () => {
    await expect(sendEmailWithResend(input, "key", vi.fn<typeof fetch>(async () => new Response("{}", { status: 429 }))))
      .rejects.toMatchObject({ retryable: true } satisfies Partial<EmailSendError>);
    await expect(sendEmailWithResend(input, "key", vi.fn<typeof fetch>(async () => new Response("{}", { status: 422 }))))
      .rejects.toMatchObject({ retryable: false } satisfies Partial<EmailSendError>);
  });

  it("retries only the concurrent Resend idempotency conflict", async () => {
    const conflict = (name: string) => vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ name }), { status: 409 }));
    await expect(sendEmailWithResend(input, "key", conflict("concurrent_idempotent_requests")))
      .rejects.toMatchObject({ retryable: true } satisfies Partial<EmailSendError>);
    await expect(sendEmailWithResend(input, "key", conflict("invalid_idempotent_request")))
      .rejects.toMatchObject({ retryable: false } satisfies Partial<EmailSendError>);
  });
});
