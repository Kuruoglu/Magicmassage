import type {
  GiftCertificateFulfillmentOrder,
  GiftCertificatePaymentMetadataOrder,
} from "./types";

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

  return JSON.parse(chunks.join("")) as GiftCertificatePaymentMetadataOrder;
}

function getChunkNumber(key: string): number {
  return Number(key.slice(metadataChunkPrefix.length));
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
