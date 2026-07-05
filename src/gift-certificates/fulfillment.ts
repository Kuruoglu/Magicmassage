import { sendGiftCertificateEmails, type GiftCertificateEmailResult } from "./email";
import { generateGiftCertificatePdf } from "./pdf";
import type { GiftCertificateFulfillmentOrder } from "./types";

type FulfillGiftCertificateOrderInput = {
  certificateCode: string;
  order: GiftCertificateFulfillmentOrder;
};

export async function fulfillGiftCertificateOrder({
  certificateCode,
  order,
}: FulfillGiftCertificateOrderInput): Promise<GiftCertificateEmailResult> {
  const pdf = await generateGiftCertificatePdf({ certificateCode, order });

  return sendGiftCertificateEmails({ certificateCode, order, pdf });
}
