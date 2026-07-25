export const emailLocales = ["bg", "ru", "ua", "en"] as const;

export const transactionalEmailEvents = [
  "booking_confirmed",
  "booking_rescheduled",
  "booking_cancelled",
  "booking_reminder_24h",
  "booking_care",
  "owner_new_public_booking",
  "gift_buyer",
  "gift_recipient",
  "owner_gift_purchase",
] as const;

export type EmailLocale = (typeof emailLocales)[number];
export type TransactionalEmailEvent = (typeof transactionalEmailEvents)[number];

export type EmailNotification = {
  aggregate_id: string;
  aggregate_type: "appointment" | "certificate";
  attempt_count: number;
  dedupe_key: string;
  due_at: string;
  event_type: TransactionalEmailEvent;
  id: string;
  lease_token: string;
  locale: EmailLocale;
  payload: Record<string, unknown>;
  recipient_email: string;
  template_key: string;
  template_version: number;
};

export type RenderedEmail = {
  html: string;
  subject: string;
  text: string;
};
