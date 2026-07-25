import { describe, expect, it } from "vitest";

import {
  normalizePublicBookingPhone,
  parseAvailabilityQuery,
  parseConfirmPayload,
  parseCreateHoldPayload,
  parseOptionsQuery,
} from "./validation";

describe("public booking validation", () => {
  it("accepts strict availability and hold inputs", () => {
    expect(
      parseAvailabilityQuery(
        new URL("https://example.com/api/public/booking/availability?priceVariantId=price-60&from=2026-08-01&days=7"),
      ),
    ).toEqual({ days: 7, from: "2026-08-01", priceVariantId: "price-60" });
    expect(parseCreateHoldPayload({ date: "2026-08-01", priceVariantId: "price-60", time: "10:30" })).toEqual({
      date: "2026-08-01",
      priceVariantId: "price-60",
      time: "10:30",
    });
    expect(parseCreateHoldPayload({ date: "2026-08-01", priceVariantId: "price-60", time: "10:15" })).toBeNull();
    expect(parseCreateHoldPayload({ date: "2026-08-01", priceVariantId: "price-60", time: "10:45" })).toBeNull();
    expect(parseCreateHoldPayload({
      date: "2026-08-01",
      priceVariantId: "price-60",
      specialistId: "yana-public",
      time: "10:30",
    })).toEqual({
      date: "2026-08-01",
      priceVariantId: "price-60",
      specialistId: "yana-public",
      time: "10:30",
    });
  });

  it("restores confirmations only when the review URL requests it", () => {
    expect(parseOptionsQuery(new URL("https://example.com/api/public/booking/options?locale=en"))).toEqual({
      locale: "en",
      recoverConfirmation: false,
    });
    expect(parseOptionsQuery(new URL(
      "https://example.com/api/public/booking/options?locale=en&recoverConfirmation=1",
    ))).toEqual({ locale: "en", recoverConfirmation: true });
    expect(parseOptionsQuery(new URL(
      "https://example.com/api/public/booking/options?locale=en&recoverConfirmation=true",
    ))).toBeNull();
  });

  it("rejects unknown fields, invalid calendar dates, and filled honeypots", () => {
    expect(parseCreateHoldPayload({ date: "2026-02-30", priceVariantId: "price-60", time: "10:15" })).toBeNull();
    expect(parseCreateHoldPayload({ date: "2026-08-01", extra: true, priceVariantId: "price-60", time: "10:15" })).toBeNull();
    expect(parseCreateHoldPayload({ date: "2026-08-01", priceVariantId: "price-60", time: "10:15", website: "spam" })).toBeNull();
    expect(parseAvailabilityQuery(new URL(
      "https://example.com/api/public/booking/availability?priceVariantId=one&priceVariantId=two&from=2026-08-01&days=7",
    ))).toBeNull();
  });

  it("requires consent, a valid hold token, and an explicit idempotency key", () => {
    const payload = {
      contactPreference: "telegram",
      email: "CLIENT@EXAMPLE.COM",
      fullName: "Client Example",
      holdToken: "h".repeat(43),
      locale: "ru",
      note: "Please call if needed.",
      phone: "+359 88 123 4567",
      privacyAccepted: true,
      selectionId: "11111111-1111-4111-8111-111111111111",
      selectionVersion: 1,
    };

    expect(parseConfirmPayload(payload, "booking-submit-001")).toEqual({
      careEmailOptIn: false,
      contactPreference: "telegram",
      email: "client@example.com",
      fullName: "Client Example",
      holdToken: "h".repeat(43),
      idempotencyKey: "booking-submit-001",
      locale: "ru",
      note: "Please call if needed.",
      phone: "+359 88 123 4567",
      phoneNormalized: "359881234567",
      privacyAccepted: true,
      selectionId: "11111111-1111-4111-8111-111111111111",
      selectionVersion: 1,
    });
    expect(parseConfirmPayload(payload, null)).toBeNull();
    expect(parseConfirmPayload({ ...payload, privacyAccepted: false }, "booking-submit-001")).toBeNull();
    expect(parseConfirmPayload({ ...payload, contactPreference: "signal" }, "booking-submit-001")).toBeNull();
    expect(parseConfirmPayload({ ...payload, contactPreference: "email", email: "" }, "booking-submit-001")).toBeNull();
    expect(parseConfirmPayload({ ...payload, selectionVersion: 0 }, "booking-submit-001")).toBeNull();
    expect(parseConfirmPayload({ ...payload, selectionId: "not-a-uuid" }, "booking-submit-001")).toBeNull();
    expect(parseConfirmPayload({ ...payload, careEmailOptIn: "yes" }, "booking-submit-001")).toBeNull();
    expect(parseConfirmPayload({ ...payload, careEmailOptIn: true }, "booking-submit-001")).toMatchObject({
      careEmailOptIn: true,
    });
    expect(parseConfirmPayload({ ...payload, careEmailOptIn: true, email: "" }, "booking-submit-001")).toBeNull();
  });

  it("normalizes phone keys consistently with admin client records", () => {
    expect(normalizePublicBookingPhone("+359 (88) 123-45-67")).toBe("359881234567");
  });
});
