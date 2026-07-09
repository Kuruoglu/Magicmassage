import { resolveAdminRole, type FinanceRow, type FinanceSummary } from "./config";
import { normalizeClientPhone, parseEuroAmountToCents } from "./domain";
import type {
  AdminAppointmentDatabaseRow,
  AdminBlogPostDatabaseRow,
  AdminCertificateDatabaseRow,
  AdminClientDatabaseRow,
  AdminContactChannelDatabaseRow,
  AdminContactSettingsDatabaseRow,
  AdminDomainRecords,
  AdminMediaDatabaseRow,
  AdminPriceDatabaseRow,
  AdminProfileDatabaseRow,
  AdminServiceDatabaseRow,
  AdminSiteSettingsDatabaseRow,
  AdminUserRecord,
  AdminUserStatus,
  Appointment,
  AppointmentStatus,
  BlogPostRecord,
  BlogStatus,
  CalendarSyncMode,
  CertificateRecord,
  CertificateStatus,
  ClientRecord,
  ContactChannelRecord,
  ContactChannelType,
  ContactSettingsRecord,
  ContactStatus,
  MediaRecord,
  MediaStatus,
  MediaType,
  PriceRecord,
  PriceStatus,
  ServiceRecord,
  ServiceStatus,
  SettingsRecord,
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

type AdminSupabaseSelectQuery<T> = PromiseLike<SupabaseQueryResult<T>> & {
  eq(column: string, value: unknown): AdminSupabaseSelectQuery<T>;
  gte(column: string, value: unknown): AdminSupabaseSelectQuery<T>;
  lte(column: string, value: unknown): AdminSupabaseSelectQuery<T>;
  order(column: string, options?: { ascending?: boolean }): AdminSupabaseSelectQuery<T>;
};

type AdminSupabaseTable<T> = {
  insert(values: unknown): PromiseLike<SupabaseMutationResult>;
  select(columns: string): AdminSupabaseSelectQuery<T>;
  upsert(values: unknown, options?: { onConflict?: string }): PromiseLike<SupabaseMutationResult>;
};

export type AdminSupabaseClient = {
  from(table: string): AdminSupabaseTable<unknown>;
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
  listAppointments(): Promise<Appointment[]>;
  listAdminUsers(): Promise<AdminUserRecord[]>;
  listBlogPosts(): Promise<BlogPostRecord[]>;
  listCertificates(): Promise<CertificateRecord[]>;
  listClients(): Promise<ClientRecord[]>;
  listContactChannels(): Promise<ContactChannelRecord[]>;
  listMedia(): Promise<MediaRecord[]>;
  listPrices(): Promise<PriceRecord[]>;
  listServices(): Promise<ServiceRecord[]>;
  listStripeSales(period: AdminFinancePeriod): Promise<FinanceRow[]>;
  loadContactSettings(): Promise<ContactSettingsRecord | undefined>;
  loadDomainRecords(): Promise<AdminDomainRecords>;
  loadSettings(): Promise<SettingsRecord | undefined>;
  logFinanceExport(input: AdminFinanceExportLogInput): Promise<void>;
  saveAppointment(appointment: Appointment): Promise<void>;
  saveBlogPost(post: BlogPostRecord): Promise<void>;
  saveCertificate(certificate: CertificateRecord): Promise<void>;
  saveClient(client: ClientRecord): Promise<void>;
  saveContactChannel(channel: ContactChannelRecord): Promise<void>;
  saveContactSettings(settings: ContactSettingsRecord): Promise<void>;
  saveMedia(media: MediaRecord): Promise<void>;
  savePrice(price: PriceRecord): Promise<void>;
  saveService(service: ServiceRecord): Promise<void>;
  saveSettings(settings: SettingsRecord): Promise<void>;
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
  "client_id",
  "client_name_snapshot",
  "internal_note",
  "service_name",
  "starts_at",
  "starts_on",
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
  "display_order",
  "duration_label",
  "locale_codes",
  "name",
  "seo_title",
  "slug",
  "status",
  "summary",
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
  "dimensions",
  "file_size_label",
  "folder",
  "id",
  "media_type",
  "name",
  "status",
  "uploaded_on",
  "url",
  "usage_contexts",
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
  "role",
  "status",
  "updated_at",
  "user_id",
].join(", ");

const blogPostColumns = [
  "id",
  "author",
  "body",
  "category",
  "cover_image_url",
  "excerpt",
  "locale_codes",
  "published_on",
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
  "business_name",
  "cookie_privacy_mode",
  "currency",
  "daily_slot_capacity",
  "default_locale",
  "default_seo_title",
  "email_sender",
  "google_calendar_id",
  "google_calendar_mode",
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
  confirmed: "Подтверждена",
  pending: "Ожидает",
  request: "Новая заявка",
  "Новая заявка": "Новая заявка",
  Ожидает: "Ожидает",
  Отменена: "Отменена",
  Подтверждена: "Подтверждена",
};

const databaseAppointmentStatusByStatus = new Map<AppointmentStatus, string>([
  [appointmentStatusByDatabase.cancelled, "cancelled"],
  [appointmentStatusByDatabase.confirmed, "confirmed"],
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
    client: row.client_name_snapshot,
    clientId: row.client_id ?? undefined,
    date: row.starts_on,
    id: row.id,
    note: row.internal_note,
    service: row.service_name,
    status: mapAppointmentStatus(row.status),
    time: normalizeTime(row.starts_at),
  };
}

function mapAppointmentRecordToRow(appointment: Appointment): AdminAppointmentDatabaseRow {
  if (!appointment.clientId) {
    throw new Error("admin_appointments: client_id is required");
  }

  return {
    client_id: appointment.clientId,
    client_name_snapshot: appointment.client,
    id: appointment.id ?? `${appointment.date}-${appointment.time}-${appointment.clientId}`,
    internal_note: appointment.note,
    service_name: appointment.service,
    starts_at: appointment.time,
    starts_on: appointment.date,
    status: mapAppointmentStatusToDatabase(appointment.status),
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

function mapServiceRow(row: AdminServiceDatabaseRow): ServiceRecord {
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
  };
}

function mapServiceRecordToRow(service: ServiceRecord): AdminServiceDatabaseRow {
  return {
    category: service.category,
    cover_image_url: service.coverImage,
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

function mapMediaRow(row: AdminMediaDatabaseRow): MediaRecord {
  return {
    altText: row.alt_text,
    dimensions: row.dimensions,
    folder: row.folder,
    id: row.id,
    name: row.name,
    size: row.file_size_label,
    status: mapMediaStatus(row.status),
    type: mapMediaType(row.media_type),
    uploadedAt: row.uploaded_on,
    url: row.url,
    usage: [...row.usage_contexts],
  };
}

function mapMediaRecordToRow(media: MediaRecord): AdminMediaDatabaseRow {
  return {
    alt_text: media.altText,
    dimensions: media.dimensions,
    file_size_label: media.size,
    folder: media.folder,
    id: media.id,
    media_type: mapMediaTypeToDatabase(media.type),
    name: media.name,
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
    body: row.body,
    category: row.category,
    coverImage: row.cover_image_url,
    excerpt: row.excerpt,
    id: row.id,
    locales: [...row.locale_codes],
    publishedAt: row.published_on ?? "",
    seoTitle: row.seo_title,
    slug: row.slug,
    status: mapBlogStatus(row.status),
    tags: [...row.tag_labels],
    title: row.title,
    updatedAt: row.updated_on,
  };
}

function mapBlogPostRecordToRow(post: BlogPostRecord): AdminBlogPostDatabaseRow {
  return {
    author: post.author,
    body: post.body,
    category: post.category,
    cover_image_url: post.coverImage,
    excerpt: post.excerpt,
    id: post.id,
    locale_codes: [...post.locales],
    published_on: post.publishedAt.trim() || null,
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
    businessName: row.business_name,
    cookiePrivacyMode: row.cookie_privacy_mode,
    currency: row.currency,
    dailySlotCapacity: row.daily_slot_capacity,
    defaultLocale: row.default_locale,
    defaultSeoTitle: row.default_seo_title,
    emailSender: row.email_sender,
    googleCalendarId: row.google_calendar_id,
    googleCalendarMode: mapCalendarSyncMode(row.google_calendar_mode),
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
    business_name: settings.businessName,
    cookie_privacy_mode: settings.cookiePrivacyMode,
    currency: settings.currency,
    daily_slot_capacity: settings.dailySlotCapacity,
    default_locale: settings.defaultLocale,
    default_seo_title: settings.defaultSeoTitle,
    email_sender: settings.emailSender,
    google_calendar_id: settings.googleCalendarId,
    google_calendar_mode: mapCalendarSyncModeToDatabase(settings.googleCalendarMode),
    id: "site",
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
    twoFactor: false,
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

async function insertRow(client: AdminSupabaseClient, table: string, values: unknown) {
  const { error } = await client.from(table).insert(values);

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
}

async function upsertRow(
  client: AdminSupabaseClient,
  table: string,
  values: unknown,
  options?: { onConflict?: string },
) {
  const { error } = await client.from(table).upsert(values, options);

  if (error) {
    throw new Error(`${table}: ${error.message}`);
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
    const rows = await selectRows<AdminClientDatabaseRow>(client, "admin_clients", clientColumns, (query) =>
      query.order("full_name", { ascending: true }),
    );

    return rows.map(mapClientRow);
  }

  async function listAppointments() {
    const rows = await selectRows<AdminAppointmentDatabaseRow>(client, "admin_appointments", appointmentColumns, (query) =>
      query.order("starts_on", { ascending: true }),
    );

    return rows.map(mapAppointmentRow);
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

    return rows.map(mapServiceRow);
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

    return rows.map(mapMediaRow);
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

  async function loadDomainRecords() {
    const clients = await listClients();
    const appointments = await listAppointments();
    const certificates = await listCertificates();

    return {
      appointments,
      certificates,
      clients: addAppointmentHistories(clients, appointments),
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

  async function saveClient(clientRecord: ClientRecord) {
    await upsertRow(client, "admin_clients", mapClientRecordToRow(clientRecord), { onConflict: "id" });
  }

  async function saveAppointment(appointment: Appointment) {
    await upsertRow(client, "admin_appointments", mapAppointmentRecordToRow(appointment), { onConflict: "id" });
  }

  async function saveCertificate(certificate: CertificateRecord) {
    await upsertRow(client, "admin_certificates", mapCertificateRecordToRow(certificate), { onConflict: "code" });
  }

  async function saveService(service: ServiceRecord) {
    await upsertRow(client, "admin_services", mapServiceRecordToRow(service), { onConflict: "slug" });
  }

  async function savePrice(price: PriceRecord) {
    await upsertRow(client, "admin_price_variants", mapPriceRecordToRow(price), { onConflict: "id" });
  }

  async function saveMedia(media: MediaRecord) {
    await upsertRow(client, "admin_media_assets", mapMediaRecordToRow(media), { onConflict: "id" });
  }

  async function saveContactChannel(channel: ContactChannelRecord) {
    await upsertRow(client, "admin_contact_channels", mapContactChannelRecordToRow(channel), { onConflict: "id" });
  }

  async function saveContactSettings(settings: ContactSettingsRecord) {
    await upsertRow(client, "admin_contact_settings", mapContactSettingsRecordToRow(settings), { onConflict: "id" });
  }

  async function saveBlogPost(post: BlogPostRecord) {
    await upsertRow(client, "admin_blog_posts", mapBlogPostRecordToRow(post), { onConflict: "id" });
  }

  async function saveSettings(settings: SettingsRecord) {
    await upsertRow(client, "admin_site_settings", mapSettingsRecordToRow(settings), { onConflict: "id" });
  }

  return {
    listAppointments,
    listAdminUsers,
    listBlogPosts,
    listCertificates,
    listClients,
    listContactChannels,
    listMedia,
    listPrices,
    listServices,
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
