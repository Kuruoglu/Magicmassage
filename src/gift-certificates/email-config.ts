import type { GiftCertificateEmailEnvironment } from "./types";

type EmailConfig = {
  apiKey: string;
  from: string;
  ownerEmail?: string;
};

export function getGiftCertificateEmailConfig(
  env: GiftCertificateEmailEnvironment = process.env as GiftCertificateEmailEnvironment,
): EmailConfig {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error("Gift certificate email delivery is not configured.");
  }

  return {
    apiKey: env.RESEND_API_KEY,
    from: env.RESEND_FROM_EMAIL,
    ownerEmail: env.GIFT_CERTIFICATES_OWNER_EMAIL,
  };
}
