// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextResponse } from "next/server";

import {
  attachPublicBookingSessionCookie,
  createPublicBookingSession,
  readPublicBookingSessionToken,
} from "./session";

const originalSecret = process.env.SUPABASE_SECRET_KEY;

function requestWithCookie(value: string) {
  return new Request("https://example.com/api/public/booking/options", {
    headers: { cookie: `magic_booking_session=${value}` },
  });
}

beforeEach(() => {
  process.env.SUPABASE_SECRET_KEY = "booking-session-test-secret";
});

afterEach(() => {
  process.env.SUPABASE_SECRET_KEY = originalSecret;
});

describe("public booking session cookie", () => {
  it("accepts a signed unexpired session and returns only its opaque token", () => {
    const now = Date.UTC(2026, 6, 15, 8, 0, 0);
    const session = createPublicBookingSession(now);

    expect(readPublicBookingSessionToken(requestWithCookie(session.cookieValue), now)).toBe(session.token);
    expect(session.cookieValue).not.toBe(session.token);
  });

  it("rejects forged and expired session cookies", () => {
    const now = Date.UTC(2026, 6, 15, 8, 0, 0);
    const session = createPublicBookingSession(now);
    const forged = `${session.cookieValue.slice(0, -1)}x`;

    expect(readPublicBookingSessionToken(requestWithCookie(forged), now)).toBeNull();
    expect(readPublicBookingSessionToken(
      requestWithCookie(session.cookieValue),
      now + 30 * 60_000 + 1_000,
    )).toBeNull();
  });

  it("sets Secure when an HTTPS proxy exposes an internal localhost URL", () => {
    const session = createPublicBookingSession();
    const response = attachPublicBookingSessionCookie(
      NextResponse.json({}),
      new Request("http://localhost:3000/api/public/booking/options", {
        headers: { host: "massage.example", "x-forwarded-proto": "https" },
      }),
      session.cookieValue,
    );

    expect(response.headers.get("set-cookie")).toContain("Secure");
  });
});
