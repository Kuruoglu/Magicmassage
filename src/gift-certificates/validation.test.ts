import { describe, expect, it } from "vitest";

import {
  createGiftCertificateCode,
  validateGiftCertificateOrderPayload,
} from "./validation";

const validSelfPayload = {
  locale: "en",
  purchaseMode: "self",
  purchaserName: "Anna Buyer",
  purchaserEmail: "anna@example.com",
  recipientName: "Anna Buyer",
  deliveryMode: "buyer_only",
  serviceItems: [{ serviceSlug: "classic-massage", sessions: 2 }],
  amountVoucherEur: 100,
  clientTotalEurCents: 1,
};

describe("gift certificate payload validation", () => {
  it("accepts a valid self purchase and strips client-side totals", () => {
    const result = validateGiftCertificateOrderPayload(validSelfPayload);

    expect(result.success).toBe(true);
    expect(result.success && "clientTotalEurCents" in result.data).toBe(false);
    expect(result.success && result.data.purchaseMode).toBe("self");
  });

  it("requires at least one service or amount voucher", () => {
    const result = validateGiftCertificateOrderPayload({
      ...validSelfPayload,
      serviceItems: [],
      amountVoucherEur: undefined,
    });

    expect(result.success).toBe(false);
    expect(!result.success && result.errors).toContain("Choose at least one massage or amount.");
  });

  it("enforces the free amount voucher min and max", () => {
    expect(
      validateGiftCertificateOrderPayload({
        ...validSelfPayload,
        serviceItems: [],
        amountVoucherEur: 49,
      }).success,
    ).toBe(false);

    expect(
      validateGiftCertificateOrderPayload({
        ...validSelfPayload,
        serviceItems: [],
        amountVoucherEur: 501,
      }).success,
    ).toBe(false);
  });

  it("requires recipient email only for automatic gift delivery", () => {
    const manualGift = validateGiftCertificateOrderPayload({
      ...validSelfPayload,
      purchaseMode: "gift",
      recipientName: "Maria",
      recipientMessage: "Enjoy your massage.",
      deliveryMode: "buyer_only",
    });

    expect(manualGift.success).toBe(true);

    const automaticGift = validateGiftCertificateOrderPayload({
      ...validSelfPayload,
      purchaseMode: "gift",
      recipientName: "Maria",
      recipientMessage: "Enjoy your massage.",
      deliveryMode: "recipient_email",
    });

    expect(automaticGift.success).toBe(false);
    expect(!automaticGift.success && automaticGift.errors).toContain(
      "Recipient email is required for automatic delivery.",
    );
  });

  it("caps public text lengths and massage line count before Stripe metadata", () => {
    const result = validateGiftCertificateOrderPayload({
      ...validSelfPayload,
      purchaserName: "A".repeat(81),
      recipientName: "B".repeat(81),
      recipientMessage: "C".repeat(181),
      serviceItems: Array.from({ length: 7 }, () => ({
        serviceSlug: "classic-massage",
        sessions: 1,
      })),
    });

    expect(result.success).toBe(false);
    expect(!result.success && result.errors).toEqual(
      expect.arrayContaining([
        "Purchaser name must be 80 characters or fewer.",
        "Recipient name must be 80 characters or fewer.",
        "Recipient message must be 180 characters or fewer.",
        "Choose no more than 6 massage lines.",
      ]),
    );
  });
});

describe("gift certificate code generation", () => {
  it("creates stable dashboard-friendly certificate codes", () => {
    expect(
      createGiftCertificateCode(new Date("2026-07-05T10:30:00.000Z"), "abc123xy"),
    ).toBe("MMN-GC-20260705-ABC123XY");
  });
});
