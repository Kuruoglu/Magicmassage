import { renderTransactionalEmail, transactionalEmailTemplateVersion } from "./templates";
import type { EmailLocale, EmailNotification, TransactionalEmailEvent } from "./types";

const previewNotificationId = "11111111-1111-4111-8111-111111111111";
const localizedPreviewPayload: Record<EmailLocale, Record<string, string>> = {
  bg: {
    address: "София, примерен адрес",
    clientName: "Мария (пример)",
    serviceName: "Класически масаж",
  },
  en: {
    address: "Sofia, sample address",
    clientName: "Maria (sample)",
    serviceName: "Classic massage",
  },
  ru: {
    address: "София, пример адреса",
    clientName: "Мария (пример)",
    serviceName: "Классический массаж",
  },
  ua: {
    address: "Софія, приклад адреси",
    clientName: "Марія (приклад)",
    serviceName: "Класичний масаж",
  },
};

const giftOrderId = "33333333-3333-4333-8333-333333333333";

function previewPayloadFor(eventType: TransactionalEmailEvent, locale: EmailLocale) {
  const localized = localizedPreviewPayload[locale];
  const appointment = {
    address: localized.address,
    clientName: localized.clientName,
    date: "25.07.2026",
    durationMinutes: 60,
    price: "70 EUR",
    publicReference: "MM-EXAMPLE",
    salonContact: "+359 88 000 0000",
    serviceName: localized.serviceName,
    specialistName: "Натали",
    time: "14:00",
  };

  switch (eventType) {
    case "booking_rescheduled":
      return {
        ...appointment,
        newDateTime: "25.07.2026, 16:00",
        previousDateTime: "25.07.2026, 14:00",
      };
    case "booking_cancelled":
      return { ...appointment, bookingUrl: `https://example.com/${locale}/booking` };
    case "booking_care":
      return {
        ...appointment,
        bookingUrl: `https://example.com/${locale}/booking`,
        reviewUrl: "https://example.com/review",
      };
    case "owner_new_public_booking":
      return {
        adminPath: "/admin?section=calendar&appointment=example",
        adminUrl: "https://example.com/admin?section=calendar&appointment=example",
        date: appointment.date,
        publicReference: appointment.publicReference,
        serviceName: appointment.serviceName,
        specialistName: appointment.specialistName,
        time: appointment.time,
      };
    case "gift_buyer":
      return {
        certificateCode: "GIFT-EXAMPLE",
        clientName: localized.clientName,
        gift_order_id: giftOrderId,
        recipientName: localized.clientName,
      };
    case "gift_recipient":
      return {
        certificateCode: "GIFT-EXAMPLE",
        gift_order_id: giftOrderId,
        recipientName: localized.clientName,
      };
    case "owner_gift_purchase":
      return {
        adminUrl: "https://example.com/admin?section=certificates",
        certificateCode: "GIFT-EXAMPLE",
        gift_order_id: giftOrderId,
      };
    default:
      return appointment;
  }
}

export function renderEmailTemplatePreview(
  eventType: TransactionalEmailEvent,
  locale: EmailLocale,
) {
  const isCertificate = eventType.startsWith("gift_") || eventType === "owner_gift_purchase";
  const notification: EmailNotification = {
    aggregate_id: "preview",
    aggregate_type: isCertificate ? "certificate" : "appointment",
    attempt_count: 0,
    dedupe_key: `preview:${eventType}:${locale}`,
    due_at: "2026-07-25T11:00:00.000Z",
    event_type: eventType,
    id: previewNotificationId,
    lease_token: "22222222-2222-4222-8222-222222222222",
    locale,
    payload: previewPayloadFor(eventType, locale),
    recipient_email: "preview@example.invalid",
    template_key: eventType,
    template_version: transactionalEmailTemplateVersion,
  };
  const rendered = renderTransactionalEmail(notification, {
    env: { EMAIL_PREFERENCES_SECRET: "preview-only-not-a-production-secret", NODE_ENV: "test" },
    siteUrl: "https://example.com",
  });

  return { ...rendered, templateVersion: transactionalEmailTemplateVersion };
}
