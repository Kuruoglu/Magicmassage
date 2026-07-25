import { createEmailPreferenceToken } from "./preferences-token";
import type { EmailLocale, EmailNotification, RenderedEmail, TransactionalEmailEvent } from "./types";

export const transactionalEmailTemplateVersion = 1;

type Copy = {
  address: string;
  bookAgain: string;
  bookingCancelled: string;
  bookingConfirmed: string;
  bookingReminder: string;
  bookingRescheduled: string;
  care: string;
  careBody: string;
  contact: string;
  date: string;
  duration: string;
  giftBuyer: string;
  giftRecipient: string;
  hello: string;
  newBooking: string;
  newGift: string;
  newTime: string;
  oldTime: string;
  openCrm: string;
  price: string;
  reference: string;
  review: string;
  service: string;
  specialist: string;
  time: string;
  unsubscribe: string;
};

const copies: Record<EmailLocale, Copy> = {
  bg: {
    openCrm: "Отвори в CRM",
    contact: "Контакт за промяна или отказ",
    address: "Адрес", bookAgain: "Запази отново", bookingCancelled: "Записването е отменено",
    bookingConfirmed: "Потвърждение на записването", bookingReminder: "Напомняне за утрешното посещение",
    bookingRescheduled: "Записването е преместено", care: "Благодарим за посещението",
    careBody: "Благодарим, че избрахте Magic Massage Natali. Ще се радваме да споделите впечатленията си.",
    date: "Дата", duration: "Продължителност", giftBuyer: "Вашият подаръчен сертификат",
    giftRecipient: "Получихте подаръчен сертификат", hello: "Здравейте", newBooking: "Ново онлайн записване",
    newGift: "Нова покупка на сертификат", newTime: "Ново време", oldTime: "Предишно време", price: "Цена",
    reference: "Номер", review: "Оставете отзив", service: "Услуга", specialist: "Специалист", time: "Час",
    unsubscribe: "Отказ от писма за грижа",
  },
  ru: {
    openCrm: "Открыть в CRM",
    contact: "Связь для переноса или отмены",
    address: "Адрес", bookAgain: "Записаться снова", bookingCancelled: "Запись отменена",
    bookingConfirmed: "Подтверждение записи", bookingReminder: "Напоминание о завтрашнем визите",
    bookingRescheduled: "Запись перенесена", care: "Спасибо за визит",
    careBody: "Спасибо, что выбрали Magic Massage Natali. Будем рады, если вы поделитесь впечатлениями.",
    date: "Дата", duration: "Длительность", giftBuyer: "Ваш подарочный сертификат",
    giftRecipient: "Вам подарили сертификат", hello: "Здравствуйте", newBooking: "Новая онлайн-запись",
    newGift: "Новая покупка сертификата", newTime: "Новое время", oldTime: "Предыдущее время", price: "Цена",
    reference: "Номер", review: "Оставить отзыв", service: "Услуга", specialist: "Специалист", time: "Время",
    unsubscribe: "Отказаться от писем заботы",
  },
  ua: {
    openCrm: "Відкрити в CRM",
    contact: "Зв'язок для перенесення або скасування",
    address: "Адреса", bookAgain: "Записатися знову", bookingCancelled: "Запис скасовано",
    bookingConfirmed: "Підтвердження запису", bookingReminder: "Нагадування про завтрашній візит",
    bookingRescheduled: "Запис перенесено", care: "Дякуємо за візит",
    careBody: "Дякуємо, що обрали Magic Massage Natali. Будемо раді, якщо ви поділитеся враженнями.",
    date: "Дата", duration: "Тривалість", giftBuyer: "Ваш подарунковий сертифікат",
    giftRecipient: "Вам подарували сертифікат", hello: "Вітаємо", newBooking: "Новий онлайн-запис",
    newGift: "Нова покупка сертифіката", newTime: "Новий час", oldTime: "Попередній час", price: "Ціна",
    reference: "Номер", review: "Залишити відгук", service: "Послуга", specialist: "Спеціаліст", time: "Час",
    unsubscribe: "Відмовитися від листів турботи",
  },
  en: {
    openCrm: "Open in CRM",
    contact: "Contact for rescheduling or cancellation",
    address: "Address", bookAgain: "Book again", bookingCancelled: "Booking cancelled",
    bookingConfirmed: "Booking confirmation", bookingReminder: "Reminder for tomorrow's visit",
    bookingRescheduled: "Booking rescheduled", care: "Thank you for visiting",
    careBody: "Thank you for choosing Magic Massage Natali. We would be happy to hear about your experience.",
    date: "Date", duration: "Duration", giftBuyer: "Your gift certificate",
    giftRecipient: "You received a gift certificate", hello: "Hello", newBooking: "New online booking",
    newGift: "New gift certificate purchase", newTime: "New time", oldTime: "Previous time", price: "Price",
    reference: "Reference", review: "Leave a review", service: "Service", specialist: "Specialist", time: "Time",
    unsubscribe: "Unsubscribe from care emails",
  },
};

const subjectKey: Record<TransactionalEmailEvent, keyof Copy> = {
  booking_cancelled: "bookingCancelled",
  booking_care: "care",
  booking_confirmed: "bookingConfirmed",
  booking_reminder_24h: "bookingReminder",
  booking_rescheduled: "bookingRescheduled",
  gift_buyer: "giftBuyer",
  gift_recipient: "giftRecipient",
  owner_gift_purchase: "newGift",
  owner_new_public_booking: "newBooking",
};

export function normalizeEmailLocale(value: unknown): EmailLocale {
  return value === "bg" || value === "ru" || value === "ua" || value === "en" ? value : "bg";
}

export function escapeEmailHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function value(payload: Record<string, unknown>, key: string) {
  const item = payload[key];
  return typeof item === "string" || typeof item === "number" ? String(item) : "";
}

function safeHttpsUrl(candidate: string) {
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function detailRows(copy: Copy, payload: Record<string, unknown>) {
  const rows: Array<[string, string]> = [
    [copy.service, value(payload, "serviceName")],
    [copy.specialist, value(payload, "specialistName")],
    [copy.date, value(payload, "date")],
    [copy.time, value(payload, "time")],
    [copy.duration, value(payload, "durationMinutes") ? `${value(payload, "durationMinutes")} min` : ""],
    [copy.price, value(payload, "price")],
    [copy.address, value(payload, "address")],
    [copy.contact, value(payload, "salonContact")],
    [copy.reference, value(payload, "publicReference") || value(payload, "certificateCode")],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return rows;
}

export function renderTransactionalEmail(
  notification: EmailNotification,
  options: { env?: NodeJS.ProcessEnv; siteUrl?: string } = {},
): RenderedEmail {
  const locale = normalizeEmailLocale(notification.locale);
  const copy = copies[locale];
  const payload = notification.payload;
  const subject = `${copy[subjectKey[notification.event_type]]} — Magic Massage Natali`;
  const rows = detailRows(copy, payload);
  const previous = value(payload, "previousDateTime");
  const next = value(payload, "newDateTime");
  if (notification.event_type === "booking_rescheduled") {
    if (previous) rows.unshift([copy.oldTime, previous]);
    if (next) rows.unshift([copy.newTime, next]);
  }

  const greetingName = value(payload, "clientName") || value(payload, "recipientName");
  const intro = notification.event_type === "booking_care"
    ? copy.careBody
    : copy[subjectKey[notification.event_type]];
  const textLines = [greetingName ? `${copy.hello}, ${greetingName}.` : `${copy.hello}.`, intro];
  for (const [label, rowValue] of rows) textLines.push(`${label}: ${rowValue}`);

  const actions: Array<{ href: string; label: string }> = [];
  const reviewUrl = safeHttpsUrl(value(payload, "reviewUrl"));
  const bookingUrl = safeHttpsUrl(value(payload, "bookingUrl"));
  const adminUrl = safeHttpsUrl(value(payload, "adminUrl"));
  if (notification.event_type === "booking_care" && reviewUrl) actions.push({ href: reviewUrl, label: copy.review });
  if ((notification.event_type === "booking_care" || notification.event_type === "booking_cancelled") && bookingUrl) {
    actions.push({ href: bookingUrl, label: copy.bookAgain });
  }
  if ((notification.event_type === "owner_new_public_booking" || notification.event_type === "owner_gift_purchase") && adminUrl) {
    actions.push({ href: adminUrl, label: copy.openCrm });
  }
  for (const action of actions) textLines.push(`${action.label}: ${action.href}`);

  const preferenceToken = notification.event_type === "booking_care"
    ? createEmailPreferenceToken(notification.id, options.env)
    : null;
  const siteUrl = safeHttpsUrl(options.siteUrl ?? value(payload, "siteUrl"));
  const unsubscribeUrl = preferenceToken && siteUrl
    ? new URL(`/${locale}/email-preferences?token=${encodeURIComponent(preferenceToken)}`, siteUrl).toString()
    : "";
  if (unsubscribeUrl) textLines.push(`${copy.unsubscribe}: ${unsubscribeUrl}`);

  const rowHtml = rows.map(([label, rowValue]) => (
    `<tr><th align="left" style="padding:6px 12px 6px 0">${escapeEmailHtml(label)}</th>`
    + `<td style="padding:6px 0">${escapeEmailHtml(rowValue)}</td></tr>`
  )).join("");
  const actionHtml = actions.map(({ href, label }) => (
    `<p><a href="${escapeEmailHtml(href)}" style="display:inline-block;padding:12px 18px;background:#315f53;color:#fff;text-decoration:none;border-radius:6px">`
    + `${escapeEmailHtml(label)}</a></p>`
  )).join("");
  const unsubscribeHtml = unsubscribeUrl
    ? `<p style="font-size:12px"><a href="${escapeEmailHtml(unsubscribeUrl)}">${escapeEmailHtml(copy.unsubscribe)}</a></p>`
    : "";

  return {
    html: `<!doctype html><html lang="${locale}"><body><main><p>${escapeEmailHtml(textLines[0])}</p><p>${escapeEmailHtml(intro)}</p><table>${rowHtml}</table>${actionHtml}${unsubscribeHtml}</main></body></html>`,
    subject,
    text: textLines.join("\n"),
  };
}
