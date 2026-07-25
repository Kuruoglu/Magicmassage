import { NextResponse } from "next/server";

import { enforcePublicBookingRateLimit } from "@/booking/http";
import { isAllowedPublicBookingOrigin } from "@/booking/security";
import { createGiftCertificatePaymentSession } from "@/gift-certificates/payment-session";
import { getStripeClient } from "@/gift-certificates/stripe-client";
import { createGiftCertificateOrderStore } from "@/gift-certificates/order-store";
import type { GiftCertificatePaymentSession } from "@/gift-certificates/payment-session";
import { getRuntimeGiftCertificatesEnabled } from "@/content/public-content-runtime";

const rateLimitWindowMs = 60_000;
const rateLimitMaxRequests = 12;
const idempotencyCacheTtlMs = 10 * 60_000;
const maxIdempotencyCacheEntries = 256;
const maxRequestBodyChars = 16_384;
const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{16,128}$/;
const idempotentSessions = new Map<
  string,
  { expiresAt: number; payloadFingerprint: string; session: GiftCertificatePaymentSession }
>();

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
}

function jsonError(status: number) {
  return NextResponse.json(
    { error: "Unable to create gift certificate payment." },
    { status },
  );
}

function stripHoneypot(payload: unknown) {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  const website = typeof record.website === "string" ? record.website.trim() : "";
  const company = typeof record.company === "string" ? record.company.trim() : "";

  if (website || company) {
    return undefined;
  }

  const cleanPayload = { ...record };
  delete cleanPayload.company;
  delete cleanPayload.website;

  return cleanPayload;
}

function getIdempotencyKey(request: Request) {
  const header = request.headers.get("idempotency-key")?.trim();

  return header && idempotencyKeyPattern.test(header) ? header : null;
}

async function readBoundedJson(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    contentType !== "application/json"
    || (Number.isFinite(contentLength) && contentLength > maxRequestBodyChars)
  ) {
    return undefined;
  }

  const body = await request.text();
  if (body.length > maxRequestBodyChars) return undefined;

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

function readCachedSession(idempotencyKey: string, payloadFingerprint: string, now = Date.now()) {
  const cached = idempotentSessions.get(idempotencyKey);
  if (!cached) return undefined;
  if (cached.expiresAt <= now) {
    idempotentSessions.delete(idempotencyKey);
    return undefined;
  }
  if (cached.payloadFingerprint !== payloadFingerprint) return null;

  return cached.session;
}

function cacheSession(
  idempotencyKey: string,
  payloadFingerprint: string,
  session: GiftCertificatePaymentSession,
  now = Date.now(),
) {
  for (const [key, cached] of idempotentSessions) {
    if (cached.expiresAt <= now) idempotentSessions.delete(key);
  }
  while (idempotentSessions.size >= maxIdempotencyCacheEntries) {
    const oldestKey = idempotentSessions.keys().next().value as string | undefined;
    if (!oldestKey) break;
    idempotentSessions.delete(oldestKey);
  }
  idempotentSessions.set(idempotencyKey, {
    expiresAt: now + idempotencyCacheTtlMs,
    payloadFingerprint,
    session,
  });
}

export function clearGiftCertificatePaymentIntentGuardsForTests() {
  idempotentSessions.clear();
}

export function giftCertificatePaymentIntentCacheSizeForTests() {
  return idempotentSessions.size;
}

export async function POST(request: Request) {
  try {
    if (!(await getRuntimeGiftCertificatesEnabled())) {
      return jsonError(404);
    }

    if (!request.headers.get("origin") || !isAllowedPublicBookingOrigin(request)) {
      return jsonError(403);
    }

    const rateLimitError = await enforcePublicBookingRateLimit(request, {
      limit: rateLimitMaxRequests,
      scope: "gift_payment_intent",
      windowSeconds: rateLimitWindowMs / 1000,
    });
    if (rateLimitError) {
      return jsonError(429);
    }

    const payload = await readBoundedJson(request);
    const cleanPayload = stripHoneypot(payload);

    if (!cleanPayload) {
      return jsonError(400);
    }

    const idempotencyKey = getIdempotencyKey(request);
    if (!idempotencyKey) {
      return jsonError(400);
    }
    const payloadFingerprint = stableSerialize(cleanPayload);
    const cached = readCachedSession(idempotencyKey, payloadFingerprint);

    if (cached === null) return jsonError(409);
    if (cached) return NextResponse.json(cached);

    const session = await createGiftCertificatePaymentSession({
      idempotencyKey,
      orderStore: createGiftCertificateOrderStore(),
      payload: cleanPayload,
      stripe: getStripeClient(),
    });

    cacheSession(idempotencyKey, payloadFingerprint, session);

    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create payment.";
    const status = message.includes("Live gift certificate payments are disabled") ? 403 : 400;

    return jsonError(status);
  }
}
