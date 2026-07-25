import type { Locale } from "@/i18n/config";
import type { GiftCertificateServiceSlug } from "@/content/gift-certificates";

export type GiftCertificatePurchaseMode = "self" | "gift";
export type GiftCertificateDeliveryMode = "buyer_only" | "recipient_email";

export type GiftCertificateOrderInput = {
  locale: Locale;
  purchaseMode: GiftCertificatePurchaseMode;
  purchaserName: string;
  purchaserEmail: string;
  recipientName: string;
  recipientEmail?: string;
  recipientMessage?: string;
  deliveryMode: GiftCertificateDeliveryMode;
  serviceItems: Array<{
    serviceSlug: GiftCertificateServiceSlug;
    sessions: number;
  }>;
  amountVoucherEur?: number;
};

export type GiftCertificateFulfillmentOrder = GiftCertificateOrderInput & {
  expiresOn: string;
};

export type GiftCertificateValidationResult =
  | { success: true; data: GiftCertificateOrderInput }
  | { success: false; errors: string[] };

export type GiftCertificatePaymentMetadataOrder = GiftCertificateFulfillmentOrder & {
  totalEurCents: number;
};

export type GiftCertificatePersistedOrder = GiftCertificatePaymentMetadataOrder & {
  certificateCode: string;
  id: string;
  paymentIntentId?: string;
  status: "pending" | "paid" | "fulfilled" | "fulfillment_failed";
};

export type GiftCertificateStripeMetadata = {
  certificateCode: string;
  locale: Locale;
  orderId: string;
  schemaVersion: "v2";
  totalEurCents: number;
};
