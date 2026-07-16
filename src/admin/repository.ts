import { AsyncLocalStorage } from "node:async_hooks";

import { resolveAdminRole, type FinanceRow, type FinanceSummary } from "./config";
import { normalizeClientPhone, parseEuroAmountToCents } from "./domain";
import type {
  AdminAppointmentDatabaseRow,
  AdminBlogPostDatabaseRow,
  AdminCalendarBlockDatabaseRow,
  AdminCertificateDatabaseRow,
  AdminClientDatabaseRow,
  AdminContactChannelDatabaseRow,
  AdminContactSettingsDatabaseRow,
  AdminDomainRecords,
  AdminMediaDatabaseRow,
  AdminMediaPlacementDatabaseRow,
  AdminPriceDatabaseRow,
  AdminProfileDatabaseRow,
  AdminServiceDatabaseRow,
  AdminServiceTranslationDatabaseRow,
  AdminSiteSettingsDatabaseRow,
  AdminSpecialistDatabaseRow,
  AdminUserRecord,
  AdminUserStatus,
  Appointment,
  AppointmentStatus,
  BlogPostRecord,
  BlogStatus,
  CalendarBlock,
  CalendarSyncMode,
  CertificateRecord,
  CertificateStatus,
  ClientRecord,
  ContactChannelRecord,
  ContactChannelType,
  ContactSettingsRecord,
  ContactStatus,
  MediaRecord,
  MediaPlacementRecord,
  MediaPublicationConsent,
  MediaStatus,
  MediaType,
  PriceRecord,
  PriceStatus,
  ServiceLocale,
  ServiceRecord,
  ServiceTranslationRecord,
  ServiceStatus,
  SettingsRecord,
  SpecialistRecord,
  StripeMode,
} from "./domain";

type SupabaseError = {
  message: string;
};

type SupabaseQueryResult<T> = {
  data: T[] | null;
  error: SupabaseError | null;
};

type SupabaseMutationResult = {
  error: SupabaseError | null;
};

export type AdminRepositoryAuditContext = {
  action?: string;
  actorUserId: string;
  metadata: Record<string, unknown>;
};

const adminRepositoryAuditContext = new AsyncLocalStorage<AdminRepositoryAuditContext>();

export function runWithAdminRepositoryAuditContext<T>(
  context: AdminRepositoryAuditContext,
  operation: () => T,
) {
  return adminRepositoryAuditContext.run(context, operation);
}

type AdminSupabaseSelectQuery<T> = PromiseLike<SupabaseQueryResult<T>> & {
  eq(column: string, value: unknown): AdminSupabaseSelectQuery<T>;
  gte(column: string, value: unknown): AdminSupabaseSelectQuery<T>;
  gt(column: string, value: unknown): AdminSupabaseSelectQuery<T>;
  lte(column: string, value: unknown): AdminSupabaseSelectQuery<T>;
  order(column: string, options?: { ascending?: boolean }): AdminSupabaseSelectQuery<T>;
  range(from: number, to: number): AdminSupabaseSelectQuery<T>;
};

type AdminSupabaseTable<T> = {
  insert(values: unknown): PromiseLike<SupabaseMutationResult>;
  select(columns: string): AdminSupabaseSelectQuery<T>;
  upsert(values: unknown, options?: { onConflict?: string }): PromiseLike<SupabaseMutationResult>;
};

export type AdminSupabaseClient = {
  from(table: string): AdminSupabaseTable<unknown>;
  rpc(functionName: string, parameters: Record<string, unknown>): PromiseLike<SupabaseMutationResult>;
};

export type AdminStripeSaleDatabaseRow = {
  buyer_name: string;
  certificate_code: string | null;
  gross_cents: number;
  paid_at: string;
  payment_intent_id: string;
  payment_status: string;
  refund_cents: number;
  stripe_fee_cents: number;
};

export type AdminFinancePeriod = {
  from: string;
  to: string;
};

export type AdminFinanceExportLogInput = {
  downloadedBy: string;
  exportFormat: "csv" | "pdf" | "xlsx";
  periodEnd: string;
  periodStart: string;
  summary: FinanceSummary;
};

export type AdminRepository = {
  listAppointments(specialistId?: string): Promise<Appointment[]>;
  listAdminUsers(): Promise<AdminUserRecord[]>;
  listBlogPosts(): Promise<BlogPostRecord[]>;
  listCalendarBlocks(specialistId?: string): Promise<CalendarBlock[]>;
  listCertificates(): Promise<CertificateRecord[]>;
  listClients(): Promise<ClientRecord[]>;
  listContactChannels(): Promise<ContactChannelRecord[]>;
  listMedia(): Promise<MediaRecord[]>;
  listPrices(): Promise<PriceRecord[]>;
  listServices(): Promise<ServiceRecord[]>;
  listSpecialists(): Promise<SpecialistRecord[]>;
  listStripeSales(period: AdminFinancePeriod): Promise<FinanceRow[]>;
  loadContactSettings(): Promise<ContactSettingsRecord | undefined>;
  loadDomainRecords(specialistId?: string): Promise<AdminDomainRecords>;
  loadSettings(): Promise<SettingsRecord | undefined>;
  logFinanceExport(input: AdminFinanceExportLogInput): Promise<void>;
  saveAppointment(appointment: Appointment, auditContext?: AdminRepositoryAuditContext): Promise<void>;
  saveBlogPost(post: BlogPostRecord, auditContext?: AdminRepositoryAuditContext): Promise<void>;
  saveCertificate(certificate: CertificateRecord, auditContext?: AdminRepositoryAuditContext): Promise<void>;
  saveClient(client: ClientRecord, auditContext?: AdminRepositoryAuditContext): Promise<void>;
  saveContactChannel(channel: ContactChannelRecord, auditContext?: AdminRepositoryAuditContext): Promise<void>;
  saveContactSettings(settings: ContactSettingsRecord, auditContext?: AdminRepositoryAuditContext): Promise<void>;
  saveMedia(media: MediaRecord, auditContext?: AdminRepositoryAuditContext): Promise<void>;
  savePrice(price: PriceRecord, auditContext?: AdminRepositoryAuditContext): Promise<void>;
  saveService(service: ServiceRecord, auditContext?: AdminRepositoryAuditContext): Promise<void>;
  saveSettings(settings: SettingsRecord, auditContext?: AdminRepositoryAuditContext): Promise<void>;
};

const clientColumns = [
  "id",
  "email",
  "full_name",
  "locale",
  "next_visit_label",
  "notes",
  "phone",
  "phone_normalized",
  "preferred_contact",
  "status",
  "tags",
  "telegram_url",
  "total_spend_label",
  "visit_count",
].join(", ");

const appointmentColumns = [
  "id",
  "buffer_minutes",
  "client_id",
  "client_name_snapshot",
  "duration_minutes",
  "internal_note",
  "locale",
  "origin",
  "overlap_override",
  "overlap_override_reason",
  "overlap_overridden_at",
  "overlap_overridden_by",
  "post_visit_comment",
  "post_visit_commented_at",
  "public_note",
  "public_contact_preference_snapshot",
  "public_email_snapshot",
  "public_phone_snapshot",
  "public_reference",
  "service_slug",
  "service_name",
  "specialist_id",
  "starts_at",
  "starts_on",
  "status",
  "version",
].join(", ");

const calendarBlockColumns = [
  "block_date",
  "ends_at",
  "id",
  "internal_note",
  "kind",
  "specialist_id",
  "starts_at",
  "version",
].join(", ");

const specialistColumns = [
  "color",
  "display_name",
  "display_order",
  "id",
  "public_booking_enabled",
  "status",
].join(", ");

const certificateColumns = [
  "code",
  "amount_cents",
  "buyer_name",
  "client_id",
  "client_name_snapshot",
  "currency",
  "expires_on",
  "history",
  "internal_note",
  "paid_on",
  "recipient_name",
  "status",
  "stripe_payment_intent_id",
].join(", ");

const stripeSaleColumns = [
  "buyer_name",
  "certificate_code",
  "gross_cents",
  "paid_at",
  "payment_intent_id",
  "payment_status",
  "refund_cents",
  "stripe_fee_cents",
].join(", ");

const serviceColumns = [
  "category",
  "cover_image_url",
  "cover_media_id",
  "display_order",
  "duration_label",
  "locale_codes",
  "name",
  "seo_title",
  "slug",
  "status",
  "summary",
].join(", ");

const serviceTranslationColumns = [
  "body",
  "canonical_url",
  "locale",
  "og_description",
  "og_image_media_id",
  "og_title",
  "robots_directives",
  "seo_description",
  "seo_title",
  "service_slug",
  "short_description",
  "status",
  "title",
].join(", ");

const priceColumns = [
  "currency",
  "display_order",
  "duration_minutes",
  "id",
  "internal_note",
  "price_cents",
  "service_slug",
  "status",
  "updated_on",
].join(", ");

const mediaColumns = [
  "alt_text",
  "alt_text_localized",
  "dimensions",
  "file_size_label",
  "folder",
  "id",
  "media_type",
  "name",
  "publication_consent_status",
  "status",
  "uploaded_on",
  "url",
  "usage_contexts",
].join(", ");

const mediaPlacementColumns = [
  "id",
  "is_published",
  "locale",
  "media_asset_id",
  "page_key",
  "placement_key",
  "publish_at",
  "slot_key",
  "sort_order",
].join(", ");

const contactChannelColumns = [
  "channel_type",
  "id",
  "internal_note",
  "name",
  "status",
  "usage_contexts",
  "value",
].join(", ");

const contactSettingsColumns = [
  "id",
  "address",
  "booking_url",
  "business_name",
  "email",
  "map_url",
  "phone",
  "seo_area",
  "working_hours",
].join(", ");

const adminProfileColumns = [
  "created_at",
  "display_name",
  "email",
  "last_login_at",
  "mfa_verified_at",
  "role",
  "status",
  "updated_at",
  "user_id",
].join(", ");

const blogPostColumns = [
  "id",
  "author",
  "body",
  "canonical_url",
  "category",
  "cover_alt_text",
  "cover_image_url",
  "cover_media_id",
  "editor_json",
  "excerpt",
  "hreflang",
  "locale_codes",
  "locale",
  "meta_description",
  "og_description",
  "og_image_media_id",
  "og_title",
  "published_at",
  "published_on",
  "robots_directives",
  "sanitized_html",
  "scheduled_for",
  "seo_title",
  "slug",
  "status",
  "tag_labels",
  "title",
  "updated_on",
].join(", ");

const siteSettingsColumns = [
  "id",
  "audit_log_retention_days",
  "booking_buffer_minutes",
  "booking_hold_minutes",
  "booking_horizon_days",
  "booking_min_lead_minutes",
  "booking_slot_step_minutes",
  "business_name",
  "cookie_privacy_mode",
  "currency",
  "daily_slot_capacity",
  "default_locale",
  "default_seo_title",
  "email_sender",
  "google_calendar_id",
  "google_calendar_mode",
  "gift_certificates_enabled",
  "public_booking_daily_limit",
  "public_booking_enabled",
  "reminder_template",
  "roles_policy",
  "stripe_mode",
  "timezone",
  "updated_on",
  "working_days",
  "working_hours",
].join(", ");

const serviceStatusByDatabase: Record<string, ServiceStatus> = {
  draft: "Черновик",
  hidden: "Скрыта",
  published: "Опубликована",
  Опубликована: "Опубликована",
  Скрыта: "Скрыта",
  Черновик: "Черновик",
};

const databaseServiceStatusByStatus = new Map<ServiceStatus, string>([
  [serviceStatusByDatabase.draft, "draft"],
  [serviceStatusByDatabase.hidden, "hidden"],
  [serviceStatusByDatabase.published, "published"],
]);

const priceStatusByDatabase: Record<string, PriceStatus> = {
  active: "Активна",
  hidden: "Скрыта",
  Активна: "Активна",
  Скрыта: "Скрыта",
};

const databasePriceStatusByStatus = new Map<PriceStatus, string>([
  [priceStatusByDatabase.active, "active"],
  [priceStatusByDatabase.hidden, "hidden"],
]);

const mediaTypeByDatabase: Record<string, MediaType> = {
  document: "Документ",
  photo: "Фото",
  Документ: "Документ",
  Фото: "Фото",
};

const databaseMediaTypeByType = new Map<MediaType, string>([
  [mediaTypeByDatabase.document, "document"],
  [mediaTypeByDatabase.photo, "photo"],
]);

const mediaStatusByDatabase: Record<string, MediaStatus> = {
  draft: "Черновик",
  needs_alt: "Требует alt",
  ready: "Готово",
  Готово: "Готово",
  "Требует alt": "Требует alt",
  Черновик: "Черновик",
};

const databaseMediaStatusByStatus = new Map<MediaStatus, string>([
  [mediaStatusByDatabase.draft, "draft"],
  [mediaStatusByDatabase.needs_alt, "needs_alt"],
  [mediaStatusByDatabase.ready, "ready"],
]);

const contactChannelTypeByDatabase: Record<string, ContactChannelType> = {
  booking: "Бронирование",
  email: "Email",
  map: "Карта",
  messenger: "Мессенджер",
  phone: "Телефон",
  social: "Соцсеть",
  Email: "Email",
  Бронирование: "Бронирование",
  Карта: "Карта",
  Мессенджер: "Мессенджер",
  Соцсеть: "Соцсеть",
  Телефон: "Телефон",
};

const databaseContactChannelTypeByType = new Map<ContactChannelType, string>([
  [contactChannelTypeByDatabase.booking, "booking"],
  [contactChannelTypeByDatabase.email, "email"],
  [contactChannelTypeByDatabase.map, "map"],
  [contactChannelTypeByDatabase.messenger, "messenger"],
  [contactChannelTypeByDatabase.phone, "phone"],
  [contactChannelTypeByDatabase.social, "social"],
]);

const contactStatusByDatabase: Record<string, ContactStatus> = {
  active: "Активен",
  draft: "Черновик",
  hidden: "Скрыт",
  Активен: "Активен",
  Скрыт: "Скрыт",
  Черновик: "Черновик",
};

const databaseContactStatusByStatus = new Map<ContactStatus, string>([
  [contactStatusByDatabase.active, "active"],
  [contactStatusByDatabase.draft, "draft"],
  [contactStatusByDatabase.hidden, "hidden"],
]);

const blogStatusByDatabase: Record<string, BlogStatus> = {
  draft: "Черновик",
  published: "Опубликована",
  review: "На проверке",
  scheduled: "Запланирована",
  "На проверке": "На проверке",
  Запланирована: "Запланирована",
  Опубликована: "Опубликована",
  Черновик: "Черновик",
};

const databaseBlogStatusByStatus = new Map<BlogStatus, string>([
  [blogStatusByDatabase.draft, "draft"],
  [blogStatusByDatabase.published, "published"],
  [blogStatusByDatabase.review, "review"],
  [blogStatusByDatabase.scheduled, "scheduled"],
]);

const calendarSyncModeByDatabase: Record<string, CalendarSyncMode> = {
  disabled: "Отключена",
  internal: "Внутренний календарь главный",
  one_way: "Односторонняя",
  two_way_later: "Двусторонняя позже",
  "Внутренний календарь главный": "Внутренний календарь главный",
  "Двусторонняя позже": "Двусторонняя позже",
  Односторонняя: "Односторонняя",
  Отключена: "Отключена",
};

const databaseCalendarSyncModeByMode = new Map<CalendarSyncMode, string>([
  [calendarSyncModeByDatabase.disabled, "disabled"],
  [calendarSyncModeByDatabase.internal, "internal"],
  [calendarSyncModeByDatabase.one_way, "one_way"],
  [calendarSyncModeByDatabase.two_way_later, "two_way_later"],
]);

const stripeModeByDatabase: Record<string, StripeMode> = {
  live_confirmed: "Live после подтверждения",
  test: "Тестовый",
  "Live после подтверждения": "Live после подтверждения",
  Тестовый: "Тестовый",
};

const databaseStripeModeByMode = new Map<StripeMode, string>([
  [stripeModeByDatabase.live_confirmed, "live_confirmed"],
  [stripeModeByDatabase.test, "test"],
]);

const adminUserStatusByDatabase: Record<string, AdminUserStatus> = {
  active: "Активен",
  invited: "Приглашен",
  suspended: "Заблокирован",
  Активен: "Активен",
  Заблокирован: "Заблокирован",
  Пауза: "Пауза",
  Приглашен: "Приглашен",
};

const appointmentStatusByDatabase: Record<string, AppointmentStatus> = {
  cancelled: "Отменена",
  completed: "Завершена",
  confirmed: "Подтверждена",
  no_show: "Не пришёл",
  pending: "Ожидает",
  request: "Новая заявка",
  "Новая заявка": "Новая заявка",
  Завершена: "Завершена",
  "Не пришёл": "Не пришёл",
  Ожидает: "Ожидает",
  Отменена: "Отменена",
  Подтверждена: "Подтверждена",
};

const databaseAppointmentStatusByStatus = new Map<AppointmentStatus, string>([
  [appointmentStatusByDatabase.cancelled, "cancelled"],
  [appointmentStatusByDatabase.completed, "completed"],
  [appointmentStatusByDatabase.confirmed, "confirmed"],
  [appointmentStatusByDatabase.no_show, "no_show"],
  [appointmentStatusByDatabase.pending, "pending"],
  [appointmentStatusByDatabase.request, "request"],
]);

const certificateStatusByDatabase: Record<string, CertificateStatus> = {
  paid: "Оплачено",
  pending_pdf: "Ожидает PDF",
  redeemed: "Погашен",
  sent: "Отправлен",
  Оплачено: "Оплачено",
  "Ожидает PDF": "Ожидает PDF",
  Отправлен: "Отправлен",
  Погашен: "Погашен",
};

const databaseCertificateStatusByStatus = new Map<CertificateStatus, string>([
  [certificateStatusByDatabase.paid, "paid"],
  [certificateStatusByDatabase.pending_pdf, "pending_pdf"],
  [certificateStatusByDatabase.redeemed, "redeemed"],
  [certificateStatusByDatabase.sent, "sent"],
]);

function toCents(value: number) {
  return Math.round(value * 100);
}

function fromCents(value: number) {
  return Math.round((value / 100 + Number.EPSILON) * 100) / 100;
}

function formatEuroCents(value: number, currency = "EUR") {
  const amount = fromCents(value);
  const label = Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  const symbol = currency === "EUR" ? "€" : currency;

  return `${label} ${symbol}`;
}

function normalizeTime(value: string) {
  return value.match(/^\d{2}:\d{2}/)?.[0] ?? value;
}

function startOfUtcDay(value: string) {
  return `${value.slice(0, 10)}T00:00:00.000Z`;
}

function endOfUtcDay(value: string) {
  return `${value.slice(0, 10)}T23:59:59.999Z`;
}

function mapAppointmentStatus(status: string): AppointmentStatus {
  return appointmentStatusByDatabase[status] ?? "Ожидает";
}

function mapAppointmentStatusToDatabase(status: AppointmentStatus) {
  return databaseAppointmentStatusByStatus.get(status) ?? "pending";
}

function mapCertificateStatus(status: string): CertificateStatus {
  return certificateStatusByDatabase[status] ?? "Оплачено";
}

function mapCertificateStatusToDatabase(status: CertificateStatus) {
  return databaseCertificateStatusByStatus.get(status) ?? "paid";
}

function mapServiceStatus(status: string): ServiceStatus {
  return serviceStatusByDatabase[status] ?? "Черновик";
}

function mapServiceStatusToDatabase(status: ServiceStatus) {
  return databaseServiceStatusByStatus.get(status) ?? "draft";
}

function mapPriceStatus(status: string): PriceStatus {
  return priceStatusByDatabase[status] ?? "Активна";
}

function mapPriceStatusToDatabase(status: PriceStatus) {
  return databasePriceStatusByStatus.get(status) ?? "active";
}

function mapMediaType(type: string): MediaType {
  return mediaTypeByDatabase[type] ?? "Фото";
}

function mapMediaTypeToDatabase(type: MediaType) {
  return databaseMediaTypeByType.get(type) ?? "photo";
}

function mapMediaStatus(status: string): MediaStatus {
  return mediaStatusByDatabase[status] ?? "Черновик";
}

function mapMediaStatusToDatabase(status: MediaStatus) {
  return databaseMediaStatusByStatus.get(status) ?? "draft";
}

function mapContactChannelType(type: string): ContactChannelType {
  return contactChannelTypeByDatabase[type] ?? "Телефон";
}

function mapContactChannelTypeToDatabase(type: ContactChannelType) {
  return databaseContactChannelTypeByType.get(type) ?? "phone";
}

function mapContactStatus(status: string): ContactStatus {
  return contactStatusByDatabase[status] ?? "Черновик";
}

function mapContactStatusToDatabase(status: ContactStatus) {
  return databaseContactStatusByStatus.get(status) ?? "draft";
}

function mapBlogStatus(status: string): BlogStatus {
  return blogStatusByDatabase[status] ?? "Черновик";
}

function mapBlogStatusToDatabase(status: BlogStatus) {
  return databaseBlogStatusByStatus.get(status) ?? "draft";
}

function mapCalendarSyncMode(mode: string): CalendarSyncMode {
  return calendarSyncModeByDatabase[mode] ?? "Внутренний календарь главный";
}

function mapCalendarSyncModeToDatabase(mode: CalendarSyncMode) {
  return databaseCalendarSyncModeByMode.get(mode) ?? "internal";
}

function mapStripeMode(mode: string): StripeMode {
  return stripeModeByDatabase[mode] ?? "Тестовый";
}

function mapStripeModeToDatabase(mode: StripeMode) {
  return databaseStripeModeByMode.get(mode) ?? "test";
}

function mapAdminUserStatus(status: string): AdminUserStatus {
  return adminUserStatusByDatabase[status] ?? "Приглашен";
}

function mapStripeStatus(row: Pick<AdminStripeSaleDatabaseRow, "gross_cents" | "refund_cents">): FinanceRow["status"] {
  if (row.refund_cents >= row.gross_cents && row.refund_cents > 0) {
    return "Возврат";
  }

  if (row.refund_cents > 0) {
    return "Частичный возврат";
  }

  return "Оплачено";
}

function mapClientRow(row: AdminClientDatabaseRow): ClientRecord {
  return {
    email: row.email,
    history: [],
    id: row.id,
    language: row.locale,
    name: row.full_name,
    next: row.next_visit_label,
    note: row.notes,
    phone: row.phone,
    preferredContact: row.preferred_contact,
    status: row.status,
    tags: [...row.tags],
    telegram: row.telegram_url,
    totalSpend: row.total_spend_label,
    visits: row.visit_count,
  };
}

function mapClientRecordToRow(client: ClientRecord): AdminClientDatabaseRow {
  return {
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
  };
}

function mapAppointmentRow(row: AdminAppointmentDatabaseRow): Appointment {
  return {
    bufferMinutes: row.buffer_minutes ?? 15,
    client: row.client_name_snapshot,
    clientId: row.client_id ?? undefined,
    date: row.starts_on,
    durationMinutes: row.duration_minutes,
    id: row.id,
    locale: row.locale ?? undefined,
    note: row.internal_note,
    origin: row.origin === "public" ? "public" : "admin",
    overlapOverride: row.overlap_override,
    overlapOverrideReason: row.overlap_override_reason,
    overlapOverriddenAt: row.overlap_overridden_at ?? undefined,
    overlapOverriddenBy: row.overlap_overridden_by ?? undefined,
    postVisitComment: row.post_visit_comment,
    postVisitCommentedAt: row.post_visit_commented_at ?? undefined,
    publicNote: row.public_note,
    publicContactPreference: row.public_contact_preference_snapshot ?? undefined,
    publicEmail: row.public_email_snapshot ?? undefined,
    publicPhone: row.public_phone_snapshot ?? undefined,
    publicReference: row.public_reference ?? undefined,
    service: row.service_name,
    serviceSlug: row.service_slug ?? undefined,
    specialistId: row.specialist_id ?? undefined,
    status: mapAppointmentStatus(row.status),
    time: normalizeTime(row.starts_at),
    version: row.version ?? 1,
  };
}

function mapCalendarBlockRow(row: AdminCalendarBlockDatabaseRow): CalendarBlock {
  return {
    blockDate: row.block_date,
    endsAt: normalizeTime(row.ends_at),
    id: row.id,
    internalNote: row.internal_note,
    kind: row.kind,
    specialistId: row.specialist_id ?? undefined,
    startsAt: normalizeTime(row.starts_at),
    version: row.version,
  };
}

function mapAppointmentRecordToRow(appointment: Appointment): AdminAppointmentDatabaseRow {
  if (!appointment.clientId) {
    throw new Error("admin_appointments: client_id is required");
  }

  const row: AdminAppointmentDatabaseRow = {
    buffer_minutes: appointment.bufferMinutes ?? 15,
    client_id: appointment.clientId,
    client_name_snapshot: appointment.client,
    duration_minutes: appointment.durationMinutes ?? 60,
    id: appointment.id ?? `${appointment.date}-${appointment.time}-${appointment.clientId}`,
    internal_note: appointment.note,
    overlap_override: appointment.overlapOverride ?? false,
    overlap_override_reason: appointment.overlapOverrideReason ?? "",
    overlap_overridden_at: appointment.overlapOverriddenAt ?? null,
    overlap_overridden_by: appointment.overlapOverriddenBy ?? null,
    post_visit_comment: appointment.postVisitComment ?? "",
    post_visit_commented_at: appointment.postVisitCommentedAt ?? null,
    service_name: appointment.service,
    starts_at: appointment.time,
    starts_on: appointment.date,
    status: mapAppointmentStatusToDatabase(appointment.status),
  };

  if (appointment.specialistId) row.specialist_id = appointment.specialistId;
  if (appointment.version !== undefined) row.version = appointment.version;

  return row;
}

function mapSpecialistRow(row: AdminSpecialistDatabaseRow): SpecialistRecord {
  return {
    color: row.color,
    displayName: row.display_name,
    displayOrder: row.display_order,
    id: row.id,
    publicBookingEnabled: row.public_booking_enabled,
    status: row.status,
  };
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 4 ? `${phone.slice(0, 4)}••••${digits.slice(-2)}` : "••••";
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@", 2);
  return domain ? `${local.slice(0, 1)}•••@${domain}` : "••••";
}

function restrictClientContact(client: ClientRecord): ClientRecord {
  return {
    ...client,
    contactRestricted: true,
    email: maskEmail(client.email),
    history: [],
    note: "",
    phone: maskPhone(client.phone),
    preferredContact: "Скрыто",
    tags: [],
    telegram: "",
    totalSpend: "—",
  };
}

function mapCertificateRow(row: AdminCertificateDatabaseRow): CertificateRecord {
  return {
    amount: formatEuroCents(row.amount_cents, row.currency),
    buyer: row.buyer_name,
    clientId: row.client_id ?? undefined,
    clientName: row.client_name_snapshot,
    code: row.code,
    expiresAt: row.expires_on,
    history: [...row.history],
    note: row.internal_note,
    paymentDate: row.paid_on,
    recipient: row.recipient_name,
    status: mapCertificateStatus(row.status),
    stripeId: row.stripe_payment_intent_id,
  };
}

function mapCertificateRecordToRow(certificate: CertificateRecord): AdminCertificateDatabaseRow {
  return {
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
    status: mapCertificateStatusToDatabase(certificate.status),
    stripe_payment_intent_id: certificate.stripeId,
  };
}

function mapServiceTranslationRow(row: AdminServiceTranslationDatabaseRow): ServiceTranslationRecord {
  return {
    body: row.body,
    canonicalUrl: row.canonical_url,
    locale: row.locale,
    ogDescription: row.og_description,
    ogImageMediaId: row.og_image_media_id ?? "",
    ogTitle: row.og_title,
    robotsDirectives: row.robots_directives,
    seoDescription: row.seo_description,
    seoTitle: row.seo_title,
    shortDescription: row.short_description,
    status: row.status,
    title: row.title,
  };
}

function mapServiceTranslationRecordToRow(
  serviceSlug: string,
  translation: ServiceTranslationRecord,
): AdminServiceTranslationDatabaseRow {
  return {
    body: translation.body,
    canonical_url: translation.canonicalUrl,
    locale: translation.locale,
    og_description: translation.ogDescription,
    og_image_media_id: translation.ogImageMediaId || null,
    og_title: translation.ogTitle,
    robots_directives: translation.robotsDirectives || "index,follow",
    seo_description: translation.seoDescription,
    seo_title: translation.seoTitle,
    service_slug: serviceSlug,
    short_description: translation.shortDescription,
    status: translation.status,
    title: translation.title,
  };
}

function mapServiceRow(
  row: AdminServiceDatabaseRow,
  translationRows: AdminServiceTranslationDatabaseRow[] = [],
): ServiceRecord {
  const translations = Object.fromEntries(
    translationRows
      .filter((translation) => translation.service_slug === row.slug)
      .map((translation) => [translation.locale, mapServiceTranslationRow(translation)]),
  ) as ServiceRecord["translations"];

  return {
    category: row.category,
    coverImage: row.cover_image_url,
    duration: row.duration_label,
    locales: [...row.locale_codes],
    name: row.name,
    order: row.display_order,
    seoTitle: row.seo_title,
    slug: row.slug,
    status: mapServiceStatus(row.status),
    summary: row.summary,
    translations,
  };
}

function mapServiceRecordToRow(service: ServiceRecord, coverMediaId: string | null = null): AdminServiceDatabaseRow {
  return {
    category: service.category,
    cover_image_url: service.coverImage,
    cover_media_id: coverMediaId,
    display_order: service.order,
    duration_label: service.duration,
    locale_codes: [...service.locales],
    name: service.name,
    seo_title: service.seoTitle,
    slug: service.slug,
    status: mapServiceStatusToDatabase(service.status),
    summary: service.summary,
  };
}

function mapPriceRow(row: AdminPriceDatabaseRow): PriceRecord {
  return {
    durationMinutes: row.duration_minutes,
    id: row.id,
    note: row.internal_note,
    order: row.display_order,
    priceEur: fromCents(row.price_cents),
    serviceSlug: row.service_slug,
    status: mapPriceStatus(row.status),
    updatedAt: row.updated_on,
  };
}

function mapPriceRecordToRow(price: PriceRecord): AdminPriceDatabaseRow {
  return {
    currency: "EUR",
    display_order: price.order,
    duration_minutes: price.durationMinutes,
    id: price.id,
    internal_note: price.note,
    price_cents: toCents(price.priceEur),
    service_slug: price.serviceSlug,
    status: mapPriceStatusToDatabase(price.status),
    updated_on: price.updatedAt,
  };
}

function mapMediaPlacementRow(row: AdminMediaPlacementDatabaseRow): MediaPlacementRecord {
  return {
    id: row.id,
    isPublished: row.is_published,
    locale: row.locale,
    mediaAssetId: row.media_asset_id,
    pageKey: row.page_key,
    placementKey: row.placement_key,
    publishAt: row.publish_at ?? null,
    slotKey: row.slot_key,
    sortOrder: row.sort_order,
  };
}

function mapMediaRow(
  row: AdminMediaDatabaseRow,
  placementRows: AdminMediaPlacementDatabaseRow[] = [],
): MediaRecord {
  const placements = placementRows
    .filter((placement) => placement.media_asset_id === row.id)
    .map(mapMediaPlacementRow);

  return {
    altText: row.alt_text,
    ...(row.alt_text_localized && Object.keys(row.alt_text_localized).length > 0
      ? { altTexts: { ...row.alt_text_localized } }
      : {}),
    dimensions: row.dimensions,
    folder: row.folder,
    id: row.id,
    name: row.name,
    placements,
    publicationConsent: (["unknown", "granted", "not_required", "denied"] as const).includes(
      row.publication_consent_status as MediaPublicationConsent,
    )
      ? (row.publication_consent_status as MediaPublicationConsent)
      : "unknown",
    size: row.file_size_label,
    status: mapMediaStatus(row.status),
    type: mapMediaType(row.media_type),
    uploadedAt: row.uploaded_on,
    url: row.url,
    usage: placements.length > 0
      ? placements.map((placement) => `${placement.placementKey}${placement.locale ? ` · ${placement.locale.toUpperCase()}` : ""}`)
      : [...row.usage_contexts],
  };
}

function mapMediaRecordToRow(media: MediaRecord): AdminMediaDatabaseRow {
  return {
    alt_text: media.altText,
    ...(media.altTexts ? { alt_text_localized: { ...media.altTexts } } : {}),
    dimensions: media.dimensions,
    file_size_label: media.size,
    folder: media.folder,
    id: media.id,
    media_type: mapMediaTypeToDatabase(media.type),
    name: media.name,
    publication_consent_status: media.publicationConsent ?? "unknown",
    status: mapMediaStatusToDatabase(media.status),
    uploaded_on: media.uploadedAt,
    url: media.url,
    usage_contexts: [...media.usage],
  };
}

function mapContactChannelRow(row: AdminContactChannelDatabaseRow): ContactChannelRecord {
  return {
    id: row.id,
    name: row.name,
    note: row.internal_note,
    status: mapContactStatus(row.status),
    type: mapContactChannelType(row.channel_type),
    usage: [...row.usage_contexts],
    value: row.value,
  };
}

function mapContactChannelRecordToRow(channel: ContactChannelRecord): AdminContactChannelDatabaseRow {
  return {
    channel_type: mapContactChannelTypeToDatabase(channel.type),
    id: channel.id,
    internal_note: channel.note,
    name: channel.name,
    status: mapContactStatusToDatabase(channel.status),
    usage_contexts: [...channel.usage],
    value: channel.value,
  };
}

function mapContactSettingsRow(row: AdminContactSettingsDatabaseRow): ContactSettingsRecord {
  return {
    address: row.address,
    bookingUrl: row.booking_url,
    businessName: row.business_name,
    email: row.email,
    mapUrl: row.map_url,
    phone: row.phone,
    seoArea: row.seo_area,
    workingHours: row.working_hours,
  };
}

function mapContactSettingsRecordToRow(settings: ContactSettingsRecord): AdminContactSettingsDatabaseRow {
  return {
    address: settings.address,
    booking_url: settings.bookingUrl,
    business_name: settings.businessName,
    email: settings.email,
    id: "site",
    map_url: settings.mapUrl,
    phone: settings.phone,
    seo_area: settings.seoArea,
    working_hours: settings.workingHours,
  };
}

function mapBlogPostRow(row: AdminBlogPostDatabaseRow): BlogPostRecord {
  return {
    author: row.author,
    body: row.sanitized_html || row.body,
    canonicalUrl: row.canonical_url,
    category: row.category,
    coverAlt: row.cover_alt_text || row.title,
    coverImage: row.cover_image_url,
    editorJson: row.editor_json ?? {},
    excerpt: row.excerpt,
    hreflang: row.hreflang ?? {},
    id: row.id,
    locales: row.locale ? [row.locale] : [...row.locale_codes],
    ogDescription: row.og_description,
    ogTitle: row.og_title,
    publishedAt: row.published_on ?? "",
    robotsDirectives: row.robots_directives,
    scheduledFor: row.scheduled_for ? sofiaUtcDateTimeToLocal(row.scheduled_for) : undefined,
    seoDescription: row.meta_description,
    seoTitle: row.seo_title,
    slug: row.slug,
    status: mapBlogStatus(row.status),
    tags: [...row.tag_labels],
    title: row.title,
    updatedAt: row.updated_on,
  };
}

const sofiaDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Sofia",
  year: "numeric",
});

export function sofiaUtcDateTimeToLocal(value: string) {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return undefined;

  const parts = Object.fromEntries(
    sofiaDateTimeFormatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}T${String(Number(parts.hour) % 24).padStart(2, "0")}:${parts.minute}`;
}

export function sofiaLocalDateTimeToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const desiredUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  let instant = desiredUtc;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = Object.fromEntries(
      sofiaDateTimeFormatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
    );
    const observedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
    );
    instant += desiredUtc - observedUtc;
  }

  const isoValue = new Date(instant).toISOString();

  return sofiaUtcDateTimeToLocal(isoValue) === value ? isoValue : null;
}

function mapBlogPostRecordToRow(post: BlogPostRecord, mediaAssetId: string | null = null): AdminBlogPostDatabaseRow {
  return {
    author: post.author,
    body: post.body,
    canonical_url: post.canonicalUrl || `/${post.locales[0] ?? "bg"}/blog/${post.slug}`,
    category: post.category,
    cover_alt_text: post.coverAlt || post.title,
    cover_image_url: post.coverImage,
    cover_media_id: mediaAssetId,
    editor_json: post.editorJson ?? { html: post.body, type: "html", version: 1 },
    excerpt: post.excerpt,
    id: post.id,
    hreflang: post.hreflang ?? {},
    locale_codes: [...post.locales],
    locale: post.locales[0] ?? "bg",
    meta_description: post.seoDescription || post.excerpt,
    og_description: post.ogDescription || post.excerpt,
    og_image_media_id: mediaAssetId,
    og_title: post.ogTitle || post.seoTitle || post.title,
    published_at: post.status === "Опубликована" && post.publishedAt ? `${post.publishedAt}T00:00:00Z` : null,
    published_on: post.publishedAt.trim() || null,
    robots_directives: post.robotsDirectives || (post.status === "Опубликована" ? "index,follow" : "noindex,nofollow"),
    sanitized_html: post.body,
    scheduled_for: post.status === "Запланирована" && post.scheduledFor
      ? sofiaLocalDateTimeToIso(post.scheduledFor)
      : null,
    seo_title: post.seoTitle,
    slug: post.slug,
    status: mapBlogStatusToDatabase(post.status),
    tag_labels: [...post.tags],
    title: post.title,
    updated_on: post.updatedAt,
  };
}

function mapSettingsRow(row: AdminSiteSettingsDatabaseRow): SettingsRecord {
  return {
    auditLogRetentionDays: row.audit_log_retention_days,
    bookingBufferMinutes: row.booking_buffer_minutes,
    bookingHoldMinutes: row.booking_hold_minutes ?? 5,
    bookingHorizonDays: row.booking_horizon_days ?? 60,
    bookingMinLeadMinutes: row.booking_min_lead_minutes ?? 30,
    bookingSlotStepMinutes: row.booking_slot_step_minutes ?? 30,
    businessName: row.business_name,
    cookiePrivacyMode: row.cookie_privacy_mode,
    currency: row.currency,
    dailySlotCapacity: row.daily_slot_capacity,
    defaultLocale: row.default_locale,
    defaultSeoTitle: row.default_seo_title,
    emailSender: row.email_sender,
    googleCalendarId: row.google_calendar_id,
    googleCalendarMode: mapCalendarSyncMode(row.google_calendar_mode),
    giftCertificatesEnabled: row.gift_certificates_enabled,
    publicBookingDailyLimit: row.public_booking_daily_limit ?? 8,
    publicBookingEnabled: row.public_booking_enabled ?? false,
    reminderTemplate: row.reminder_template,
    rolesPolicy: row.roles_policy,
    stripeMode: mapStripeMode(row.stripe_mode),
    timezone: row.timezone,
    updatedAt: row.updated_on,
    workingDays: row.working_days,
    workingHours: row.working_hours,
  };
}

function mapSettingsRecordToRow(settings: SettingsRecord): AdminSiteSettingsDatabaseRow {
  return {
    audit_log_retention_days: settings.auditLogRetentionDays,
    booking_buffer_minutes: settings.bookingBufferMinutes,
    booking_hold_minutes: settings.bookingHoldMinutes ?? 5,
    booking_horizon_days: settings.bookingHorizonDays ?? 60,
    booking_min_lead_minutes: settings.bookingMinLeadMinutes ?? 30,
    booking_slot_step_minutes: settings.bookingSlotStepMinutes ?? 30,
    business_name: settings.businessName,
    cookie_privacy_mode: settings.cookiePrivacyMode,
    currency: settings.currency,
    daily_slot_capacity: settings.dailySlotCapacity,
    default_locale: settings.defaultLocale,
    default_seo_title: settings.defaultSeoTitle,
    email_sender: settings.emailSender,
    google_calendar_id: settings.googleCalendarId,
    google_calendar_mode: mapCalendarSyncModeToDatabase(settings.googleCalendarMode),
    gift_certificates_enabled: settings.giftCertificatesEnabled !== false,
    id: "site",
    public_booking_daily_limit: settings.publicBookingDailyLimit ?? settings.dailySlotCapacity,
    public_booking_enabled: settings.publicBookingEnabled ?? false,
    reminder_template: settings.reminderTemplate,
    roles_policy: settings.rolesPolicy,
    stripe_mode: mapStripeModeToDatabase(settings.stripeMode),
    timezone: settings.timezone,
    updated_on: settings.updatedAt,
    working_days: settings.workingDays,
    working_hours: settings.workingHours,
  };
}

function formatAdminProfileTimestamp(value: string | null) {
  return value ? value.slice(0, 16).replace("T", " ") : "Еще не входил";
}

function mapAdminProfileRow(row: AdminProfileDatabaseRow): AdminUserRecord {
  const lastLogin = formatAdminProfileTimestamp(row.last_login_at);

  return {
    accessNote: "Профиль Supabase Auth управляется владельцем.",
    email: row.email,
    history: row.last_login_at ? [`${lastLogin}: последний успешный вход`] : ["Пользователь приглашен через Supabase Auth."],
    id: row.user_id,
    lastLogin,
    name: row.display_name,
    role: resolveAdminRole(row.role),
    status: mapAdminUserStatus(row.status),
    twoFactor: Boolean(row.mfa_verified_at),
  };
}

function mapStripeSaleRow(row: AdminStripeSaleDatabaseRow): FinanceRow {
  return {
    buyer: row.buyer_name,
    certificateCode: row.certificate_code ?? undefined,
    date: row.paid_at.slice(0, 10),
    gross: fromCents(row.gross_cents),
    id: row.payment_intent_id,
    refund: fromCents(row.refund_cents),
    status: mapStripeStatus(row),
    stripeFee: fromCents(row.stripe_fee_cents),
  };
}

function addAppointmentHistories(clients: ClientRecord[], appointments: Appointment[]): ClientRecord[] {
  return clients.map((client) => ({
    ...client,
    history: appointments
      .filter((appointment) => appointment.clientId === client.id)
      .map((appointment) => ({
        date: `${appointment.date} ${appointment.time}`,
        service: appointment.service,
        status: appointment.status,
      })),
  }));
}

async function selectRows<T>(
  client: AdminSupabaseClient,
  table: string,
  columns: string,
  configure: (query: AdminSupabaseSelectQuery<T>) => AdminSupabaseSelectQuery<T>,
) {
  const query = configure(client.from(table).select(columns) as AdminSupabaseSelectQuery<T>);
  const { data, error } = await query;

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return data ?? [];
}

const SUPABASE_SELECT_PAGE_SIZE = 1000;

async function selectAllRowsById<T extends { id: string }>(
  client: AdminSupabaseClient,
  table: string,
  columns: string,
) {
  const rows: T[] = [];
  let lastId: string | undefined;

  for (;;) {
    let query = client.from(table).select(columns) as AdminSupabaseSelectQuery<T>;

    if (lastId !== undefined) {
      query = query.gt("id", lastId);
    }

    query = query.order("id", { ascending: true }).range(0, SUPABASE_SELECT_PAGE_SIZE - 1);
    const { data, error } = await query;

    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }

    const page = data ?? [];

    if (page.length === 0) {
      return rows;
    }

    rows.push(...page);
    lastId = page[page.length - 1].id;
  }
}

async function insertRow(client: AdminSupabaseClient, table: string, values: unknown) {
  const { error } = await client.from(table).insert(values);

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
}

async function callRpc(
  client: AdminSupabaseClient,
  functionName: string,
  parameters: Record<string, unknown>,
) {
  const { error } = await client.rpc(functionName, parameters);

  if (error) {
    throw new Error(`${functionName}: ${error.message}`);
  }
}

export function createAdminSupabaseRepository(client: AdminSupabaseClient): AdminRepository {
  async function listAdminUsers() {
    const rows = await selectRows<AdminProfileDatabaseRow>(client, "admin_profiles", adminProfileColumns, (query) =>
      query.order("display_name", { ascending: true }),
    );

    return rows.map(mapAdminProfileRow);
  }

  async function listClients() {
    const rows = await selectAllRowsById<AdminClientDatabaseRow>(client, "admin_clients", clientColumns);
    rows.sort((left, right) => left.full_name.localeCompare(right.full_name) || left.id.localeCompare(right.id));

    return rows.map(mapClientRow);
  }

  async function listAppointments(specialistId?: string) {
    const rows = await selectRows<AdminAppointmentDatabaseRow>(client, "admin_appointments", appointmentColumns, (query) =>
      (specialistId ? query.eq("specialist_id", specialistId) : query).order("starts_on", { ascending: true }),
    );

    return rows.map(mapAppointmentRow);
  }

  async function listCalendarBlocks(specialistId?: string) {
    const rows = await selectRows<AdminCalendarBlockDatabaseRow>(
      client,
      "admin_calendar_blocks",
      calendarBlockColumns,
      (query) => (specialistId ? query.eq("specialist_id", specialistId) : query).order("block_date", { ascending: true }),
    );

    return rows.map(mapCalendarBlockRow);
  }

  async function listCertificates() {
    const rows = await selectRows<AdminCertificateDatabaseRow>(client, "admin_certificates", certificateColumns, (query) =>
      query.order("paid_on", { ascending: false }),
    );

    return rows.map(mapCertificateRow);
  }

  async function listServices() {
    const rows = await selectRows<AdminServiceDatabaseRow>(client, "admin_services", serviceColumns, (query) =>
      query.order("display_order", { ascending: true }),
    );
    const translationRows = await selectRows<AdminServiceTranslationDatabaseRow>(
      client,
      "admin_service_translations",
      serviceTranslationColumns,
      (query) => query.order("locale", { ascending: true }),
    );

    return rows.map((row) => mapServiceRow(row, translationRows));
  }

  async function listSpecialists() {
    const rows = await selectRows<AdminSpecialistDatabaseRow>(client, "admin_specialists", specialistColumns, (query) =>
      query.order("display_order", { ascending: true }),
    );

    return rows.map(mapSpecialistRow);
  }

  async function listPrices() {
    const rows = await selectRows<AdminPriceDatabaseRow>(client, "admin_price_variants", priceColumns, (query) =>
      query.order("display_order", { ascending: true }),
    );

    return rows.map(mapPriceRow);
  }

  async function listMedia() {
    const rows = await selectRows<AdminMediaDatabaseRow>(client, "admin_media_assets", mediaColumns, (query) =>
      query.order("uploaded_on", { ascending: false }),
    );
    const placementRows = await selectRows<AdminMediaPlacementDatabaseRow>(
      client,
      "admin_media_placements",
      mediaPlacementColumns,
      (query) => query.order("sort_order", { ascending: true }),
    );

    return rows.map((row) => mapMediaRow(row, placementRows));
  }

  async function listContactChannels() {
    const rows = await selectRows<AdminContactChannelDatabaseRow>(client, "admin_contact_channels", contactChannelColumns, (query) =>
      query.order("name", { ascending: true }),
    );

    return rows.map(mapContactChannelRow);
  }

  async function loadContactSettings() {
    const rows = await selectRows<AdminContactSettingsDatabaseRow>(client, "admin_contact_settings", contactSettingsColumns, (query) =>
      query.eq("id", "site"),
    );

    return rows[0] ? mapContactSettingsRow(rows[0]) : undefined;
  }

  async function listBlogPosts() {
    const rows = await selectRows<AdminBlogPostDatabaseRow>(client, "admin_blog_posts", blogPostColumns, (query) =>
      query.order("published_on", { ascending: false }),
    );

    return rows.map(mapBlogPostRow);
  }

  async function loadSettings() {
    const rows = await selectRows<AdminSiteSettingsDatabaseRow>(client, "admin_site_settings", siteSettingsColumns, (query) =>
      query.eq("id", "site"),
    );

    return rows[0] ? mapSettingsRow(rows[0]) : undefined;
  }

  async function loadDomainRecords(specialistId?: string) {
    const allClients = await listClients();
    const [appointments, calendarBlocks, specialists] = await Promise.all([
      listAppointments(specialistId),
      listCalendarBlocks(specialistId),
      listSpecialists(),
    ]);
    const assignedClientIds = new Set(appointments.map((appointment) => appointment.clientId).filter(Boolean));
    const clients = specialistId
      ? allClients.filter((clientRecord) => assignedClientIds.has(clientRecord.id)).map(restrictClientContact)
      : allClients;
    const certificates = specialistId ? [] : await listCertificates();
    const specialistNames = new Map(specialists.map((specialist) => [specialist.id, specialist.displayName]));
    const namedAppointments = appointments.map((appointment) => ({
      ...appointment,
      specialistName: appointment.specialistId ? specialistNames.get(appointment.specialistId) : undefined,
      ...(specialistId
        ? {
            publicEmail: maskEmail(appointment.publicEmail ?? ""),
            publicPhone: maskPhone(appointment.publicPhone ?? ""),
          }
        : {}),
    }));
    const namedCalendarBlocks = calendarBlocks.map((block) => ({
      ...block,
      specialistName: block.specialistId ? specialistNames.get(block.specialistId) : undefined,
    }));

    return {
      appointments: namedAppointments,
      calendarBlocks: namedCalendarBlocks,
      certificates,
      clients: specialistId ? clients : addAppointmentHistories(clients, appointments),
      specialists,
    };
  }

  async function listStripeSales(period: AdminFinancePeriod) {
    const rows = await selectRows<AdminStripeSaleDatabaseRow>(client, "admin_stripe_sales", stripeSaleColumns, (query) =>
      query
        .gte("paid_at", startOfUtcDay(period.from))
        .lte("paid_at", endOfUtcDay(period.to))
        .order("paid_at", { ascending: true }),
    );

    return rows.map(mapStripeSaleRow);
  }

  async function logFinanceExport(input: AdminFinanceExportLogInput) {
    await insertRow(client, "admin_finance_export_audit", {
      downloaded_by: input.downloadedBy,
      export_format: input.exportFormat,
      gross_cents: toCents(input.summary.gross),
      net_cents: toCents(input.summary.net),
      period_end: input.periodEnd,
      period_start: input.periodStart,
      refund_cents: toCents(input.summary.refunds),
      row_count: input.summary.payments,
      stripe_fee_cents: toCents(input.summary.stripeFees),
    });
  }

  async function saveRecordWithAudit(
    recordType: "appointment" | "certificate" | "client" | "contactChannel" | "contactSettings" | "media" | "price" | "settings",
    record: object,
    auditContext?: AdminRepositoryAuditContext,
  ) {
    const verifiedAuditContext = auditContext ?? adminRepositoryAuditContext.getStore();
    if (!verifiedAuditContext) {
      throw new Error("admin_save_record_with_audit: verified actor is required");
    }
    const defaultActionByRecordType: Record<typeof recordType, string> = {
      appointment: "appointment.update",
      certificate: "record.certificate.upsert",
      client: "record.client.upsert",
      contactChannel: "record.contactChannel.upsert",
      contactSettings: "record.contactSettings.upsert",
      media: "media.asset",
      price: "record.price.upsert",
      settings: "site.gift_certificates",
    };

    await callRpc(client, "admin_save_record_with_audit", {
      p_action: verifiedAuditContext.action ?? defaultActionByRecordType[recordType],
      p_actor_user_id: verifiedAuditContext.actorUserId,
      p_audit_metadata: verifiedAuditContext.metadata,
      p_record: record,
      p_record_type: recordType,
    });
  }

  async function saveClient(clientRecord: ClientRecord, auditContext?: AdminRepositoryAuditContext) {
    await saveRecordWithAudit("client", mapClientRecordToRow(clientRecord), auditContext);
  }

  async function saveAppointment(appointment: Appointment, auditContext?: AdminRepositoryAuditContext) {
    const record = mapAppointmentRecordToRow(appointment);
    const verifiedAuditContext = auditContext ?? adminRepositoryAuditContext.getStore();
    if (!verifiedAuditContext) {
      throw new Error("admin_save_appointment_with_audit: verified actor is required");
    }

    await callRpc(client, "admin_save_appointment_with_audit", {
      p_action: verifiedAuditContext.action ?? "appointment.update",
      p_actor_user_id: verifiedAuditContext.actorUserId,
      p_audit_metadata: verifiedAuditContext.metadata,
      p_record: record,
    });
  }

  async function saveCertificate(certificate: CertificateRecord, auditContext?: AdminRepositoryAuditContext) {
    await saveRecordWithAudit("certificate", mapCertificateRecordToRow(certificate), auditContext);
  }

  async function saveService(service: ServiceRecord, auditContext?: AdminRepositoryAuditContext) {
    const mediaRows = service.coverImage
      ? await selectRows<{ id: string }>(client, "admin_media_assets", "id", (query) => query.eq("url", service.coverImage))
      : [];
    const coverMediaId = mediaRows[0]?.id ?? null;

    if (service.status === "Опубликована" && !coverMediaId) {
      throw new Error("admin_services: published cover must reference a media-library asset");
    }

    const verifiedAuditContext = auditContext ?? adminRepositoryAuditContext.getStore();
    if (!verifiedAuditContext) {
      throw new Error("admin_save_service_aggregate: verified actor is required");
    }

    const translations = Object.values(service.translations ?? {})
      .filter((translation): translation is ServiceTranslationRecord => Boolean(translation))
      .map((translation) => mapServiceTranslationRecordToRow(service.slug, translation));
    const placements = coverMediaId
      ? Object.keys(service.translations ?? {}).map((locale) => ({
          caption_localized: { [locale]: service.translations?.[locale as ServiceLocale]?.title ?? service.name },
          is_published: service.status === "Опубликована",
          locale,
          media_asset_id: coverMediaId,
          page_key: `service:${service.slug}`,
          placement_key: `service:${service.slug}:cover`,
          publish_at: null,
          slot_key: "cover",
          sort_order: 0,
        }))
      : [];
    await callRpc(client, "admin_save_service_aggregate", {
      p_actor_user_id: verifiedAuditContext.actorUserId,
      p_audit_metadata: verifiedAuditContext.metadata,
      p_placements: placements,
      p_service: mapServiceRecordToRow(service, coverMediaId),
      p_translations: translations,
    });
  }

  async function savePrice(price: PriceRecord, auditContext?: AdminRepositoryAuditContext) {
    await saveRecordWithAudit("price", mapPriceRecordToRow(price), auditContext);
  }

  async function saveMedia(media: MediaRecord, auditContext?: AdminRepositoryAuditContext) {
    await saveRecordWithAudit("media", mapMediaRecordToRow(media), auditContext);
  }

  async function saveContactChannel(channel: ContactChannelRecord, auditContext?: AdminRepositoryAuditContext) {
    await saveRecordWithAudit("contactChannel", mapContactChannelRecordToRow(channel), auditContext);
  }

  async function saveContactSettings(settings: ContactSettingsRecord, auditContext?: AdminRepositoryAuditContext) {
    await saveRecordWithAudit("contactSettings", mapContactSettingsRecordToRow(settings), auditContext);
  }

  async function saveBlogPost(post: BlogPostRecord, auditContext?: AdminRepositoryAuditContext) {
    const mediaRows = post.coverImage
      ? await selectRows<{ id: string }>(client, "admin_media_assets", "id", (query) => query.eq("url", post.coverImage))
      : [];
    const mediaAssetId = mediaRows[0]?.id ?? null;
    const postRow = mapBlogPostRecordToRow(post, mediaAssetId);

    if ((post.status === "Опубликована" || post.status === "Запланирована") && !mediaAssetId) {
      throw new Error("admin_blog_posts: publication cover must reference a media-library asset");
    }
    if (post.status === "Запланирована" && !postRow.scheduled_for) {
      throw new Error("admin_blog_posts: scheduled time must be a valid Europe/Sofia local time");
    }

    const verifiedAuditContext = auditContext ?? adminRepositoryAuditContext.getStore();
    if (!verifiedAuditContext) {
      throw new Error("admin_save_blog_post_aggregate: verified actor is required");
    }

    const locale = post.locales[0] ?? "bg";
    const placement = mediaAssetId
      ? {
          caption_localized: { [locale]: post.title },
          is_published: post.status === "Опубликована" || post.status === "Запланирована",
          locale,
          media_asset_id: mediaAssetId,
          page_key: `blog:${post.id}`,
          placement_key: `blog:${post.id}:cover`,
          publish_at: postRow.scheduled_for,
          slot_key: "cover",
          sort_order: 0,
        }
      : null;
    await callRpc(client, "admin_save_blog_post_aggregate", {
      p_actor_user_id: verifiedAuditContext.actorUserId,
      p_audit_metadata: verifiedAuditContext.metadata,
      p_placement: placement,
      p_post: postRow,
    });
  }

  async function saveSettings(settings: SettingsRecord, auditContext?: AdminRepositoryAuditContext) {
    const verifiedAuditContext = auditContext ?? adminRepositoryAuditContext.getStore();
    if (!verifiedAuditContext) {
      throw new Error("admin_save_booking_settings_with_audit: verified actor is required");
    }

    await callRpc(client, "admin_save_booking_settings_with_audit", {
      p_actor_user_id: verifiedAuditContext.actorUserId,
      p_settings: mapSettingsRecordToRow(settings),
    });
  }

  return {
    listAppointments,
    listAdminUsers,
    listBlogPosts,
    listCalendarBlocks,
    listCertificates,
    listClients,
    listContactChannels,
    listMedia,
    listPrices,
    listServices,
    listSpecialists,
    listStripeSales,
    loadContactSettings,
    loadDomainRecords,
    loadSettings,
    logFinanceExport,
    saveAppointment,
    saveBlogPost,
    saveCertificate,
    saveClient,
    saveContactChannel,
    saveContactSettings,
    saveMedia,
    savePrice,
    saveService,
    saveSettings,
  };
}
