// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  consumePublicBookingRateLimit,
  getPublicBookingOptions,
  restorePublicBookingConfirmation,
  restorePublicBookingHold,
} from "@/booking/service";
import { createPublicBookingSession } from "@/booking/session";

import { GET } from "./route";

vi.mock("@/booking/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/booking/service")>();

  return {
    ...actual,
    consumePublicBookingRateLimit: vi.fn(async () => true),
    getPublicBookingOptions: vi.fn(async () => ({
      bufferMinutes: 30,
      dailyLimit: 8,
      enabled: true,
      holdMinutes: 5,
      horizonDays: 60,
      minLeadMinutes: 30,
      services: [],
      slotStepMinutes: 30,
      timezone: "Europe/Sofia",
    })),
    restorePublicBookingConfirmation: vi.fn(async () => null),
    restorePublicBookingHold: vi.fn(async () => null),
  };
});

describe("public booking options route", () => {
  beforeEach(() => {
    process.env.SUPABASE_SECRET_KEY = "booking-session-route-test-secret";
    vi.clearAllMocks();
    vi.mocked(consumePublicBookingRateLimit).mockResolvedValue(true);
    vi.mocked(restorePublicBookingConfirmation).mockResolvedValue(null);
    vi.mocked(restorePublicBookingHold).mockResolvedValue(null);
  });

  it("returns public booking options for a supported locale", async () => {
    const response = await GET(new Request("https://example.com/api/public/booking/options?locale=ru"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ enabled: true, dailyLimit: 8 });
    expect(response.headers.get("set-cookie")).toMatch(
      /^magic_booking_session=v1\.[A-Za-z0-9_-]{43}\.\d{10}\.[A-Za-z0-9_-]{43}; Path=\/; Expires=.+; Max-Age=1800; Secure; HttpOnly; SameSite=strict$/,
    );
    expect(getPublicBookingOptions).toHaveBeenCalledWith("ru");
    expect(consumePublicBookingRateLimit).toHaveBeenNthCalledWith(2, expect.objectContaining({
      limit: 6,
      scope: "booking_session_issue",
    }));
  });

  it("reuses an existing booking session without issuing another one", async () => {
    const session = createPublicBookingSession();
    const response = await GET(new Request("https://example.com/api/public/booking/options?locale=ru", {
      headers: { cookie: `magic_booking_session=${session.cookieValue}` },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(consumePublicBookingRateLimit).toHaveBeenCalledTimes(1);
    expect(restorePublicBookingHold).toHaveBeenCalledWith(session.token);
    expect(restorePublicBookingConfirmation).not.toHaveBeenCalled();
  });

  it("returns the active hold restored for the verified session", async () => {
    const session = createPublicBookingSession();
    vi.mocked(restorePublicBookingHold).mockResolvedValueOnce({
      currency: "EUR",
      date: "2026-08-01",
      durationMinutes: 60,
      expiresAt: "2026-08-01T07:05:00.000Z",
      holdToken: "h".repeat(43),
      priceVariantId: "price-60",
      priceCents: 7000,
      selectionId: "11111111-1111-4111-8111-111111111111",
      selectionVersion: 1,
      serviceSlug: "classic-massage",
      specialistId: "yana-public",
      specialistName: "Яна",
      time: "10:00",
    });
    vi.mocked(getPublicBookingOptions).mockResolvedValueOnce({
      bufferMinutes: 30,
      dailyLimit: 8,
      enabled: true,
      holdMinutes: 5,
      horizonDays: 60,
      minLeadMinutes: 30,
      services: [{
        category: "massage",
        slug: "classic-massage",
        specialists: [{ displayName: "Яна", id: "yana-public" }],
        title: "Classic massage",
        variants: [{ currency: "EUR", durationMinutes: 60, id: "price-60", priceCents: 7000 }],
      }],
      slotStepMinutes: 30,
      timezone: "Europe/Sofia",
    });

    const response = await GET(new Request(
      "https://example.com/api/public/booking/options?locale=ru",
      {
      headers: { cookie: `magic_booking_session=${session.cookieValue}` },
      },
    ));

    await expect(response.json()).resolves.toMatchObject({
      activeHold: {
        date: "2026-08-01",
        holdToken: "h".repeat(43),
        selectionId: "11111111-1111-4111-8111-111111111111",
        selectionVersion: 1,
        time: "10:00",
      },
    });
  });

  it("returns a confirmed appointment when the response was lost before reload", async () => {
    const session = createPublicBookingSession();
    vi.mocked(restorePublicBookingConfirmation).mockResolvedValueOnce({
      currency: "EUR",
      date: "2026-08-01",
      durationMinutes: 60,
      priceCents: 7000,
      priceVariantId: "price-60",
      publicReference: "MMN-20260801-A1B2C3D4E5F6",
      serviceName: "Classic massage",
      serviceSlug: "classic-massage",
      specialistName: "Яна",
      status: "confirmed",
      time: "10:00",
    });

    const response = await GET(new Request(
      "https://example.com/api/public/booking/options?locale=ru&recoverConfirmation=1",
      { headers: { cookie: `magic_booking_session=${session.cookieValue}` } },
    ));

    await expect(response.json()).resolves.toMatchObject({
      activeHold: null,
      confirmation: { publicReference: "MMN-20260801-A1B2C3D4E5F6" },
    });
    expect(restorePublicBookingConfirmation).toHaveBeenCalledWith(session.token);
  });

  it("does not trust a forged syntactically valid session cookie", async () => {
    const response = await GET(new Request("https://example.com/api/public/booking/options?locale=ru", {
      headers: { cookie: `magic_booking_session=${"s".repeat(43)}` },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("magic_booking_session=v1.");
    expect(consumePublicBookingRateLimit).toHaveBeenCalledTimes(2);
    expect(restorePublicBookingHold).not.toHaveBeenCalled();
  });

  it("rejects unknown query keys and cross-site browser requests", async () => {
    const invalid = await GET(new Request("https://example.com/api/public/booking/options?locale=ru&private=true"));
    const crossSite = await GET(new Request("https://example.com/api/public/booking/options?locale=ru", {
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    }));

    expect(invalid.status).toBe(400);
    expect(crossSite.status).toBe(403);
    expect(getPublicBookingOptions).not.toHaveBeenCalled();
  });

  it("returns 429 when the shared database rate limit is exhausted", async () => {
    vi.mocked(consumePublicBookingRateLimit).mockResolvedValueOnce(false);

    const response = await GET(new Request("https://example.com/api/public/booking/options?locale=ru"));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "rate_limited" });
  });
});
