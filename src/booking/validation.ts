import type {
  ConfirmPublicBookingInput,
  CreatePublicBookingHoldInput,
  PublicBookingContactPreference,
  PublicBookingLocale,
} from "./types";
import { publicBookingContactPreferences, publicBookingLocales } from "./types";

type JsonRecord = Record<string, unknown>;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const holdTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const idempotencyKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+\d\s().-]+$/;
const unsafeTextPattern = /[\u0000-\u001f\u007f]/;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: JsonRecord, allowedKeys: readonly string[]) {
  const allowed = new Set(allowedKeys);

  return Object.keys(record).every((key) => allowed.has(key));
}

function isPublicBookingLocale(value: unknown): value is PublicBookingLocale {
  return typeof value === "string" && publicBookingLocales.includes(value as PublicBookingLocale);
}

function isPublicBookingContactPreference(value: unknown): value is PublicBookingContactPreference {
  return typeof value === "string" &&
    publicBookingContactPreferences.includes(value as PublicBookingContactPreference);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isSlotTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = timePattern.exec(value);

  return Boolean(match) && Number(match?.[2]) % 30 === 0;
}

function normalizedOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : null;
}

function honeypotIsEmpty(record: JsonRecord) {
  return normalizedOptionalString(record.website) === "" || record.website === undefined;
}

export function normalizePublicBookingPhone(value: string) {
  return value.replace(/\D/g, "");
}

export function parseOptionsQuery(
  url: URL,
): { locale: PublicBookingLocale; recoverConfirmation: boolean } | null {
  const allowedKeys = new Set(["locale", "recoverConfirmation"]);
  if ([...url.searchParams.keys()].some((key) => !allowedKeys.has(key))) return null;
  if (
    url.searchParams.getAll("locale").length > 1
    || url.searchParams.getAll("recoverConfirmation").length > 1
  ) return null;
  const locale = url.searchParams.get("locale") ?? "ru";
  const recoverConfirmation = url.searchParams.get("recoverConfirmation");
  if (recoverConfirmation !== null && recoverConfirmation !== "1") return null;

  return isPublicBookingLocale(locale)
    ? { locale, recoverConfirmation: recoverConfirmation === "1" }
    : null;
}

export function parseAvailabilityQuery(url: URL) {
  const allowedKeys = new Set(["priceVariantId", "from", "days"]);
  if ([...url.searchParams.keys()].some((key) => !allowedKeys.has(key))) return null;
  if (["priceVariantId", "from", "days"].some((key) => url.searchParams.getAll(key).length !== 1)) {
    return null;
  }

  const priceVariantId = url.searchParams.get("priceVariantId");
  const from = url.searchParams.get("from");
  const rawDays = url.searchParams.get("days");
  const days = rawDays && /^\d{1,2}$/.test(rawDays) ? Number(rawDays) : Number.NaN;

  if (!priceVariantId || !identifierPattern.test(priceVariantId) || !isIsoDate(from) || !Number.isInteger(days)) {
    return null;
  }
  if (days < 1 || days > 31) return null;

  return { days, from, priceVariantId };
}

export function parseCreateHoldPayload(payload: unknown): CreatePublicBookingHoldInput | null {
  if (!isRecord(payload) || !hasOnlyKeys(payload, ["priceVariantId", "date", "time", "website"])) return null;
  if (!honeypotIsEmpty(payload)) return null;
  if (typeof payload.priceVariantId !== "string" || !identifierPattern.test(payload.priceVariantId)) return null;
  if (!isIsoDate(payload.date) || !isSlotTime(payload.time)) return null;

  return {
    date: payload.date,
    priceVariantId: payload.priceVariantId,
    time: payload.time,
  };
}

export function parseConfirmPayload(
  payload: unknown,
  idempotencyKey: string | null,
): ConfirmPublicBookingInput | null {
  if (
    !isRecord(payload) ||
    !hasOnlyKeys(payload, [
      "holdToken",
      "selectionId",
      "selectionVersion",
      "fullName",
      "phone",
      "email",
      "locale",
      "contactPreference",
      "note",
      "privacyAccepted",
      "website",
    ]) ||
    !honeypotIsEmpty(payload)
  ) {
    return null;
  }

  const fullName = normalizedOptionalString(payload.fullName);
  const phone = normalizedOptionalString(payload.phone);
  const email = normalizedOptionalString(payload.email) ?? "";
  const note = normalizedOptionalString(payload.note) ?? "";
  const normalizedKey = idempotencyKey?.trim() ?? "";

  if (
    typeof payload.holdToken !== "string" ||
    !holdTokenPattern.test(payload.holdToken) ||
    typeof payload.selectionId !== "string" ||
    !uuidPattern.test(payload.selectionId) ||
    !Number.isInteger(payload.selectionVersion) ||
    Number(payload.selectionVersion) < 1 ||
    Number(payload.selectionVersion) > 2_147_483_647 ||
    !fullName ||
    fullName.length < 2 ||
    fullName.length > 100 ||
    unsafeTextPattern.test(fullName) ||
    !phone ||
    phone.length > 32 ||
    !phonePattern.test(phone) ||
    !isPublicBookingLocale(payload.locale) ||
    !isPublicBookingContactPreference(payload.contactPreference) ||
    payload.privacyAccepted !== true ||
    note.length > 1000 ||
    unsafeTextPattern.test(note) ||
    !idempotencyKeyPattern.test(normalizedKey)
  ) {
    return null;
  }

  const phoneNormalized = normalizePublicBookingPhone(phone);
  if (phoneNormalized.length < 7 || phoneNormalized.length > 15) return null;
  if (email && (email.length > 254 || !emailPattern.test(email))) return null;
  if (payload.contactPreference === "email" && !email) return null;

  return {
    contactPreference: payload.contactPreference,
    email: email ? email.toLowerCase() : null,
    fullName,
    holdToken: payload.holdToken,
    idempotencyKey: normalizedKey,
    locale: payload.locale,
    note,
    phone,
    phoneNormalized,
    privacyAccepted: true,
    selectionId: payload.selectionId,
    selectionVersion: Number(payload.selectionVersion),
  };
}
