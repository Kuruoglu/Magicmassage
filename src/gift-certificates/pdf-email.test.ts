// @vitest-environment node

import { describe, expect, it } from "vitest";

import { generateGiftCertificatePdf } from "./pdf";
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

  it("produces stable attachment bytes for idempotent worker retries", async () => {
    const input = {
      certificateCode: "MMN-GC-20260705-ABC123XY",
      order: fulfillmentOrder,
    };

    const first = await generateGiftCertificatePdf(input);
    const second = await generateGiftCertificatePdf(input);

    expect(Buffer.from(second.bytes)).toEqual(Buffer.from(first.bytes));
  });
});
