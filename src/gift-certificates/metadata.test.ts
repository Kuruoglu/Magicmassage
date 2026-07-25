// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  decodeGiftOrderReferenceMetadata,
  encodeGiftOrderReferenceMetadata,
} from "./metadata";

const reference = {
  certificateCode: "MMN-GC-20260705-ABC123XY",
  locale: "en" as const,
  orderId: "01234567-89ab-4def-8123-456789abcdef",
  schemaVersion: "v2" as const,
  totalEurCents: 4500,
};

describe("gift order Stripe metadata", () => {
  it("contains only reconciliation fields and no customer PII or order contents", () => {
    const metadata = encodeGiftOrderReferenceMetadata(reference);

    expect(metadata).toEqual({
      gift_order_id: reference.orderId,
      gift_certificate_code: reference.certificateCode,
      gift_total_eur_cents: "4500",
      gift_locale: "en",
      gift_order_schema_version: "v2",
    });
    expect(JSON.stringify(metadata)).not.toMatch(
      /purchaser|recipient|email|message|serviceItems|amountVoucher/i,
    );
  });

  it("round-trips a valid persisted-order reference", () => {
    expect(decodeGiftOrderReferenceMetadata(encodeGiftOrderReferenceMetadata(reference))).toEqual(
      reference,
    );
  });

  it("rejects malformed, incomplete, or obsolete metadata", () => {
    expect(decodeGiftOrderReferenceMetadata({ gift_order_id: reference.orderId })).toBeUndefined();
    expect(
      decodeGiftOrderReferenceMetadata({
        ...encodeGiftOrderReferenceMetadata(reference),
        gift_order_schema_version: "v1",
      }),
    ).toBeUndefined();
    expect(
      decodeGiftOrderReferenceMetadata({
        ...encodeGiftOrderReferenceMetadata(reference),
        gift_total_eur_cents: "45.5",
      }),
    ).toBeUndefined();
  });
});
