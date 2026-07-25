import { generateGiftCertificatePdf } from "./pdf";
import type { GiftCertificateOrderStore } from "./order-store";

export const giftCertificateOutboxEventTypes = [
  "gift_buyer",
  "gift_recipient",
  "owner_gift_purchase",
] as const;

export type GiftCertificateOutboxEventType =
  (typeof giftCertificateOutboxEventTypes)[number];

export function isGiftCertificateOutboxEventType(
  value: string,
): value is GiftCertificateOutboxEventType {
  return giftCertificateOutboxEventTypes.includes(value as GiftCertificateOutboxEventType);
}

/**
 * Worker adapter: the outbox carries only the order id. The protected order is
 * loaded just-in-time and the PDF is generated per independent delivery attempt.
 */
export async function prepareGiftCertificateOutboxDelivery({
  orderId,
  store,
}: {
  orderId: string;
  store: GiftCertificateOrderStore;
}) {
  const persisted = await store.loadOrder(orderId);
  const order = {
    locale: persisted.locale,
    purchaseMode: persisted.purchaseMode,
    purchaserName: persisted.purchaserName,
    purchaserEmail: persisted.purchaserEmail,
    recipientName: persisted.recipientName,
    recipientEmail: persisted.recipientEmail,
    recipientMessage: persisted.recipientMessage,
    deliveryMode: persisted.deliveryMode,
    serviceItems: persisted.serviceItems,
    amountVoucherEur: persisted.amountVoucherEur,
    expiresOn: persisted.expiresOn,
  };
  const pdf = await generateGiftCertificatePdf({
    certificateCode: persisted.certificateCode,
    order,
  });

  return {
    certificateCode: persisted.certificateCode,
    order,
    pdf,
  };
}
