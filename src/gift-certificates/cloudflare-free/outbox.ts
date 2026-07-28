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
  return giftCertificateOutboxEventTypes.includes(
    value as GiftCertificateOutboxEventType,
  );
}

export async function prepareGiftCertificateOutboxDelivery(
  _options: unknown,
): Promise<never> {
  void _options;
  throw new Error("gift_certificate_delivery_disabled");
}
