// @vitest-environment node

import { describe, expect, it } from "vitest";

import { decodeGiftOrderMetadata, encodeGiftOrderMetadata } from "./metadata";
import type { GiftCertificatePaymentMetadataOrder } from "./types";

const longOrder: GiftCertificatePaymentMetadataOrder = {
  locale: "en",
  purchaseMode: "gift",
  purchaserName: "Anna Buyer",
  purchaserEmail: "anna@example.com",
  recipientName: "Maria Recipient",
  recipientEmail: "maria@example.com",
  recipientMessage: "A".repeat(600),
  deliveryMode: "recipient_email",
  serviceItems: [{ serviceSlug: "classic-massage", sessions: 5 }],
  amountVoucherEur: 500,
  expiresOn: "2027-01-05",
  totalEurCents: 72500,
};

describe("gift order Stripe metadata", () => {
  it("chunks and restores orders within Stripe metadata value limits", () => {
    const metadata = encodeGiftOrderMetadata(longOrder);

    expect(Object.keys(metadata).length).toBeGreaterThan(1);
    expect(Object.values(metadata).every((value) => value.length <= 450)).toBe(true);
    expect(decodeGiftOrderMetadata(metadata)).toEqual(longOrder);
  });

  it("decodes chunk keys in numeric order", () => {
    const metadata: Record<string, string> = {
      gift_order_010: "}",
      gift_order_002: '"locale":"en",',
      gift_order_001: "{",
      gift_order_003: '"purchaseMode":"self",',
      gift_order_004: '"purchaserName":"Anna",',
      gift_order_005: '"purchaserEmail":"anna@example.com",',
      gift_order_006: '"recipientName":"Anna",',
      gift_order_007: '"deliveryMode":"buyer_only",',
      gift_order_008: '"serviceItems":[{"serviceSlug":"classic-massage","sessions":1}],',
      gift_order_009: '"expiresOn":"2027-01-05","totalEurCents":4500',
    };

    expect(decodeGiftOrderMetadata(metadata)?.totalEurCents).toBe(4500);
  });
});
