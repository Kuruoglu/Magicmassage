import type { FinanceRow } from "./config";

export type AppointmentStatus = "Подтверждена" | "Ожидает" | "Новая заявка" | "Отменена";

export type Appointment = {
  id?: string;
  clientId?: string;
  date: string;
  time: string;
  client: string;
  note: string;
  service: string;
  status: AppointmentStatus;
};

export type ClientVisit = {
  date: string;
  service: string;
  status: string;
};

export type ClientRecord = {
  id: string;
  email: string;
  history: ClientVisit[];
  language: string;
  name: string;
  next: string;
  note: string;
  phone: string;
  preferredContact: string;
  status: string;
  tags: string[];
  telegram: string;
  totalSpend: string;
  visits: number;
};

export type CertificateStatus = "Оплачено" | "Отправлен" | "Ожидает PDF" | "Погашен";

export type CertificateRecord = {
  amount: string;
  buyer: string;
  clientId?: string;
  clientName: string;
  code: string;
  expiresAt: string;
  history: string[];
  note: string;
  paymentDate: string;
  recipient: string;
  status: CertificateStatus;
  stripeId: string;
};

export type ServiceStatus = "Опубликована" | "Черновик" | "Скрыта";

export type ServiceRecord = {
  category: string;
  coverImage: string;
  duration: string;
  locales: string[];
  name: string;
  order: number;
  seoTitle: string;
  slug: string;
  status: ServiceStatus;
  summary: string;
};

export type PriceStatus = "Активна" | "Скрыта";

export type PriceRecord = {
  durationMinutes: number;
  id: string;
  note: string;
  order: number;
  priceEur: number;
  serviceSlug: string;
  status: PriceStatus;
  updatedAt: string;
};

export type MediaType = "Фото" | "Документ";

export type MediaStatus = "Готово" | "Требует alt" | "Черновик";

export type MediaRecord = {
  altText: string;
  dimensions: string;
  folder: string;
  id: string;
  name: string;
  size: string;
  status: MediaStatus;
  type: MediaType;
  uploadedAt: string;
  url: string;
  usage: string[];
};

export type ContactChannelType = "Телефон" | "Email" | "Мессенджер" | "Соцсеть" | "Карта" | "Бронирование";

export type ContactStatus = "Активен" | "Черновик" | "Скрыт";

export type ContactChannelRecord = {
  id: string;
  name: string;
  note: string;
  status: ContactStatus;
  type: ContactChannelType;
  usage: string[];
  value: string;
};

export type ContactSettingsRecord = {
  address: string;
  bookingUrl: string;
  businessName: string;
  email: string;
  mapUrl: string;
  phone: string;
  seoArea: string;
  workingHours: string;
};

export type BlogStatus = "Опубликована" | "Черновик" | "Запланирована" | "На проверке";

export type BlogPostRecord = {
  author: string;
  body: string;
  category: string;
  coverImage: string;
  excerpt: string;
  id: string;
  locales: string[];
  publishedAt: string;
  seoTitle: string;
  slug: string;
  status: BlogStatus;
  tags: string[];
  title: string;
  updatedAt: string;
};

export type CalendarSyncMode = "Отключена" | "Внутренний календарь главный" | "Односторонняя" | "Двусторонняя позже";

export type StripeMode = "Тестовый" | "Live после подтверждения";

export type SettingsRecord = {
  auditLogRetentionDays: number;
  bookingBufferMinutes: number;
  businessName: string;
  cookiePrivacyMode: string;
  currency: "EUR";
  dailySlotCapacity: number;
  defaultLocale: string;
  defaultSeoTitle: string;
  emailSender: string;
  googleCalendarId: string;
  googleCalendarMode: CalendarSyncMode;
  reminderTemplate: string;
  rolesPolicy: string;
  stripeMode: StripeMode;
  timezone: string;
  updatedAt: string;
  workingDays: string;
  workingHours: string;
};

type DemoClientRow = Omit<ClientRecord, "id" | "history" | "tags"> & {
  id?: string;
  history: readonly ClientVisit[];
  tags: readonly string[];
};

type DemoAppointmentRow = Omit<Appointment, "id" | "clientId"> & {
  id?: string;
  clientId?: string;
};

type DemoCertificateRow = Pick<CertificateRecord, "amount" | "buyer" | "clientName" | "code" | "recipient" | "status"> &
  Partial<Pick<CertificateRecord, "clientId" | "expiresAt" | "history" | "note" | "paymentDate" | "stripeId">>;

export type AdminDomainRecords = {
  appointments: Appointment[];
  certificates: CertificateRecord[];
  clients: ClientRecord[];
};

export type AdminClientDatabaseRow = {
  id: string;
  email: string;
  full_name: string;
  locale: string;
  next_visit_label: string;
  notes: string;
  phone: string;
  phone_normalized: string;
  preferred_contact: string;
  status: string;
  tags: string[];
  telegram_url: string;
  total_spend_label: string;
  visit_count: number;
};

export type AdminAppointmentDatabaseRow = {
  id: string;
  client_id: string | null;
  client_name_snapshot: string;
  internal_note: string;
  service_name: string;
  starts_at: string;
  starts_on: string;
  status: string;
};

export type AdminCertificateDatabaseRow = {
  code: string;
  amount_cents: number;
  buyer_name: string;
  client_id: string | null;
  client_name_snapshot: string;
  currency: string;
  expires_on: string;
  history: string[];
  internal_note: string;
  paid_on: string;
  recipient_name: string;
  status: string;
  stripe_payment_intent_id: string;
};

export type AdminServiceDatabaseRow = {
  category: string;
  cover_image_url: string;
  display_order: number;
  duration_label: string;
  locale_codes: string[];
  name: string;
  seo_title: string;
  slug: string;
  status: string;
  summary: string;
};

export type AdminPriceDatabaseRow = {
  currency: string;
  display_order: number;
  duration_minutes: number;
  id: string;
  internal_note: string;
  price_cents: number;
  service_slug: string;
  status: string;
  updated_on: string;
};

export type AdminMediaDatabaseRow = {
  alt_text: string;
  dimensions: string;
  file_size_label: string;
  folder: string;
  id: string;
  media_type: string;
  name: string;
  status: string;
  uploaded_on: string;
  url: string;
  usage_contexts: string[];
};

export type AdminContactChannelDatabaseRow = {
  channel_type: string;
  id: string;
  internal_note: string;
  name: string;
  status: string;
  usage_contexts: string[];
  value: string;
};

export type AdminContactSettingsDatabaseRow = {
  address: string;
  booking_url: string;
  business_name: string;
  email: string;
  id: string;
  map_url: string;
  phone: string;
  seo_area: string;
  working_hours: string;
};

export type AdminBlogPostDatabaseRow = {
  author: string;
  body: string;
  category: string;
  cover_image_url: string;
  excerpt: string;
  id: string;
  locale_codes: string[];
  published_on: string | null;
  seo_title: string;
  slug: string;
  status: string;
  tag_labels: string[];
  title: string;
  updated_on: string;
};

export type AdminSiteSettingsDatabaseRow = {
  audit_log_retention_days: number;
  booking_buffer_minutes: number;
  business_name: string;
  cookie_privacy_mode: string;
  currency: "EUR";
  daily_slot_capacity: number;
  default_locale: string;
  default_seo_title: string;
  email_sender: string;
  google_calendar_id: string;
  google_calendar_mode: string;
  id: "site";
  reminder_template: string;
  roles_policy: string;
  stripe_mode: string;
  timezone: string;
  updated_on: string;
  working_days: string;
  working_hours: string;
};

export type AdminDatabaseSeed = {
  appointments: AdminAppointmentDatabaseRow[];
  certificates: AdminCertificateDatabaseRow[];
  clients: AdminClientDatabaseRow[];
};

export function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU");
}

export function normalizeClientPhone(value: string) {
  return value.replace(/\D/g, "");
}

export function buildClientIdFromPhone(phone: string) {
  const phoneKey = normalizeClientPhone(phone);

  return phoneKey ? `client-${phoneKey}` : `client-${normalizeSearch(phone) || "manual"}`;
}

export function addMonthsToIsoDate(date: string, months: number) {
  const nextDate = new Date(`${date}T00:00:00.000Z`);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + months);

  return nextDate.toISOString().slice(0, 10);
}

export function parseEuroAmountToCents(amount: string) {
  const compactAmount = amount.replace(/\s/g, "").replace(",", ".");
  const valueMatch = compactAmount.match(/\d+(?:\.\d{1,2})?/);

  return valueMatch ? Math.round(Number(valueMatch[0]) * 100) : 0;
}

export function matchesClientIdentity(client: ClientRecord, identity: string | undefined) {
  const normalizedIdentity = identity ? normalizeSearch(identity) : "";
  const normalizedPhoneIdentity = identity ? normalizeClientPhone(identity) : "";

  return (
    (Boolean(normalizedIdentity) && normalizeSearch(client.id) === normalizedIdentity) ||
    (Boolean(normalizedIdentity) && normalizeSearch(client.name) === normalizedIdentity) ||
    (Boolean(normalizedPhoneIdentity) && normalizeClientPhone(client.phone) === normalizedPhoneIdentity)
  );
}

export function findClientByIdentity(clients: ClientRecord[], identity: string | undefined) {
  return clients.find((client) => matchesClientIdentity(client, identity));
}

export function findUniqueClientByName(clients: ClientRecord[], name: string | undefined) {
  const normalizedName = name ? normalizeSearch(name) : "";

  if (!normalizedName) {
    return undefined;
  }

  const matches = clients.filter((client) => normalizeSearch(client.name) === normalizedName);

  return matches.length === 1 ? matches[0] : undefined;
}

export function findAppointmentClient(clients: ClientRecord[], appointment: Appointment) {
  return findClientByIdentity(clients, appointment.clientId) ?? findUniqueClientByName(clients, appointment.client);
}

export function findCertificateClient(clients: ClientRecord[], certificate: CertificateRecord) {
  return findClientByIdentity(clients, certificate.clientId) ?? findUniqueClientByName(clients, certificate.clientName);
}

export function isClientNameAmbiguous(clients: ClientRecord[], clientName: string) {
  const normalizedClientName = normalizeSearch(clientName);

  return clients.filter((client) => normalizeSearch(client.name) === normalizedClientName).length > 1;
}

export function matchesClientName(value: string, clientName: string | undefined) {
  return !clientName || normalizeSearch(value) === normalizeSearch(clientName);
}

export function appointmentBelongsToClient(appointment: Appointment, client: ClientRecord, clients: ClientRecord[]) {
  if (appointment.clientId) {
    return appointment.clientId === client.id;
  }

  return !isClientNameAmbiguous(clients, client.name) && matchesClientName(appointment.client, client.name);
}

export function certificateBelongsToClient(certificate: CertificateRecord, client: ClientRecord, clients: ClientRecord[]) {
  if (certificate.clientId) {
    return certificate.clientId === client.id;
  }

  return !isClientNameAmbiguous(clients, client.name) && matchesClientName(certificate.clientName, client.name);
}

export function findClientAppointments(appointments: Appointment[], client: ClientRecord, clients: ClientRecord[]) {
  return appointments.filter((appointment) => appointmentBelongsToClient(appointment, client, clients));
}

export function findClientCertificates(certificates: CertificateRecord[], client: ClientRecord, clients: ClientRecord[]) {
  return certificates.filter((certificate) => certificateBelongsToClient(certificate, client, clients));
}

export function buildClientRecords(rows: readonly DemoClientRow[]): ClientRecord[] {
  return rows.map((client) => ({
    ...client,
    id: client.id ?? buildClientIdFromPhone(client.phone),
    history: client.history.map((visit) => ({ ...visit })),
    tags: [...client.tags],
  }));
}

function findInitialClientIdByName(clients: ClientRecord[], clientName: string) {
  return findUniqueClientByName(clients, clientName)?.id;
}

export function buildAppointmentRecords(rows: readonly DemoAppointmentRow[], clients: ClientRecord[]): Appointment[] {
  return rows.map((appointment, index) => ({
    ...appointment,
    clientId: appointment.clientId ?? findInitialClientIdByName(clients, appointment.client),
    id: appointment.id ?? `demo-${index + 1}`,
  }));
}

export function buildCertificateRecords(
  rows: readonly DemoCertificateRow[],
  clients: ClientRecord[],
  financeRows: readonly FinanceRow[],
): CertificateRecord[] {
  return rows.map((certificate, index) => {
    const financeRow = financeRows.find((row) => row.certificateCode === certificate.code);
    const paymentDate = certificate.paymentDate ?? financeRow?.date ?? "2026-07-01";

    return {
      amount: certificate.amount,
      buyer: certificate.buyer,
      clientId: certificate.clientId ?? findInitialClientIdByName(clients, certificate.clientName),
      clientName: certificate.clientName,
      code: certificate.code,
      expiresAt: certificate.expiresAt ?? addMonthsToIsoDate(paymentDate, 6),
      history: certificate.history
        ? [...certificate.history]
        : [
            `${paymentDate}: Stripe оплата связана с ${financeRow?.id ?? "manual"}.`,
            certificate.status === "Ожидает PDF" ? "PDF ожидает генерации." : "PDF готов к отправке.",
          ],
      note:
        certificate.note ??
        (index === 2
          ? "Проверить PDF перед повторной отправкой клиенту."
          : "Автоматически создан из оплаты Stripe."),
      paymentDate,
      recipient: certificate.recipient,
      status: certificate.status,
      stripeId: certificate.stripeId ?? financeRow?.id ?? "manual",
    };
  });
}

export function createAdminDemoRecords({
  appointmentRows,
  certificateRows,
  clientRows,
  financeRows,
}: {
  appointmentRows: readonly DemoAppointmentRow[];
  certificateRows: readonly DemoCertificateRow[];
  clientRows: readonly DemoClientRow[];
  financeRows: readonly FinanceRow[];
}): AdminDomainRecords {
  const clients = buildClientRecords(clientRows);

  return {
    appointments: buildAppointmentRecords(appointmentRows, clients),
    certificates: buildCertificateRecords(certificateRows, clients, financeRows),
    clients,
  };
}

export function buildAdminDatabaseSeed(records: AdminDomainRecords): AdminDatabaseSeed {
  return {
    appointments: records.appointments.map((appointment) => ({
      client_id: appointment.clientId ?? null,
      client_name_snapshot: appointment.client,
      id: appointment.id ?? `${appointment.date}-${appointment.time}-${appointment.client}`,
      internal_note: appointment.note,
      service_name: appointment.service,
      starts_at: appointment.time,
      starts_on: appointment.date,
      status: appointment.status,
    })),
    certificates: records.certificates.map((certificate) => ({
      amount_cents: parseEuroAmountToCents(certificate.amount),
      buyer_name: certificate.buyer,
      client_id: certificate.clientId ?? null,
      client_name_snapshot: certificate.clientName,
      code: certificate.code,
      currency: "EUR",
      expires_on: certificate.expiresAt,
      history: [...certificate.history],
      internal_note: certificate.note,
      paid_on: certificate.paymentDate,
      recipient_name: certificate.recipient,
      status: certificate.status,
      stripe_payment_intent_id: certificate.stripeId,
    })),
    clients: records.clients.map((client) => ({
      email: client.email,
      full_name: client.name,
      id: client.id,
      locale: client.language,
      next_visit_label: client.next,
      notes: client.note,
      phone: client.phone,
      phone_normalized: normalizeClientPhone(client.phone),
      preferred_contact: client.preferredContact,
      status: client.status,
      tags: [...client.tags],
      telegram_url: client.telegram,
      total_spend_label: client.totalSpend,
      visit_count: client.visits,
    })),
  };
}
