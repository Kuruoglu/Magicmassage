import "server-only";

import { createHash } from "node:crypto";

function configuredSiteOrigin() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) return null;

  try {
    return new URL(siteUrl).origin;
  } catch {
    return null;
  }
}

export function isAllowedPublicBookingOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  const requestUrl = new URL(request.url);
  const allowedOrigins = new Set([requestUrl.origin]);
  const siteOrigin = configuredSiteOrigin();

  if (siteOrigin) allowedOrigins.add(siteOrigin);
  if (allowedOrigins.has(origin)) return true;

  try {
    const originUrl = new URL(origin);
    const requestHost = request.headers.get("host")?.trim();
    const forwardedProto = request.headers.get("x-forwarded-proto")
      ?.split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .at(-1);
    const protocolMatches = !forwardedProto || originUrl.protocol === `${forwardedProto}:`;

    // Next can expose its internal localhost URL while preserving the public Host header.
    return Boolean(requestHost && originUrl.host === requestHost && protocolMatches);
  } catch {
    return false;
  }
}

export function hashPublicBookingSecret(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function publicBookingRateLimitSalt() {
  return process.env.BOOKING_RATE_LIMIT_SECRET?.trim()
    || process.env.SUPABASE_SECRET_KEY?.trim()
    || "magic-massage-public-booking";
}

export function publicBookingRateLimitKey(request: Request, scope: string) {
  // A trusted edge appends the observed client address, so use the rightmost hop
  // instead of accepting a client-controlled first X-Forwarded-For value.
  const forwardedFor = request.headers.get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .at(-1);
  const clientAddress = forwardedFor || request.headers.get("x-real-ip")?.trim() || "unknown";

  return hashPublicBookingSecret(`${publicBookingRateLimitSalt()}\u0000${scope}\u0000${clientAddress}`);
}

export function publicBookingSessionRateLimitKey(sessionToken: string, scope: string) {
  return hashPublicBookingSecret(`${publicBookingRateLimitSalt()}\u0000${scope}\u0000${sessionToken}`);
}
