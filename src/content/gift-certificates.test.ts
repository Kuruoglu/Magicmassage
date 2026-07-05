import { describe, expect, it } from "vitest";

import {
  calculateGiftCertificateTotal,
  convertEurCentsToBgn,
  getGiftCertificateExpiryDate,
  giftCertificateSalesConfig,
  isBgnEquivalentVisible,
} from "./gift-certificates";

describe("gift certificate sales catalog", () => {
  it("calculates totals from configured service prices and optional amount vouchers", () => {
    const classic = giftCertificateSalesConfig.sellableServices["classic-massage"];
    const back = giftCertificateSalesConfig.sellableServices["back-massage"];

    const total = calculateGiftCertificateTotal({
      serviceItems: [
        { serviceSlug: "classic-massage", sessions: 2 },
        { serviceSlug: "back-massage", sessions: 1 },
      ],
      amountVoucherEur: 100,
    });

    expect(total.totalEurCents).toBe(
      (classic.priceEur * 2 + back.priceEur + 100) * 100,
    );
    expect(total.lines).toEqual([
      {
        kind: "service",
        serviceSlug: "classic-massage",
        sessions: 2,
        unitPriceEur: classic.priceEur,
        subtotalEurCents: classic.priceEur * 2 * 100,
      },
      {
        kind: "service",
        serviceSlug: "back-massage",
        sessions: 1,
        unitPriceEur: back.priceEur,
        subtotalEurCents: back.priceEur * 100,
      },
      {
        kind: "amount",
        amountEur: 100,
        subtotalEurCents: 10000,
      },
    ]);
  });

  it("converts EUR cents to BGN using the fixed transition rate", () => {
    expect(giftCertificateSalesConfig.eurToBgnRate).toBe(1.95583);
    expect(convertEurCentsToBgn(10000)).toEqual({
      amountBgn: 195.58,
      formatted: "195.58 BGN",
    });
  });

  it("shows BGN equivalents through 8 August 2026", () => {
    expect(isBgnEquivalentVisible(new Date("2026-08-08T12:00:00.000Z"))).toBe(
      true,
    );
    expect(isBgnEquivalentVisible(new Date("2026-08-09T00:00:00.000Z"))).toBe(
      false,
    );
  });

  it("expires gift certificates after the configured placeholder validity period", () => {
    expect(giftCertificateSalesConfig.validityMonths).toBe(6);
    expect(giftCertificateSalesConfig.validityNeedsClientConfirmation).toBe(true);

    expect(
      getGiftCertificateExpiryDate(new Date("2026-07-05T00:00:00.000Z")),
    ).toBe("2027-01-05");
  });
});
