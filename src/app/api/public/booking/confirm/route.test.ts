// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmPublicBooking,
  consumePublicBookingRateLimit,
  PublicBookingServiceError,
} from "@/booking/service";
import { createPublicBookingSession } from "@/booking/session";

import { POST } from "./route";

vi.mock("@/booking/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/booking/service")>();

  return {
    ...actual,
    confirmPublicBooking: vi.fn(async () => ({
      currency: "EUR",
      date: "2026-08-01",
      durationMinutes: 60,
      priceCents: 8000,
      priceVariantId: "price-60",
      publicReference: "MMN-20260801-A1B2C3D4E5F6",
      serviceName: "Classic massage",
      serviceSlug: "classic-massage",
      status: "confirmed",
      time: "10:00",
    })),
    consumePublicBookingRateLimit: vi.fn(async () => true),
  };
});

const confirmationPayload = {
  careEmailOptIn: false,
  contactPreference: "telegram",
  email: "client@example.com",
  fullName: "Client Example",
  holdToken: "h".repeat(43),
  locale: "ru",
  note: "",
  phone: "+359 88 123 4567",
  privacyAccepted: true,
  selectionId: "11111111-1111-4111-8111-111111111111",
  selectionVersion: 1,
};

function confirmRequest(payload: unknown, idempotencyKey?: string, includeSession = true) {
  const headers = new Headers({ "content-type": "application/json", origin: "https://example.com" });
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
  if (includeSession) {
    headers.set("cookie", `magic_booking_session=${createPublicBookingSession().cookieValue}`);
  }

  return new Request("https://example.com/api/public/booking/confirm", {
    body: JSON.stringify(payload),
    headers,
    method: "POST",
  });
}

describe("public booking confirmation route", () => {
  beforeEach(() => {
    process.env.SUPABASE_SECRET_KEY = "booking-session-route-test-secret";
    vi.clearAllMocks();
    vi.mocked(consumePublicBookingRateLimit).mockResolvedValue(true);
  });

  it("requires and forwards a valid Idempotency-Key", async () => {
    const response = await POST(confirmRequest(confirmationPayload, "booking-submit-001"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "confirmed" });
    expect(confirmPublicBooking).toHaveBeenCalledWith(expect.objectContaining({
      careEmailOptIn: false,
      contactPreference: "telegram",
      idempotencyKey: "booking-submit-001",
      phoneNormalized: "359881234567",
      selectionId: "11111111-1111-4111-8111-111111111111",
      selectionVersion: 1,
      sessionToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    }));
  });

  it("rejects confirmation without a signed booking session", async () => {
    const response = await POST(confirmRequest(confirmationPayload, "booking-submit-001", false));

    expect(response.status).toBe(428);
    expect(confirmPublicBooking).not.toHaveBeenCalled();
  });

  it("rejects confirmation without an idempotency key", async () => {
    const response = await POST(confirmRequest(confirmationPayload));

    expect(response.status).toBe(400);
    expect(confirmPublicBooking).not.toHaveBeenCalled();
  });

  it("returns the required 409 cap_reached contract", async () => {
    vi.mocked(confirmPublicBooking).mockRejectedValueOnce(new PublicBookingServiceError("cap_reached"));

    const response = await POST(confirmRequest(confirmationPayload, "booking-submit-001"));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "cap_reached" });
  });
});
