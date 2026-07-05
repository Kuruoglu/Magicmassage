import { serviceDefinitions } from "@/content/service-catalog";

export const giftCertificateServiceSlugs = [
  "classic-massage",
  "deep-tissue-massage",
  "lymphatic-drainage-massage",
  "anti-cellulite-massage",
  "thai-massage",
  "smart-therapy",
  "face-massage",
  "back-massage",
  "neck-shoulders-massage",
  "head-massage",
] as const;

export type GiftCertificateServiceSlug = (typeof giftCertificateServiceSlugs)[number];

export type GiftCertificateServiceOption = {
  slug: GiftCertificateServiceSlug;
  priceEurCents: number;
  priceEur: number;
  placeholderPriceNeedsConfirmation: boolean;
};

const placeholderPricesEurCents: Record<GiftCertificateServiceSlug, number> = {
  "classic-massage": 4500,
  "deep-tissue-massage": 5500,
  "lymphatic-drainage-massage": 5000,
  "anti-cellulite-massage": 5000,
  "thai-massage": 6000,
  "smart-therapy": 6000,
  "face-massage": 3500,
  "back-massage": 3500,
  "neck-shoulders-massage": 3000,
  "head-massage": 2500,
};

export const giftCertificateSalesConfig = {
  pricesAreFinal: false,
  priceNote: "Placeholder EUR prices must be confirmed by the client before live payments.",
  currency: "EUR",
  quickAmountValuesEur: [50, 100, 150, 200],
  amountVoucher: {
    minEur: 50,
    maxEur: 500,
  },
  sessionOptions: [1, 2, 3, 5],
  validityMonths: 6,
  validityNeedsClientConfirmation: false,
  eurToBgnRate: 1.95583,
  bgnEquivalentVisibleThrough: "2026-08-08",
  sellableServices: Object.fromEntries(
    giftCertificateServiceSlugs.map((slug) => [
      slug,
      {
      slug,
      priceEurCents: placeholderPricesEurCents[slug],
      priceEur: placeholderPricesEurCents[slug] / 100,
      placeholderPriceNeedsConfirmation: true,
      },
    ]),
  ) as Record<GiftCertificateServiceSlug, GiftCertificateServiceOption>,
} as const;

export type GiftCertificateServiceItem = {
  serviceSlug: GiftCertificateServiceSlug;
  sessions: number;
};

export type GiftCertificateTotalInput = {
  serviceItems: GiftCertificateServiceItem[];
  amountVoucherEur?: number;
};

export type GiftCertificateTotalLine =
  | {
      kind: "service";
      serviceSlug: GiftCertificateServiceSlug;
      sessions: number;
      unitPriceEur: number;
      subtotalEurCents: number;
    }
  | {
      kind: "amount";
      amountEur: number;
      subtotalEurCents: number;
    };

export type GiftCertificateTotal = {
  totalEurCents: number;
  lines: GiftCertificateTotalLine[];
};

export function isGiftCertificateServiceSlug(
  value: string,
): value is GiftCertificateServiceSlug {
  return giftCertificateServiceSlugs.includes(value as GiftCertificateServiceSlug);
}

export function getGiftCertificateServiceDefinition(slug: GiftCertificateServiceSlug) {
  return serviceDefinitions.find((service) => service.slug === slug);
}

export function calculateGiftCertificateTotal(
  input: GiftCertificateTotalInput,
): GiftCertificateTotal {
  const serviceLines: GiftCertificateTotalLine[] = input.serviceItems.map((item) => {
    const service = giftCertificateSalesConfig.sellableServices[item.serviceSlug];
    const subtotalEurCents = service.priceEurCents * item.sessions;

    return {
      kind: "service",
      serviceSlug: item.serviceSlug,
      sessions: item.sessions,
      unitPriceEur: service.priceEur,
      subtotalEurCents,
    };
  });

  const amountLine: GiftCertificateTotalLine[] =
    input.amountVoucherEur === undefined
      ? []
      : [
          {
            kind: "amount",
            amountEur: input.amountVoucherEur,
            subtotalEurCents: input.amountVoucherEur * 100,
          },
        ];
  const lines = [...serviceLines, ...amountLine];

  return {
    lines,
    totalEurCents: lines.reduce((sum, line) => sum + line.subtotalEurCents, 0),
  };
}

export function convertEurCentsToBgn(eurCents: number) {
  const amountBgn = Math.round(
    (eurCents / 100) * giftCertificateSalesConfig.eurToBgnRate * 100,
  ) / 100;

  return {
    amountBgn,
    formatted: `${amountBgn.toFixed(2)} BGN`,
  };
}

export function isBgnEquivalentVisible(now: Date): boolean {
  const endOfDayUtc = new Date(
    `${giftCertificateSalesConfig.bgnEquivalentVisibleThrough}T23:59:59.999Z`,
  );

  return now.getTime() <= endOfDayUtc.getTime();
}

export function getGiftCertificateExpiryDate(now: Date): string {
  const expiresAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  expiresAt.setUTCMonth(
    expiresAt.getUTCMonth() + giftCertificateSalesConfig.validityMonths,
  );

  return expiresAt.toISOString().slice(0, 10);
}
