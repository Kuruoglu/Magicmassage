// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  consumePublicBookingRateLimit,
  createPublicBookingHold,
  PublicBookingServiceError,
} from "@/booking/service";
import { createPublicBookingSession } from "@/booking/session";

import { POST } from "./route";

vi.mock("@/booking/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/booking/service")>();

  return {
    ...actual,
    consumePublicBookingRateLimit: vi.fn(async () => true),
    createPublicBookingHold: vi.fn(async () => ({
      currency: "EUR",
      date: "2026-08-01",
      durationMinutes: 60,
      expiresAt: "2026-08-01T07:05:00.000Z",
      holdToken: "h".repeat(43),
      priceVariantId: "price-60",
      priceCents: 8000,
      selectionId: "11111111-1111-4111-8111-111111111111",
      selectionVersion: 1,
      time: "10:00",
    })),
  };
});

let bookingSession: ReturnType<typeof createPublicBookingSession>;

function holdRequest(payload: unknown) {
  return new Request("https://example.com/api/public/booking/holds", {
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
      cookie: `magic_booking_session=${bookingSession.cookieValue}`,
      origin: "https://example.com",
    },
    method: "POST",
  });
}

describe("public booking holds route", () => {
  beforeEach(() => {
    process.env.SUPABASE_SECRET_KEY = "booking-session-route-test-secret";
    bookingSession = createPublicBookingSession();
    vi.clearAllMocks();
    vi.mocked(consumePublicBookingRateLimit).mockResolvedValue(true);
  });

  it("creates a five-minute hold through the server RPC adapter", async () => {
    const response = await POST(holdRequest({
      date: "2026-08-01",
      priceVariantId: "price-60",
      time: "10:00",
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ holdToken: "h".repeat(43) });
    expect(createPublicBookingHold).toHaveBeenCalledWith(expect.objectContaining({
      date: "2026-08-01",
      priceVariantId: "price-60",
      sessionToken: bookingSession.token,
      time: "10:00",
    }));
    expect(consumePublicBookingRateLimit).toHaveBeenNthCalledWith(1, expect.objectContaining({
      limit: 6,
      scope: "holds_ip",
    }));
    expect(consumePublicBookingRateLimit).toHaveBeenNthCalledWith(2, expect.objectContaining({
      keyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      limit: 4,
      scope: "holds_session",
    }));
  });

  it("requires the rate-limited booking session issued by options", async () => {
    const request = holdRequest({
      date: "2026-08-01",
      priceVariantId: "price-60",
      time: "10:00",
    });
    request.headers.delete("cookie");

    const response = await POST(request);

    expect(response.status).toBe(428);
    await expect(response.json()).resolves.toEqual({ error: "booking_session_required" });
    expect(createPublicBookingHold).not.toHaveBeenCalled();
  });

  it("rejects a forged booking session cookie", async () => {
    const request = holdRequest({
      date: "2026-08-01",
      priceVariantId: "price-60",
      time: "10:00",
    });
    request.headers.set("cookie", `magic_booking_session=${"s".repeat(43)}`);

    const response = await POST(request);

    expect(response.status).toBe(428);
    expect(createPublicBookingHold).not.toHaveBeenCalled();
  });

  it("reuses the opaque HttpOnly booking session cookie", async () => {
    const request = holdRequest({
      date: "2026-08-01",
      priceVariantId: "price-60",
      time: "10:00",
    });
    request.headers.set("cookie", `magic_booking_session=${bookingSession.cookieValue}`);

    await POST(request);

    expect(createPublicBookingHold).toHaveBeenCalledWith(expect.objectContaining({
      sessionToken: bookingSession.token,
    }));
  });

  it("rejects a filled honeypot without creating a hold", async () => {
    const response = await POST(holdRequest({
      date: "2026-08-01",
      priceVariantId: "price-60",
      time: "10:00",
      website: "https://spam.example",
    }));

    expect(response.status).toBe(400);
    expect(createPublicBookingHold).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(new Request("https://example.com/api/public/booking/holds", {
      body: "{not-json",
      headers: {
        "content-type": "application/json",
        cookie: `magic_booking_session=${bookingSession.cookieValue}`,
        origin: "https://example.com",
      },
      method: "POST",
    }));

    expect(response.status).toBe(400);
    expect(createPublicBookingHold).not.toHaveBeenCalled();
  });

  it("maps slot conflicts to 409 without exposing database details", async () => {
    vi.mocked(createPublicBookingHold).mockRejectedValueOnce(new PublicBookingServiceError("slot_unavailable"));

    const response = await POST(holdRequest({
      date: "2026-08-01",
      priceVariantId: "price-60",
      time: "10:00",
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "slot_unavailable" });
  });
});
