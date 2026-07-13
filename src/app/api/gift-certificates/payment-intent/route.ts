import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { createGiftCertificatePaymentSession } from "@/gift-certificates/payment-session";
import { getStripeClient } from "@/gift-certificates/stripe-client";
import type { GiftCertificatePaymentSession } from "@/gift-certificates/payment-session";

const rateLimitWindowMs = 60_000;
const rateLimitMaxRequests = 12;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const idempotentSessions = new Map<string, GiftCertificatePaymentSession>();

function jsonError(status: number) {
  return NextResponse.json(
    { error: "Unable to create gift certificate payment." },
    { status },
  );
}

function getClientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "local"
  );
}

function consumeRateLimit(request: Request, now = Date.now()) {
  const key = getClientKey(request);
  const current = rateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    return true;
  }

  current.count += 1;

  return current.count <= rateLimitMaxRequests;
}

function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? requestUrl.host;
  const allowedOrigins = new Set([requestUrl.origin, `${requestUrl.protocol}//${host}`]);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (siteUrl) {
    allowedOrigins.add(new URL(siteUrl).origin);
  }

  return allowedOrigins.has(origin);
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

  return header || randomUUID();
}

export function clearGiftCertificatePaymentIntentGuardsForTests() {
  idempotentSessions.clear();
  rateLimitBuckets.clear();
}

export async function POST(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      return jsonError(403);
    }

    if (!consumeRateLimit(request)) {
      return jsonError(429);
    }

    const payload = await request.json();
    const cleanPayload = stripHoneypot(payload);

    if (!cleanPayload) {
      return jsonError(400);
    }

    const idempotencyKey = getIdempotencyKey(request);
    const cachedSession = idempotentSessions.get(idempotencyKey);

    if (cachedSession) {
      return NextResponse.json(cachedSession);
    }

    const session = await createGiftCertificatePaymentSession({
      idempotencyKey,
      payload: cleanPayload,
      stripe: getStripeClient(),
    });

    idempotentSessions.set(idempotencyKey, session);

    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create payment.";
    const status = message.includes("Live gift certificate payments are disabled") ? 403 : 400;

    return jsonError(status);
  }
}
