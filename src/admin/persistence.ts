import type {
  Appointment,
  BlogPostRecord,
  CertificateRecord,
  ClientRecord,
  ContactChannelRecord,
  ContactSettingsRecord,
  MediaRecord,
  PriceRecord,
  ServiceRecord,
  SettingsRecord,
} from "./domain";
import { serviceLocales, type ServiceLocale, type ServiceTranslationRecord } from "./domain";
import { createAdminSupabaseRepository, type AdminRepository, type AdminSupabaseClient } from "./repository";
import { createAdminSupabaseClient, type AdminSupabaseEnvSource } from "./supabase-client";
import { getArticleText, sanitizeArticleHtml } from "@/components/admin/blog/article-safety";

const appointmentStatuses = new Set([
  "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0430",
  "\u041e\u0436\u0438\u0434\u0430\u0435\u0442",
  "\u041d\u043e\u0432\u0430\u044f \u0437\u0430\u044f\u0432\u043a\u0430",
  "\u041e\u0442\u043c\u0435\u043d\u0435\u043d\u0430",
  "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430",
  "\u041d\u0435 \u043f\u0440\u0438\u0448\u0451\u043b",
]);
const blogStatuses = new Set([
  "\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u0430",
  "\u0427\u0435\u0440\u043d\u043e\u0432\u0438\u043a",
  "\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0430",
  "\u041d\u0430 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0435",
]);
const publishedStatus = "\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u0430";
const scheduledStatus = "\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0430";
const serviceStatuses = new Set([
  publishedStatus,
  "\u0427\u0435\u0440\u043d\u043e\u0432\u0438\u043a",
  "\u0421\u043a\u0440\u044b\u0442\u0430",
]);

export type AdminAuditAction =
  | "appointment.cancel"
  | "appointment.create"
  | "appointment.drag"
  | "appointment.post_visit_comment"
  | "appointment.resize"
  | "appointment.update"
  | "blog.publication"
  | "media.asset"
  | "service.visibility"
  | "site.gift_certificates";

export type AdminAuditContext = {
  action: AdminAuditAction;
  outsideWorkingHours?: boolean;
  overlapOverride?: boolean;
};

type AdminPersistRecordInput =
  | {
      record: Appointment;
      type: "appointment";
    }
  | {
      record: BlogPostRecord;
      type: "blogPost";
    }
  | {
      record: CertificateRecord;
      type: "certificate";
    }
  | {
      record: ClientRecord;
      type: "client";
    }
  | {
      record: ContactChannelRecord;
      type: "contactChannel";
    }
  | {
      record: ContactSettingsRecord;
      type: "contactSettings";
    }
  | {
      record: MediaRecord;
      type: "media";
    }
  | {
      record: PriceRecord;
      type: "price";
    }
  | {
      record: ServiceRecord;
      type: "service";
    }
  | {
      record: SettingsRecord;
      type: "settings";
    };

export type AdminPersistInput = AdminPersistRecordInput & {
  audit?: AdminAuditContext;
};

export type AdminPersistResult =
  | {
      mode: "supabase";
      ok: true;
    }
  | {
      message: string;
      mode: "demo" | "supabase";
      ok: false;
      reason?: AdminPersistFailureReason;
    };

export type AdminPersistFailureReason =
  | "appointment_calendar_block_conflict"
  | "appointment_concurrent_update"
  | "appointment_overlap_conflict"
  | "appointment_public_hold_conflict"
  | "public_appointment_immutable";

const adminPersistFailureReasons = new Set<AdminPersistFailureReason>([
  "appointment_calendar_block_conflict",
  "appointment_concurrent_update",
  "appointment_overlap_conflict",
  "appointment_public_hold_conflict",
  "public_appointment_immutable",
]);

function getAdminPersistFailureReason(error: unknown): AdminPersistFailureReason | undefined {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("admin_appointments_active_schedule_excl")) {
    return "appointment_overlap_conflict";
  }

  return [...adminPersistFailureReasons].find((reason) => message.includes(reason));
}

type AdminPersistDependencies = {
  createClient?: (env?: AdminSupabaseEnvSource) => AdminSupabaseClient | null;
  createRepository?: (
    client: AdminSupabaseClient,
  ) => Pick<
    AdminRepository,
    | "saveAppointment"
    | "saveBlogPost"
    | "saveCertificate"
    | "saveClient"
    | "saveContactChannel"
    | "saveContactSettings"
    | "saveMedia"
    | "savePrice"
    | "saveService"
    | "saveSettings"
  >;
  env?: AdminSupabaseEnvSource;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "string";
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const allowed = new Set(keys);

  return Object.keys(value).every((key) => allowed.has(key));
}

function hasNumber(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "number" && Number.isFinite(value[key]);
}

function hasStringArray(value: Record<string, unknown>, key: string) {
  return Array.isArray(value[key]) && value[key].every((item) => typeof item === "string");
}

function hasArray(value: Record<string, unknown>, key: string) {
  return Array.isArray(value[key]);
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

function isNonBlankString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: unknown) {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));

  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3]);
}

function isOptionalIsoDate(value: unknown) {
  return value === undefined || value === "" || isIsoDate(value);
}

function isOptionalLocalDateTime(value: unknown) {
  if (value === undefined || value === "") return true;
  if (typeof value !== "string") return false;
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

  return Boolean(match && isIsoDate(match[1]));
}

function isOptionalIsoTimestamp(value: unknown) {
  return value === undefined || value === "" ||
    (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value)));
}

function isTime(value: unknown) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isSlug(value: unknown) {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isPublicLocaleArray(value: unknown): value is ServiceLocale[] {
  return Array.isArray(value) &&
    value.length > 0 &&
    new Set(value).size === value.length &&
    value.every((locale) => serviceLocales.includes(locale as ServiceLocale));
}

function isOptionalStringRecord(value: unknown) {
  return (
    value === undefined ||
    (isObjectRecord(value) && Object.values(value).every((item) => typeof item === "string"))
  );
}

function isEmail(value: unknown) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isPhone(value: unknown) {
  return typeof value === "string" && /^\+?[0-9\s().-]{7,24}$/.test(value.trim()) && value.replace(/\D/g, "").length >= 7;
}

function isHttpUrl(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isHttpUrlOrPath(value: unknown) {
  return isHttpUrl(value) || (typeof value === "string" && value.startsWith("/") && !value.startsWith("//"));
}

function isClientRecordShape(record: Record<string, unknown>) {
  return (
    hasOnlyKeys(record, [
      "email",
      "history",
      "id",
      "language",
      "name",
      "next",
      "note",
      "phone",
      "preferredContact",
      "status",
      "tags",
      "telegram",
      "totalSpend",
      "visits",
    ]) &&
    (record.email === "" || isEmail(record.email)) &&
    hasArray(record, "history") &&
    hasString(record, "id") &&
    hasString(record, "language") &&
    hasString(record, "name") &&
    hasString(record, "next") &&
    hasString(record, "note") &&
    isPhone(record.phone) &&
    hasString(record, "preferredContact") &&
    hasString(record, "status") &&
    (record.telegram === "" || isHttpUrl(record.telegram)) &&
    hasString(record, "totalSpend") &&
    hasNumber(record, "visits") &&
    hasStringArray(record, "tags")
  );
}

function isAppointmentRecordShape(record: Record<string, unknown>) {
  const bufferMinutes = record.bufferMinutes;
  const durationMinutes = record.durationMinutes;
  const postVisitComment = record.postVisitComment;
  const postVisitCommentedAt = record.postVisitCommentedAt;
  const overlapOverride = record.overlapOverride;

  return (
    hasOnlyKeys(record, [
      "client",
      "clientId",
      "bufferMinutes",
      "date",
      "durationMinutes",
      "id",
      "note",
      "overlapOverride",
      "overlapOverrideReason",
      "overlapOverriddenAt",
      "overlapOverriddenBy",
      "postVisitComment",
      "postVisitCommentedAt",
      "publicContactPreference",
      "publicEmail",
      "publicNote",
      "publicPhone",
      "publicReference",
      "locale",
      "origin",
      "serviceSlug",
      "service",
      "status",
      "time",
      "version",
    ]) &&
    hasString(record, "client") &&
    hasString(record, "clientId") &&
    hasString(record, "date") &&
    isIsoDate(record.date) &&
    (bufferMinutes === undefined ||
      (typeof bufferMinutes === "number" &&
        Number.isInteger(bufferMinutes) &&
        bufferMinutes >= 0 &&
        bufferMinutes <= 24 * 60)) &&
    (durationMinutes === undefined ||
      (typeof durationMinutes === "number" &&
        Number.isInteger(durationMinutes) &&
        durationMinutes > 0 &&
        durationMinutes <= 24 * 60)) &&
    hasString(record, "note") &&
    (overlapOverride === undefined || typeof overlapOverride === "boolean") &&
    isOptionalString(record.overlapOverrideReason) &&
    isOptionalIsoTimestamp(record.overlapOverriddenAt) &&
    isOptionalString(record.overlapOverriddenBy) &&
    (overlapOverride !== true || Boolean((record.overlapOverrideReason as string | undefined)?.trim())) &&
    (postVisitComment === undefined || typeof postVisitComment === "string") &&
    isOptionalIsoTimestamp(postVisitCommentedAt) &&
    (record.publicContactPreference === undefined || ["phone", "viber", "telegram", "email"].includes(record.publicContactPreference as string)) &&
    isOptionalString(record.publicEmail) &&
    isOptionalString(record.publicNote) &&
    isOptionalString(record.publicPhone) &&
    isOptionalString(record.publicReference) &&
    isOptionalString(record.locale) &&
    (record.origin === undefined || record.origin === "admin" || record.origin === "public") &&
    isOptionalString(record.serviceSlug) &&
    hasString(record, "service") &&
    typeof record.status === "string" &&
    appointmentStatuses.has(record.status) &&
    isTime(record.time) &&
    (record.version === undefined || (Number.isInteger(record.version) && (record.version as number) > 0))
  );
}

function isCertificateRecordShape(record: Record<string, unknown>) {
  const clientId = record.clientId;

  return (
    hasOnlyKeys(record, [
      "amount",
      "buyer",
      "clientId",
      "clientName",
      "code",
      "expiresAt",
      "history",
      "note",
      "paymentDate",
      "recipient",
      "status",
      "stripeId",
    ]) &&
    hasString(record, "amount") &&
    hasString(record, "buyer") &&
    (clientId === undefined || typeof clientId === "string") &&
    hasString(record, "clientName") &&
    hasString(record, "code") &&
    hasString(record, "expiresAt") &&
    hasStringArray(record, "history") &&
    hasString(record, "note") &&
    hasString(record, "paymentDate") &&
    hasString(record, "recipient") &&
    hasString(record, "status") &&
    hasString(record, "stripeId")
  );
}

function isServiceTranslationShape(value: unknown, locale: ServiceLocale): value is ServiceTranslationRecord {
  if (!isObjectRecord(value)) return false;

  return (
    hasOnlyKeys(value, [
      "body",
      "canonicalUrl",
      "locale",
      "ogDescription",
      "ogImageMediaId",
      "ogTitle",
      "robotsDirectives",
      "seoDescription",
      "seoTitle",
      "shortDescription",
      "status",
      "title",
    ]) &&
    value.locale === locale &&
    (value.status === "draft" || value.status === "published") &&
    [
      "body",
      "canonicalUrl",
      "ogDescription",
      "ogImageMediaId",
      "ogTitle",
      "robotsDirectives",
      "seoDescription",
      "seoTitle",
      "shortDescription",
      "title",
    ].every((key) => hasString(value, key))
  );
}

function isServiceTranslationsShape(value: unknown) {
  if (value === undefined) return true;
  if (!isObjectRecord(value) || !hasOnlyKeys(value, serviceLocales)) return false;

  return Object.entries(value).every(
    ([locale, translation]) =>
      serviceLocales.includes(locale as ServiceLocale) &&
      isServiceTranslationShape(translation, locale as ServiceLocale),
  );
}

function isServiceRecordShape(record: Record<string, unknown>) {
  const hasValidShape =
    hasOnlyKeys(record, [
      "category",
      "coverImage",
      "duration",
      "locales",
      "name",
      "order",
      "seoTitle",
      "slug",
      "status",
      "summary",
      "translations",
    ]) &&
    hasString(record, "category") &&
    isHttpUrlOrPath(record.coverImage) &&
    hasString(record, "duration") &&
    isPublicLocaleArray(record.locales) &&
    hasString(record, "name") &&
    hasNumber(record, "order") &&
    hasString(record, "seoTitle") &&
    isSlug(record.slug) &&
    typeof record.status === "string" &&
    serviceStatuses.has(record.status) &&
    hasString(record, "summary") &&
    isServiceTranslationsShape(record.translations);

  if (!hasValidShape || record.status !== publishedStatus) return hasValidShape;
  if (!isObjectRecord(record.translations)) return false;
  const locales = record.locales as ServiceLocale[];
  const translations = record.translations as Partial<Record<ServiceLocale, ServiceTranslationRecord>>;

  return (
    serviceLocales.every((locale) => locales.includes(locale)) &&
    serviceLocales.every((locale) => {
      const translation = translations[locale];

      return isObjectRecord(translation) &&
        translation.status === "published" &&
        [
          translation.title,
          translation.shortDescription,
          translation.body,
          translation.seoTitle,
          translation.seoDescription,
          translation.robotsDirectives,
        ].every(isNonBlankString);
    }) &&
    [record.category, record.coverImage, record.duration, record.name, record.seoTitle, record.summary]
      .every(isNonBlankString)
  );
}

function isPriceRecordShape(record: Record<string, unknown>) {
  return (
    hasOnlyKeys(record, ["durationMinutes", "id", "note", "order", "priceEur", "serviceSlug", "status", "updatedAt"]) &&
    Number.isInteger(record.durationMinutes) &&
    (record.durationMinutes as number) > 0 &&
    (record.durationMinutes as number) <= 24 * 60 &&
    hasString(record, "id") &&
    hasString(record, "note") &&
    hasNumber(record, "order") &&
    hasNumber(record, "priceEur") &&
    hasString(record, "serviceSlug") &&
    hasString(record, "status") &&
    isIsoDate(record.updatedAt)
  );
}

function isMediaRecordShape(record: Record<string, unknown>) {
  return (
    hasOnlyKeys(record, [
      "altText",
      "altTexts",
      "dimensions",
      "folder",
      "id",
      "name",
      "publicationConsent",
      "size",
      "status",
      "type",
      "uploadedAt",
      "url",
      "usage",
    ]) &&
    hasString(record, "altText") &&
    isOptionalStringRecord(record.altTexts) &&
    hasString(record, "dimensions") &&
    hasString(record, "folder") &&
    hasString(record, "id") &&
    hasString(record, "name") &&
    (record.publicationConsent === undefined ||
      ["unknown", "granted", "not_required", "denied"].includes(String(record.publicationConsent))) &&
    hasString(record, "size") &&
    hasString(record, "status") &&
    hasString(record, "type") &&
    hasString(record, "uploadedAt") &&
    isHttpUrlOrPath(record.url) &&
    hasStringArray(record, "usage")
  );
}

function isContactChannelRecordShape(record: Record<string, unknown>) {
  return (
    hasOnlyKeys(record, ["id", "name", "note", "status", "type", "usage", "value"]) &&
    hasString(record, "id") &&
    hasString(record, "name") &&
    hasString(record, "note") &&
    hasString(record, "status") &&
    hasString(record, "type") &&
    hasStringArray(record, "usage") &&
    hasString(record, "value")
  );
}

function isContactSettingsRecordShape(record: Record<string, unknown>) {
  return (
    hasOnlyKeys(record, ["address", "bookingUrl", "businessName", "email", "mapUrl", "phone", "seoArea", "workingHours"]) &&
    hasString(record, "address") &&
    isHttpUrl(record.bookingUrl) &&
    hasString(record, "businessName") &&
    isEmail(record.email) &&
    isHttpUrl(record.mapUrl) &&
    isPhone(record.phone) &&
    hasString(record, "seoArea") &&
    hasString(record, "workingHours")
  );
}

function isBlogPostRecordShape(record: Record<string, unknown>) {
  const hasDraftCover =
    (record.status === "Черновик" || record.status === "На проверке") && record.coverImage === "";
  const hasValidShape =
    hasOnlyKeys(record, [
      "author",
      "body",
      "canonicalUrl",
      "category",
      "coverAlt",
      "coverImage",
      "editorJson",
      "excerpt",
      "hreflang",
      "id",
      "locales",
      "ogDescription",
      "ogTitle",
      "publishedAt",
      "robotsDirectives",
      "scheduledFor",
      "seoDescription",
      "seoTitle",
      "slug",
      "status",
      "tags",
      "title",
      "updatedAt",
    ]) &&
    hasString(record, "author") &&
    hasString(record, "body") &&
    isOptionalString(record.canonicalUrl) &&
    hasString(record, "category") &&
    isOptionalString(record.coverAlt) &&
    (hasDraftCover || isHttpUrlOrPath(record.coverImage)) &&
    (record.editorJson === undefined || isObjectRecord(record.editorJson)) &&
    hasString(record, "excerpt") &&
    isOptionalStringRecord(record.hreflang) &&
    hasString(record, "id") &&
    isPublicLocaleArray(record.locales) &&
    isOptionalString(record.ogDescription) &&
    isOptionalString(record.ogTitle) &&
    isOptionalIsoDate(record.publishedAt) &&
    isOptionalString(record.robotsDirectives) &&
    isOptionalLocalDateTime(record.scheduledFor) &&
    isOptionalString(record.seoDescription) &&
    hasString(record, "seoTitle") &&
    isSlug(record.slug) &&
    typeof record.status === "string" &&
    blogStatuses.has(record.status) &&
    hasStringArray(record, "tags") &&
    hasString(record, "title") &&
    isIsoDate(record.updatedAt);

  if (!hasValidShape || (record.status !== publishedStatus && record.status !== scheduledStatus)) {
    return hasValidShape;
  }

  return (
    [
      record.author,
      record.category,
      record.coverAlt,
      record.coverImage,
      record.seoDescription,
      record.seoTitle,
      record.title,
    ].every(isNonBlankString) &&
    getArticleText(String(record.body)).length > 0 &&
    (record.status !== publishedStatus || isIsoDate(record.publishedAt)) &&
    (record.status !== scheduledStatus ||
      (typeof record.scheduledFor === "string" && isOptionalLocalDateTime(record.scheduledFor) && record.scheduledFor.length > 0))
  );
}

function isSettingsRecordShape(record: Record<string, unknown>) {
  return (
    hasOnlyKeys(record, [
      "auditLogRetentionDays",
      "bookingBufferMinutes",
      "bookingHoldMinutes",
      "bookingHorizonDays",
      "bookingMinLeadMinutes",
      "bookingSlotStepMinutes",
      "businessName",
      "cookiePrivacyMode",
      "currency",
      "dailySlotCapacity",
      "defaultLocale",
      "defaultSeoTitle",
      "emailSender",
      "googleCalendarId",
      "googleCalendarMode",
      "giftCertificatesEnabled",
      "publicBookingDailyLimit",
      "publicBookingEnabled",
      "reminderTemplate",
      "rolesPolicy",
      "stripeMode",
      "timezone",
      "updatedAt",
      "workingDays",
      "workingHours",
    ]) &&
    hasNumber(record, "auditLogRetentionDays") &&
    hasNumber(record, "bookingBufferMinutes") &&
    [15, 30].includes(record.bookingBufferMinutes as number) &&
    hasNumber(record, "bookingHoldMinutes") &&
    Number(record.bookingHoldMinutes) >= 1 &&
    Number(record.bookingHoldMinutes) <= 30 &&
    hasNumber(record, "bookingHorizonDays") &&
    Number(record.bookingHorizonDays) >= 1 &&
    Number(record.bookingHorizonDays) <= 365 &&
    hasNumber(record, "bookingMinLeadMinutes") &&
    Number(record.bookingMinLeadMinutes) >= 0 &&
    Number(record.bookingMinLeadMinutes) <= 10080 &&
    record.bookingSlotStepMinutes === 15 &&
    hasString(record, "businessName") &&
    hasString(record, "cookiePrivacyMode") &&
    record.currency === "EUR" &&
    hasNumber(record, "dailySlotCapacity") &&
    hasString(record, "defaultLocale") &&
    hasString(record, "defaultSeoTitle") &&
    isEmail(record.emailSender) &&
    hasString(record, "googleCalendarId") &&
    hasString(record, "googleCalendarMode") &&
    (record.giftCertificatesEnabled === undefined || typeof record.giftCertificatesEnabled === "boolean") &&
    hasNumber(record, "publicBookingDailyLimit") &&
    Number(record.publicBookingDailyLimit) >= 1 &&
    Number(record.publicBookingDailyLimit) <= 8 &&
    typeof record.publicBookingEnabled === "boolean" &&
    hasString(record, "reminderTemplate") &&
    hasString(record, "rolesPolicy") &&
    hasString(record, "stripeMode") &&
    hasString(record, "timezone") &&
    hasString(record, "updatedAt") &&
    hasString(record, "workingDays") &&
    hasString(record, "workingHours")
  );
}

const auditActionsByType: Record<AdminPersistInput["type"], readonly AdminAuditAction[]> = {
  appointment: [
    "appointment.cancel",
    "appointment.create",
    "appointment.drag",
    "appointment.post_visit_comment",
    "appointment.resize",
    "appointment.update",
  ],
  blogPost: ["blog.publication"],
  certificate: [],
  client: [],
  contactChannel: [],
  contactSettings: [],
  media: ["media.asset"],
  price: [],
  service: ["service.visibility"],
  settings: ["site.gift_certificates"],
};

function isAdminAuditContext(value: unknown, type: AdminPersistInput["type"]) {
  if (value === undefined) return auditActionsByType[type].length === 0;
  if (!isObjectRecord(value) || !hasOnlyKeys(value, ["action", "outsideWorkingHours", "overlapOverride"])) {
    return false;
  }

  return (
    typeof value.action === "string" &&
    auditActionsByType[type].includes(value.action as AdminAuditAction) &&
    (value.outsideWorkingHours === undefined || typeof value.outsideWorkingHours === "boolean") &&
    (value.overlapOverride === undefined || typeof value.overlapOverride === "boolean") &&
    (type === "appointment" ||
      (value.outsideWorkingHours === undefined && value.overlapOverride === undefined))
  );
}

export function isAdminPersistInput(input: unknown): input is AdminPersistInput {
  if (
    !isObjectRecord(input) ||
    !hasOnlyKeys(input, ["audit", "record", "type"]) ||
    !isObjectRecord(input.record) ||
    typeof input.type !== "string" ||
    !(input.type in auditActionsByType) ||
    !isAdminAuditContext(input.audit, input.type as AdminPersistInput["type"])
  ) {
    return false;
  }

  if (input.type === "appointment") {
    return isAppointmentRecordShape(input.record);
  }

  if (input.type === "blogPost") {
    return isBlogPostRecordShape(input.record);
  }

  if (input.type === "certificate") {
    return isCertificateRecordShape(input.record);
  }

  if (input.type === "client") {
    return isClientRecordShape(input.record);
  }

  if (input.type === "contactChannel") {
    return isContactChannelRecordShape(input.record);
  }

  if (input.type === "contactSettings") {
    return isContactSettingsRecordShape(input.record);
  }

  if (input.type === "media") {
    return isMediaRecordShape(input.record);
  }

  if (input.type === "price") {
    return isPriceRecordShape(input.record);
  }

  if (input.type === "service") {
    return isServiceRecordShape(input.record);
  }

  if (input.type === "settings") {
    return isSettingsRecordShape(input.record);
  }

  return false;
}

export async function persistAdminRecord(
  input: AdminPersistInput,
  {
    createClient = createAdminSupabaseClient,
    createRepository = createAdminSupabaseRepository,
    env = process.env,
  }: AdminPersistDependencies = {},
): Promise<AdminPersistResult> {
  const client = createClient(env);

  if (!client) {
    return {
      message: "Supabase is not configured.",
      mode: "demo",
      ok: false,
    };
  }

  try {
    const repository = createRepository(client);

    if (input.type === "client") {
      await repository.saveClient(input.record);
    } else if (input.type === "blogPost") {
      await repository.saveBlogPost({ ...input.record, body: sanitizeArticleHtml(input.record.body) });
    } else if (input.type === "certificate") {
      await repository.saveCertificate(input.record);
    } else if (input.type === "contactChannel") {
      await repository.saveContactChannel(input.record);
    } else if (input.type === "contactSettings") {
      await repository.saveContactSettings(input.record);
    } else if (input.type === "media") {
      await repository.saveMedia(input.record);
    } else if (input.type === "price") {
      await repository.savePrice(input.record);
    } else if (input.type === "service") {
      await repository.saveService(input.record);
    } else if (input.type === "settings") {
      await repository.saveSettings(input.record);
    } else {
      await repository.saveAppointment(input.record);
    }

    return {
      mode: "supabase",
      ok: true,
    };
  } catch (error) {
    console.error("Unable to persist admin record", error);
    const reason = getAdminPersistFailureReason(error);

    return {
      message: "Unable to persist admin record.",
      mode: "supabase",
      ok: false,
      ...(reason ? { reason } : {}),
    };
  }
}
