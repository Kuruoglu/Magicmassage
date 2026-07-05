// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { generateGiftCertificatePdf } from "./pdf";
import { sendGiftCertificateEmails } from "./email";
import type { GiftCertificateFulfillmentOrder } from "./types";

const fulfillmentOrder = {
  locale: "en",
  purchaseMode: "gift",
  purchaserName: "Anna Buyer",
  purchaserEmail: "anna@example.com",
  recipientName: "Maria Recipient",
  recipientEmail: "maria@example.com",
  recipientMessage: "A calm hour just for you.",
  deliveryMode: "recipient_email",
  serviceItems: [{ serviceSlug: "classic-massage", sessions: 2 }],
  amountVoucherEur: 150,
  expiresOn: "2027-01-05",
} satisfies GiftCertificateFulfillmentOrder;

describe("gift certificate PDF generation", () => {
  it("generates a PDF containing the certificate code, recipient, expiry, and items", async () => {
    const pdf = await generateGiftCertificatePdf({
      certificateCode: "MMN-GC-20260705-ABC123XY",
      order: fulfillmentOrder,
    });

    expect(Buffer.from(pdf.bytes).subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(pdf.searchableText).toContain("MMN-GC-20260705-ABC123XY");
    expect(pdf.searchableText).toContain("Maria Recipient");
    expect(pdf.searchableText).toContain("2027-01-05");
    expect(pdf.searchableText).toContain("Classic massage x 2");
    expect(pdf.searchableText).toContain("150 EUR");
  });
});

describe("gift certificate email delivery", () => {
  it("fails closed when email delivery is not configured", async () => {
    await expect(
      sendGiftCertificateEmails({
        certificateCode: "MMN-GC-20260705-ABC123XY",
        order: fulfillmentOrder,
        pdf: {
          filename: "MMN-GC-20260705-ABC123XY.pdf",
          bytes: new Uint8Array([1, 2, 3]),
          searchableText: "certificate",
        },
        env: {},
        fetchEmail: vi.fn(),
      }),
    ).rejects.toThrow("Gift certificate email delivery is not configured");
  });

  it("sends buyer and recipient emails for automatic gift delivery", async () => {
    const fetchEmail = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_123" }),
    });

    const result = await sendGiftCertificateEmails({
      certificateCode: "MMN-GC-20260705-ABC123XY",
      order: fulfillmentOrder,
      pdf: {
        filename: "MMN-GC-20260705-ABC123XY.pdf",
        bytes: new Uint8Array([1, 2, 3]),
        searchableText: "certificate",
      },
      env: {
        RESEND_API_KEY: "re_test",
        RESEND_FROM_EMAIL: "Magic Massage Natali <gifts@example.com>",
        GIFT_CERTIFICATES_OWNER_EMAIL: "natali@example.com",
      },
      fetchEmail,
    });

    expect(result).toEqual({
      buyerEmailId: "email_123",
      recipientEmailId: "email_123",
    });
    expect(fetchEmail).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchEmail.mock.calls[0][1].body).to).toEqual([
      "anna@example.com",
      "natali@example.com",
    ]);
    expect(JSON.parse(fetchEmail.mock.calls[1][1].body).to).toEqual([
      "maria@example.com",
    ]);
  });

  it("escapes user-provided values in email HTML", async () => {
    const fetchEmail = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_123" }),
    });

    await sendGiftCertificateEmails({
      certificateCode: "MMN-GC-20260705-ABC123XY",
      order: {
        ...fulfillmentOrder,
        recipientName: "<script>alert(1)</script>",
        recipientMessage: "<b>Enjoy</b>",
        deliveryMode: "buyer_only",
        recipientEmail: undefined,
      },
      pdf: {
        filename: "MMN-GC-20260705-ABC123XY.pdf",
        bytes: new Uint8Array([1, 2, 3]),
        searchableText: "certificate",
      },
      env: {
        RESEND_API_KEY: "re_test",
        RESEND_FROM_EMAIL: "Magic Massage Natali <gifts@example.com>",
      },
      fetchEmail,
    });

    const html = JSON.parse(fetchEmail.mock.calls[0][1].body).html as string;

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<b>Enjoy</b>");
  });
});
