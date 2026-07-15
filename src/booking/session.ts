import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { NextResponse } from "next/server";

export const publicBookingSessionCookie = "magic_booking_session";

const sessionLifetimeSeconds = 30 * 60;
const sessionTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const signaturePattern = /^[A-Za-z0-9_-]{43}$/;

function signingSecret() {
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is required for booking sessions.");
  return secret;
}

function signSessionPayload(payload: string) {
  return createHmac("sha256", signingSecret())
    .update(`magic-booking-session\0${payload}`, "utf8")
    .digest("base64url");
}

function cookieValue(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return cookieHeader
    .split(";")
    .map((part) => part.trim().split("=", 2))
    .find(([name]) => name === publicBookingSessionCookie)?.[1] ?? null;
}

export function readPublicBookingSessionToken(request: Request, now = Date.now()) {
  const configuredValue = cookieValue(request);
  if (!configuredValue) return null;

  const [version, token, issuedAtValue, signature, ...extra] = configuredValue.split(".");
  if (
    version !== "v1"
    || !sessionTokenPattern.test(token ?? "")
    || !/^\d{10}$/.test(issuedAtValue ?? "")
    || !signaturePattern.test(signature ?? "")
    || extra.length > 0
  ) return null;

  const issuedAt = Number(issuedAtValue);
  const nowSeconds = Math.floor(now / 1000);
  if (issuedAt > nowSeconds + 60 || nowSeconds - issuedAt > sessionLifetimeSeconds) return null;

  const payload = `${version}.${token}.${issuedAtValue}`;
  const expected = Buffer.from(signSessionPayload(payload), "utf8");
  const provided = Buffer.from(signature, "utf8");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  return token;
}

export function createPublicBookingSession(now = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  const payload = `v1.${token}.${Math.floor(now / 1000)}`;

  return {
    cookieValue: `${payload}.${signSessionPayload(payload)}`,
    token,
  };
}

export function attachPublicBookingSessionCookie(
  response: NextResponse,
  request: Request,
  sessionCookieValue: string,
) {
  const requestHostname = request.headers.get("host")?.split(":", 1)[0]?.trim().toLowerCase()
    || new URL(request.url).hostname.toLowerCase();
  const forwardedProto = request.headers.get("x-forwarded-proto")
    ?.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value === "http" || value === "https")
    .at(-1);
  const isLocalHostname = requestHostname === "localhost" || requestHostname === "127.0.0.1";
  const secure = forwardedProto ? forwardedProto === "https" : !isLocalHostname;

  response.cookies.set(publicBookingSessionCookie, sessionCookieValue, {
    httpOnly: true,
    maxAge: sessionLifetimeSeconds,
    path: "/",
    sameSite: "strict",
    secure,
  });

  return response;
}
