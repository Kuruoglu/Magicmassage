import "server-only";

import { randomBytes } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { hashPublicBookingSecret } from "./security";
import type {
  ConfirmPublicBookingInput,
  CreatePublicBookingHoldInput,
  PublicBookingAvailability,
  PublicBookingConfirmation,
  PublicBookingErrorCode,
  PublicBookingHold,
  PublicBookingLocale,
  PublicBookingOptions,
  PublicBookingRestoredHold,
} from "./types";

type BookingRpcError = {
  code?: string;
  message?: string;
};

type BookingRpcResult = {
  data: unknown;
  error: BookingRpcError | null;
};

type BookingRpcClient = {
  rpc(functionName: string, parameters: Record<string, unknown>): PromiseLike<BookingRpcResult>;
};

const knownErrorCodes = new Set<PublicBookingErrorCode>([
  "booking_unavailable",
  "cap_reached",
  "invalid_request",
  "slot_unavailable",
]);

export class PublicBookingServiceError extends Error {
  constructor(public readonly code: PublicBookingErrorCode) {
    super(code);
    this.name = "PublicBookingServiceError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorCodeFromRpc(error: BookingRpcError): PublicBookingErrorCode | null {
  const message = error.message ?? "";
  for (const code of knownErrorCodes) {
    if (message.includes(code)) return code;
  }

  return error.code === "22023" ? "invalid_request" : null;
}

function bookingClient(): BookingRpcClient {
  const client = createSupabaseAdminClient();
  if (!client) throw new PublicBookingServiceError("booking_unavailable");

  return client as unknown as BookingRpcClient;
}

async function callBookingRpc(functionName: string, parameters: Record<string, unknown>) {
  const { data, error } = await bookingClient().rpc(functionName, parameters);
  if (!error) return data;

  const knownCode = errorCodeFromRpc(error);
  if (knownCode) throw new PublicBookingServiceError(knownCode);

  console.error("Public booking RPC failed", {
    code: error.code ?? "unknown",
    operation: functionName,
  });
  throw new PublicBookingServiceError("booking_unavailable");
}

function requireRecord<T>(value: unknown, requiredKeys: readonly string[]): T {
  if (!isRecord(value) || requiredKeys.some((key) => !(key in value))) {
    throw new PublicBookingServiceError("booking_unavailable");
  }

  return value as T;
}

export async function getPublicBookingOptions(locale: PublicBookingLocale) {
  const data = await callBookingRpc("public_booking_get_options", { p_locale: locale });

  return requireRecord<PublicBookingOptions>(data, ["enabled", "timezone", "services"]);
}

export async function getPublicBookingAvailability(input: {
  days: number;
  from: string;
  priceVariantId: string;
}) {
  const data = await callBookingRpc("public_booking_get_availability", {
    p_days: input.days,
    p_from: input.from,
    p_price_variant_id: input.priceVariantId,
  });

  return requireRecord<PublicBookingAvailability>(data, ["enabled", "timezone", "days"]);
}

export async function createPublicBookingHold(
  input: CreatePublicBookingHoldInput & { sessionToken: string },
): Promise<PublicBookingHold> {
  const holdToken = randomBytes(32).toString("base64url");
  const data = await callBookingRpc("public_booking_create_hold_v4", {
    p_price_variant_id: input.priceVariantId,
    p_session_key_hash: hashPublicBookingSecret(input.sessionToken),
    p_starts_at: input.time,
    p_starts_on: input.date,
    p_token_hash: hashPublicBookingSecret(holdToken),
  });
  const hold = requireRecord<Omit<PublicBookingHold, "holdToken">>(data, [
    "priceVariantId",
    "priceCents",
    "currency",
    "durationMinutes",
    "date",
    "time",
    "expiresAt",
    "selectionId",
    "selectionVersion",
  ]);

  return { ...hold, holdToken };
}

export async function restorePublicBookingHold(
  sessionToken: string,
): Promise<PublicBookingRestoredHold | null> {
  const holdToken = randomBytes(32).toString("base64url");
  const data = await callBookingRpc("public_booking_restore_session_hold_v4", {
    p_session_key_hash: hashPublicBookingSecret(sessionToken),
    p_token_hash: hashPublicBookingSecret(holdToken),
  });
  if (data === null) return null;

  const hold = requireRecord<Omit<PublicBookingRestoredHold, "holdToken">>(data, [
    "serviceSlug",
    "priceVariantId",
    "priceCents",
    "currency",
    "durationMinutes",
    "date",
    "time",
    "expiresAt",
    "selectionId",
    "selectionVersion",
  ]);

  return { ...hold, holdToken };
}

export async function confirmPublicBooking(
  input: ConfirmPublicBookingInput & { sessionToken: string },
) {
  const data = await callBookingRpc("public_booking_confirm_session_v4", {
    p_contact_preference: input.contactPreference,
    p_email: input.email,
    p_full_name: input.fullName,
    p_idempotency_key_hash: hashPublicBookingSecret(input.idempotencyKey),
    p_locale: input.locale,
    p_phone: input.phone,
    p_phone_normalized: input.phoneNormalized,
    p_privacy_accepted: input.privacyAccepted,
    p_public_note: input.note,
    p_selection_id: input.selectionId,
    p_selection_version: input.selectionVersion,
    p_session_key_hash: hashPublicBookingSecret(input.sessionToken),
  });

  return requireRecord<PublicBookingConfirmation>(data, [
    "publicReference",
    "status",
    "date",
    "time",
    "serviceSlug",
    "priceVariantId",
    "priceCents",
    "currency",
    "durationMinutes",
    "serviceName",
  ]);
}

export async function restorePublicBookingConfirmation(
  sessionToken: string,
): Promise<PublicBookingConfirmation | null> {
  const data = await callBookingRpc("public_booking_restore_session_confirmation", {
    p_session_key_hash: hashPublicBookingSecret(sessionToken),
  });
  if (data === null) return null;

  return requireRecord<PublicBookingConfirmation>(data, [
    "publicReference",
    "status",
    "date",
    "time",
    "serviceSlug",
    "serviceName",
    "priceVariantId",
    "durationMinutes",
    "priceCents",
    "currency",
  ]);
}

export async function consumePublicBookingRateLimit(input: {
  keyHash: string;
  limit: number;
  scope: string;
  windowSeconds: number;
}) {
  const data = await callBookingRpc("public_booking_consume_rate_limit", {
    p_key_hash: input.keyHash,
    p_limit: input.limit,
    p_scope: input.scope,
    p_window_seconds: input.windowSeconds,
  });

  if (typeof data !== "boolean") throw new PublicBookingServiceError("booking_unavailable");
  return data;
}
