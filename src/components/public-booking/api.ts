import type { Locale } from "@/i18n/config";

import type {
  BookingAvailability,
  BookingConfirmation,
  BookingContact,
  BookingHold,
  BookingOptions,
  BookingRestoredHold,
  BookingService,
  BookingSpecialist,
  BookingVariant,
} from "./types";

export class BookingApiError extends Error {
  constructor(readonly status: number) {
    super("Public booking request failed");
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BookingApiError(502);
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new BookingApiError(502);
  return value.trim();
}

function asNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new BookingApiError(502);
  return value;
}

function asInteger(value: unknown, minimum: number, maximum: number) {
  const number = asNumber(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new BookingApiError(502);
  }
  return number;
}

function parseVariant(value: unknown): BookingVariant {
  const row = asRecord(value);

  return {
    currency: asString(row.currency),
    durationMinutes: asNumber(row.durationMinutes),
    id: asString(row.id),
    priceCents: asNumber(row.priceCents),
  };
}

function parseSpecialist(value: unknown): BookingSpecialist {
  const row = asRecord(value);

  return { displayName: asString(row.displayName), id: asString(row.id) };
}

function parseService(value: unknown): BookingService {
  const row = asRecord(value);
  if (!Array.isArray(row.variants) || !Array.isArray(row.specialists)) throw new BookingApiError(502);

  return {
    ...(typeof row.category === "string" && row.category.trim()
      ? { category: row.category.trim() }
      : {}),
    slug: asString(row.slug),
    specialists: row.specialists.map(parseSpecialist),
    title: asString(row.title),
    variants: row.variants.map(parseVariant),
  };
}

function parseRestoredHold(value: unknown): BookingRestoredHold | null {
  if (value === null || value === undefined) return null;
  const row = asRecord(value);
  const expiresAt = asString(row.expiresAt);
  if (!Number.isFinite(Date.parse(expiresAt))) throw new BookingApiError(502);

  return {
    currency: asString(row.currency),
    date: asString(row.date),
    durationMinutes: asInteger(row.durationMinutes, 1, 1_440),
    expiresAt,
    holdToken: asString(row.holdToken),
    priceVariantId: asString(row.priceVariantId),
    priceCents: asInteger(row.priceCents, 0, 100_000_000),
    selectionId: asString(row.selectionId),
    selectionVersion: asInteger(row.selectionVersion, 1, 2_147_483_647),
    serviceSlug: asString(row.serviceSlug),
    specialistId: asString(row.specialistId),
    specialistName: asString(row.specialistName),
    time: asString(row.time),
  };
}

function parseConfirmation(value: unknown): BookingConfirmation | null {
  if (value === null || value === undefined) return null;
  const row = asRecord(value);
  if (row.status !== "confirmed") throw new BookingApiError(502);

  return {
    appointment: {
      currency: asString(row.currency),
      date: asString(row.date),
      durationMinutes: asInteger(row.durationMinutes, 1, 1_440),
      priceCents: asInteger(row.priceCents, 0, 100_000_000),
      priceVariantId: asString(row.priceVariantId),
      serviceName: asString(row.serviceName),
      serviceSlug: asString(row.serviceSlug),
      ...(typeof row.specialistId === "string" && row.specialistId.trim()
        ? { specialistId: row.specialistId.trim() }
        : {}),
      specialistName: asString(row.specialistName),
      time: asString(row.time),
    },
    reference: asString(row.publicReference),
    status: "confirmed",
  };
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body) headers.set("Content-Type", "application/json");

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) throw new BookingApiError(response.status);

  try {
    return await response.json();
  } catch {
    throw new BookingApiError(502);
  }
}

export async function loadBookingOptions(
  locale: Locale,
  signal?: AbortSignal,
  recoverConfirmation = false,
): Promise<BookingOptions> {
  const search = new URLSearchParams({ locale });
  if (recoverConfirmation) search.set("recoverConfirmation", "1");
  const row = asRecord(await requestJson(`/api/public/booking/options?${search}`, { signal }));

  if (typeof row.enabled !== "boolean" || !Array.isArray(row.services)) {
    throw new BookingApiError(502);
  }

  return {
    activeHold: parseRestoredHold(row.activeHold),
    confirmation: parseConfirmation(row.confirmation),
    enabled: row.enabled,
    horizonDays: asInteger(row.horizonDays, 1, 365),
    ...(row.policy === undefined ? {} : { policy: row.policy }),
    services: row.services.map(parseService),
  };
}

export function getSofiaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Sofia",
    year: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addIsoDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseAvailabilityDays(value: unknown): BookingAvailability["dates"] {
  const row = asRecord(value);
  if (!Array.isArray(row.days)) throw new BookingApiError(502);

  return row.days.map((item) => {
    const date = asRecord(item);
    if (typeof date.capReached !== "boolean") throw new BookingApiError(502);
    if (!Array.isArray(date.slots) || !date.slots.every((slot) => typeof slot === "string")) {
      throw new BookingApiError(502);
    }
    const slots = date.slots as string[];
    const availability = date.capReached || slots.length === 0
      ? "unavailable"
      : slots.length <= 3
        ? "limited"
        : "available";

    return {
      availability,
      date: asString(date.date),
      slots,
    };
  });
}

export async function loadBookingAvailability(input: {
  horizonDays: number;
  signal?: AbortSignal;
  specialistId?: string;
  variantId: string;
}): Promise<BookingAvailability> {
  const horizonDays = asInteger(input.horizonDays, 1, 365);
  const dates: BookingAvailability["dates"] = [];
  const today = getSofiaToday();

  for (let offset = 0; offset < horizonDays; offset += 31) {
    const days = Math.min(31, horizonDays - offset);
    const search = new URLSearchParams({
      days: String(days),
      from: addIsoDays(today, offset),
      priceVariantId: input.variantId,
    });
    if (input.specialistId) search.set("specialistId", input.specialistId);
    const response = await requestJson(`/api/public/booking/availability?${search}`, {
      signal: input.signal,
    });
    dates.push(...parseAvailabilityDays(response));
  }

  return { dates };
}

export async function createBookingHold(input: {
  date: string;
  specialistId?: string;
  time: string;
  variantId: string;
}): Promise<BookingHold> {
  const row = asRecord(
    await requestJson("/api/public/booking/holds", {
      body: JSON.stringify({
        date: input.date,
        priceVariantId: input.variantId,
        ...(input.specialistId ? { specialistId: input.specialistId } : {}),
        time: input.time,
        website: "",
      }),
      method: "POST",
    }),
  );
  const expiresAt = asString(row.expiresAt);

  if (!Number.isFinite(Date.parse(expiresAt))) throw new BookingApiError(502);

  return {
    currency: asString(row.currency),
    durationMinutes: asInteger(row.durationMinutes, 1, 1_440),
    expiresAt,
    holdToken: asString(row.holdToken),
    priceCents: asInteger(row.priceCents, 0, 100_000_000),
    selectionId: asString(row.selectionId),
    selectionVersion: asInteger(row.selectionVersion, 1, 2_147_483_647),
    specialistId: asString(row.specialistId),
    specialistName: asString(row.specialistName),
  };
}

export async function confirmPublicBooking(input: {
  contact: BookingContact;
  holdToken: string;
  idempotencyKey: string;
  locale: Locale;
  selectionId: string;
  selectionVersion: number;
}): Promise<BookingConfirmation> {
  const row = asRecord(
    await requestJson("/api/public/booking/confirm", {
      body: JSON.stringify({
        contactPreference: input.contact.contactPreference,
        email: input.contact.email,
        fullName: input.contact.name,
        holdToken: input.holdToken,
        locale: input.locale,
        note: "",
        phone: input.contact.phone,
        privacyAccepted: input.contact.privacyAccepted,
        selectionId: input.selectionId,
        selectionVersion: input.selectionVersion,
        website: "",
      }),
      headers: { "Idempotency-Key": input.idempotencyKey },
      method: "POST",
    }),
  );

  const confirmation = parseConfirmation(row);
  if (!confirmation) throw new BookingApiError(502);
  return confirmation;
}
