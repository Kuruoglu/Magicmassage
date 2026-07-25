import { afterEach, describe, expect, it, vi } from "vitest";

import {
  confirmPublicBooking,
  getSofiaToday,
  loadBookingAvailability,
} from "./api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("public booking API adapter", () => {
  it("computes the availability start date in the Sofia timezone", () => {
    expect(getSofiaToday(new Date("2026-07-14T21:30:00.000Z"))).toBe("2026-07-15");
    expect(getSofiaToday(new Date("2026-01-01T22:30:00.000Z"))).toBe("2026-01-02");
  });

  it("maps backend availability days to public date indicators", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T10:00:00.000Z"));
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = new URL(String(input), "http://localhost");
      if (url.searchParams.get("from") === "2026-08-14") {
        return jsonResponse({
          enabled: true,
          timezone: "Europe/Sofia",
          days: [{ date: "2026-08-14", capReached: false, slots: ["10:00"] }],
        });
      }
      return jsonResponse({
        enabled: true,
        timezone: "Europe/Sofia",
        days: [
          { date: "2026-07-20", capReached: false, slots: ["09:00", "10:00", "11:00", "12:00"] },
          { date: "2026-07-21", capReached: false, slots: ["15:00", "16:00", "17:00"] },
          { date: "2026-07-22", capReached: false, slots: [] },
          { date: "2026-07-23", capReached: true, slots: ["10:00"] },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadBookingAvailability({ horizonDays: 60, variantId: "variant-60" })).resolves.toEqual({
      dates: [
        { date: "2026-07-20", availability: "available", slots: ["09:00", "10:00", "11:00", "12:00"] },
        { date: "2026-07-21", availability: "limited", slots: ["15:00", "16:00", "17:00"] },
        { date: "2026-07-22", availability: "unavailable", slots: [] },
        { date: "2026-07-23", availability: "unavailable", slots: ["10:00"] },
        { date: "2026-08-14", availability: "limited", slots: ["10:00"] },
      ],
    });

    const availabilityUrl = new URL(String(fetchMock.mock.calls[0][0]), "http://localhost");
    expect(Object.fromEntries(availabilityUrl.searchParams)).toEqual({
      days: "31",
      from: "2026-07-14",
      priceVariantId: "variant-60",
    });
    const secondAvailabilityUrl = new URL(String(fetchMock.mock.calls[1][0]), "http://localhost");
    expect(Object.fromEntries(secondAvailabilityUrl.searchParams)).toEqual({
      days: "29",
      from: "2026-08-14",
      priceVariantId: "variant-60",
    });
  });

  it("sends a flat confirm payload and maps publicReference", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return jsonResponse({
        durationMinutes: 60,
        publicReference: "MMN-42",
        serviceName: "Classic massage",
        status: "confirmed",
        date: "2026-07-20",
        time: "10:00",
        serviceSlug: "classic-massage",
        specialistId: "specialist-natali",
        specialistName: "Natalia Petrova",
        priceVariantId: "variant-60",
        priceCents: 5000,
        currency: "EUR",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(confirmPublicBooking({
      contact: {
        careEmailOptIn: true,
        contactPreference: "telegram",
        email: "anna@example.com",
        name: "Anna Petrova",
        phone: "+359 88 123 4567",
        privacyAccepted: true,
      },
      holdToken: "hold-token",
      idempotencyKey: "6d10a4aa-babb-42bd-9e5c-ae5cb87c3320",
      locale: "en",
      selectionId: "11111111-1111-4111-8111-111111111111",
      selectionVersion: 1,
    })).resolves.toMatchObject({
      appointment: { specialistId: "specialist-natali", specialistName: "Natalia Petrova" },
      reference: "MMN-42",
      status: "confirmed",
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe(
      "6d10a4aa-babb-42bd-9e5c-ae5cb87c3320",
    );
    expect(JSON.parse(String(init.body))).toEqual({
      careEmailOptIn: true,
      contactPreference: "telegram",
      email: "anna@example.com",
      fullName: "Anna Petrova",
      holdToken: "hold-token",
      locale: "en",
      note: "",
      phone: "+359 88 123 4567",
      privacyAccepted: true,
      selectionId: "11111111-1111-4111-8111-111111111111",
      selectionVersion: 1,
      website: "",
    });
  });
});
