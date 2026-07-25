import type { GiftCertificateStripeMetadata } from "./types";
import { isSupportedLocale } from "@/i18n/config";

const orderIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeGiftOrderReferenceMetadata(
  metadata: GiftCertificateStripeMetadata,
): Record<string, string> {
  return {
    gift_order_id: metadata.orderId,
    gift_certificate_code: metadata.certificateCode,
    gift_total_eur_cents: String(metadata.totalEurCents),
    gift_locale: metadata.locale,
    gift_order_schema_version: metadata.schemaVersion,
  };
}

export function decodeGiftOrderReferenceMetadata(
  metadata: Record<string, string | undefined>,
): GiftCertificateStripeMetadata | undefined {
  const orderId = metadata.gift_order_id;
  const certificateCode = metadata.gift_certificate_code;
  const totalEurCents = Number(metadata.gift_total_eur_cents);
  const locale = metadata.gift_locale;

  if (
    !orderId ||
    !orderIdPattern.test(orderId) ||
    !certificateCode ||
    !/^MMN-GC-\d{8}-[A-Z0-9]{8}$/.test(certificateCode) ||
    !Number.isInteger(totalEurCents) ||
    totalEurCents <= 0 ||
    !locale ||
    !isSupportedLocale(locale) ||
    metadata.gift_order_schema_version !== "v2"
  ) {
    return undefined;
  }

  return {
    certificateCode,
    locale,
    orderId,
    schemaVersion: "v2",
    totalEurCents,
  };
}
