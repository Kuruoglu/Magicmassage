import type { GiftCertificatePdf } from "./pdf";
import { getGiftCertificateEmailConfig } from "./email-config";
import type {
  GiftCertificateEmailEnvironment,
  GiftCertificateFulfillmentOrder,
} from "./types";

type SendGiftCertificateEmailsInput = {
  certificateCode: string;
  order: GiftCertificateFulfillmentOrder;
  pdf: GiftCertificatePdf;
  env?: GiftCertificateEmailEnvironment;
  fetchEmail?: typeof fetch;
};

export type GiftCertificateEmailResult = {
  buyerEmailId: string | null;
  recipientEmailId: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtml(title: string, lines: string[]): string {
  return [
    `<h1>${escapeHtml(title)}</h1>`,
    ...lines.filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`),
    "<p>Magic Massage Natali</p>",
  ].join("");
}

async function sendResendEmail({
  apiKey,
  from,
  to,
  subject,
  html,
  pdf,
  fetchEmail,
}: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  pdf: GiftCertificatePdf;
  fetchEmail: typeof fetch;
}): Promise<string> {
  const response = await fetchEmail("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      attachments: [
        {
          filename: pdf.filename,
          content: Buffer.from(pdf.bytes).toString("base64"),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("Email delivery failed.");
  }

  const body = (await response.json()) as { id?: string };

  return body.id ?? "resend_email";
}

export async function sendGiftCertificateEmails({
  certificateCode,
  order,
  pdf,
  env = process.env as GiftCertificateEmailEnvironment,
  fetchEmail = fetch,
}: SendGiftCertificateEmailsInput): Promise<GiftCertificateEmailResult> {
  const buyerEmailId = await sendGiftCertificateBuyerEmail({
    certificateCode,
    order,
    pdf,
    env,
    fetchEmail,
  });
  const recipientEmailId = await sendGiftCertificateRecipientEmail({
    certificateCode,
    order,
    pdf,
    env,
    fetchEmail,
  });

  return { buyerEmailId, recipientEmailId };
}

export async function sendGiftCertificateBuyerEmail({
  certificateCode,
  order,
  pdf,
  env = process.env as GiftCertificateEmailEnvironment,
  fetchEmail = fetch,
}: SendGiftCertificateEmailsInput): Promise<string> {
  const config = getGiftCertificateEmailConfig(env);
  const buyerRecipients = [
    order.purchaserEmail,
    ...(config.ownerEmail ? [config.ownerEmail] : []),
  ];

  return sendResendEmail({
    apiKey: config.apiKey,
    from: config.from,
    to: buyerRecipients,
    subject: `Gift certificate ${certificateCode}`,
    html: buildHtml("Gift certificate purchase", [
      `Certificate: ${certificateCode}`,
      `Recipient: ${order.recipientName}`,
      `Valid until: ${order.expiresOn}`,
    ]),
    pdf,
    fetchEmail,
  });
}

export async function sendGiftCertificateRecipientEmail({
  certificateCode,
  order,
  pdf,
  env = process.env as GiftCertificateEmailEnvironment,
  fetchEmail = fetch,
}: SendGiftCertificateEmailsInput): Promise<string | null> {
  const config = getGiftCertificateEmailConfig(env);

  if (order.deliveryMode === "recipient_email" && order.recipientEmail) {
    return sendResendEmail({
      apiKey: config.apiKey,
      from: config.from,
      to: [order.recipientEmail],
      subject: "Your Magic Massage Natali gift certificate",
      html: buildHtml("You received a gift certificate", [
        `Certificate: ${certificateCode}`,
        order.recipientMessage ?? "",
        `Valid until: ${order.expiresOn}`,
      ]),
      pdf,
      fetchEmail,
    });
  }

  return null;
}
