import type {
  GiftCertificateFulfillmentOrder,
  GiftCertificatePaymentMetadataOrder,
} from "./types";
import { isGiftCertificateServiceSlug } from "@/content/gift-certificates";
import { isSupportedLocale } from "@/i18n/config";

const metadataChunkPrefix = "gift_order_";
const metadataChunkSize = 450;

export function encodeGiftOrderMetadata(order: GiftCertificatePaymentMetadataOrder) {
  const serialized = JSON.stringify(order);
  const chunks: Record<string, string> = {};

  for (let index = 0; index < serialized.length; index += metadataChunkSize) {
    const chunkNumber = Math.floor(index / metadataChunkSize) + 1;
    chunks[`${metadataChunkPrefix}${String(chunkNumber).padStart(3, "0")}`] = serialized.slice(
      index,
      index + metadataChunkSize,
    );
  }

  return chunks;
}

export function decodeGiftOrderMetadata(
  metadata: Record<string, string | undefined>,
): GiftCertificatePaymentMetadataOrder | undefined {
  const chunks = Object.entries(metadata)
    .filter(([key]) => key.startsWith(metadataChunkPrefix))
    .sort(([left], [right]) => getChunkNumber(left) - getChunkNumber(right))
    .map(([, value]) => value ?? "");

  if (chunks.length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(chunks.join(""));

    return isGiftCertificatePaymentMetadataOrder(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function getChunkNumber(key: string): number {
  return Number(key.slice(metadataChunkPrefix.length));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isGiftCertificatePaymentMetadataOrder(value: unknown): value is GiftCertificatePaymentMetadataOrder {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.locale === "string" &&
    isSupportedLocale(value.locale) &&
    (value.purchaseMode === "self" || value.purchaseMode === "gift") &&
    typeof value.purchaserName === "string" &&
    isEmail(value.purchaserEmail) &&
    typeof value.recipientName === "string" &&
    (value.recipientEmail === undefined || isEmail(value.recipientEmail)) &&
    (value.recipientMessage === undefined || typeof value.recipientMessage === "string") &&
    (value.deliveryMode === "buyer_only" || value.deliveryMode === "recipient_email") &&
    Array.isArray(value.serviceItems) &&
    value.serviceItems.every(
      (item) =>
        isObject(item) &&
        typeof item.serviceSlug === "string" &&
        isGiftCertificateServiceSlug(item.serviceSlug) &&
        typeof item.sessions === "number" &&
        Number.isInteger(item.sessions),
    ) &&
    (value.amountVoucherEur === undefined || typeof value.amountVoucherEur === "number") &&
    typeof value.expiresOn === "string" &&
    typeof value.totalEurCents === "number" &&
    Number.isInteger(value.totalEurCents)
  );
}

export function toFulfillmentOrder(
  order: GiftCertificatePaymentMetadataOrder,
): GiftCertificateFulfillmentOrder {
  return {
    locale: order.locale,
    purchaseMode: order.purchaseMode,
    purchaserName: order.purchaserName,
    purchaserEmail: order.purchaserEmail,
    recipientName: order.recipientName,
    recipientEmail: order.recipientEmail,
    recipientMessage: order.recipientMessage,
    deliveryMode: order.deliveryMode,
    serviceItems: order.serviceItems,
    amountVoucherEur: order.amountVoucherEur,
    expiresOn: order.expiresOn,
  };
}
