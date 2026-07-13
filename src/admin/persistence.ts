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
import { createAdminSupabaseRepository, type AdminRepository, type AdminSupabaseClient } from "./repository";
import { createAdminSupabaseClient, type AdminSupabaseEnvSource } from "./supabase-client";

export type AdminPersistInput =
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

export type AdminPersistResult =
  | {
      mode: "supabase";
      ok: true;
    }
  | {
      message: string;
      mode: "demo" | "supabase";
      ok: false;
    };

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
    isEmail(record.email) &&
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
  return (
    hasOnlyKeys(record, ["client", "clientId", "date", "id", "note", "service", "status", "time"]) &&
    hasString(record, "client") &&
    hasString(record, "clientId") &&
    hasString(record, "date") &&
    hasString(record, "note") &&
    hasString(record, "service") &&
    hasString(record, "status") &&
    hasString(record, "time")
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

function isServiceRecordShape(record: Record<string, unknown>) {
  return (
    hasOnlyKeys(record, ["category", "coverImage", "duration", "locales", "name", "order", "seoTitle", "slug", "status", "summary"]) &&
    hasString(record, "category") &&
    isHttpUrlOrPath(record.coverImage) &&
    hasString(record, "duration") &&
    hasStringArray(record, "locales") &&
    hasString(record, "name") &&
    hasNumber(record, "order") &&
    hasString(record, "seoTitle") &&
    hasString(record, "slug") &&
    hasString(record, "status") &&
    hasString(record, "summary")
  );
}

function isPriceRecordShape(record: Record<string, unknown>) {
  return (
    hasOnlyKeys(record, ["durationMinutes", "id", "note", "order", "priceEur", "serviceSlug", "status", "updatedAt"]) &&
    hasNumber(record, "durationMinutes") &&
    hasString(record, "id") &&
    hasString(record, "note") &&
    hasNumber(record, "order") &&
    hasNumber(record, "priceEur") &&
    hasString(record, "serviceSlug") &&
    hasString(record, "status") &&
    hasString(record, "updatedAt")
  );
}

function isMediaRecordShape(record: Record<string, unknown>) {
  return (
    hasOnlyKeys(record, ["altText", "dimensions", "folder", "id", "name", "size", "status", "type", "uploadedAt", "url", "usage"]) &&
    hasString(record, "altText") &&
    hasString(record, "dimensions") &&
    hasString(record, "folder") &&
    hasString(record, "id") &&
    hasString(record, "name") &&
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
  return (
    hasOnlyKeys(record, [
      "author",
      "body",
      "category",
      "coverImage",
      "excerpt",
      "id",
      "locales",
      "publishedAt",
      "seoTitle",
      "slug",
      "status",
      "tags",
      "title",
      "updatedAt",
    ]) &&
    hasString(record, "author") &&
    hasString(record, "body") &&
    hasString(record, "category") &&
    isHttpUrlOrPath(record.coverImage) &&
    hasString(record, "excerpt") &&
    hasString(record, "id") &&
    hasStringArray(record, "locales") &&
    hasString(record, "publishedAt") &&
    hasString(record, "seoTitle") &&
    hasString(record, "slug") &&
    hasString(record, "status") &&
    hasStringArray(record, "tags") &&
    hasString(record, "title") &&
    hasString(record, "updatedAt")
  );
}

function isSettingsRecordShape(record: Record<string, unknown>) {
  return (
    hasOnlyKeys(record, [
      "auditLogRetentionDays",
      "bookingBufferMinutes",
      "businessName",
      "cookiePrivacyMode",
      "currency",
      "dailySlotCapacity",
      "defaultLocale",
      "defaultSeoTitle",
      "emailSender",
      "googleCalendarId",
      "googleCalendarMode",
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
    hasString(record, "businessName") &&
    hasString(record, "cookiePrivacyMode") &&
    record.currency === "EUR" &&
    hasNumber(record, "dailySlotCapacity") &&
    hasString(record, "defaultLocale") &&
    hasString(record, "defaultSeoTitle") &&
    isEmail(record.emailSender) &&
    hasString(record, "googleCalendarId") &&
    hasString(record, "googleCalendarMode") &&
    hasString(record, "reminderTemplate") &&
    hasString(record, "rolesPolicy") &&
    hasString(record, "stripeMode") &&
    hasString(record, "timezone") &&
    hasString(record, "updatedAt") &&
    hasString(record, "workingDays") &&
    hasString(record, "workingHours")
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to persist admin record.";
}

export function isAdminPersistInput(input: unknown): input is AdminPersistInput {
  if (!isObjectRecord(input) || !isObjectRecord(input.record)) {
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
      await repository.saveBlogPost(input.record);
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
    return {
      message: errorMessage(error),
      mode: "supabase",
      ok: false,
    };
  }
}
