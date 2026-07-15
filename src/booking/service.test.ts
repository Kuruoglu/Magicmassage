// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmPublicBooking,
  createPublicBookingHold,
  PublicBookingServiceError,
  restorePublicBookingConfirmation,
  restorePublicBookingHold,
} from "./service";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({ rpc })),
}));

describe("public booking service RPC adapter", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("returns a raw opaque hold token while persisting only its hash", async () => {
    rpc.mockResolvedValue({
      data: {
        currency: "EUR",
        date: "2026-08-01",
        durationMinutes: 60,
        expiresAt: "2026-08-01T07:05:00.000Z",
        priceCents: 8000,
        priceVariantId: "price-60",
        selectionId: "11111111-1111-4111-8111-111111111111",
        selectionVersion: 1,
        time: "10:00",
      },
      error: null,
    });

    const result = await createPublicBookingHold({
      date: "2026-08-01",
      priceVariantId: "price-60",
      sessionToken: "s".repeat(43),
      time: "10:00",
    });
    const parameters = rpc.mock.calls[0][1];

    expect(result.holdToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(parameters.p_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(parameters.p_session_key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(parameters.p_token_hash).not.toBe(result.holdToken);
    expect(rpc.mock.calls[0][0]).toBe("public_booking_create_hold_v4");
    expect(JSON.stringify(parameters)).not.toContain("ssssssss");
  });

  it("hashes the signed session and idempotency key before calling the atomic RPC", async () => {
    rpc.mockResolvedValue({
      data: {
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
      },
      error: null,
    });

    await confirmPublicBooking({
      contactPreference: "telegram",
      email: null,
      fullName: "Client Example",
      holdToken: "h".repeat(43),
      idempotencyKey: "booking-submit-001",
      locale: "ru",
      note: "",
      phone: "+359 88 123 4567",
      phoneNormalized: "359881234567",
      privacyAccepted: true,
      selectionId: "11111111-1111-4111-8111-111111111111",
      selectionVersion: 1,
      sessionToken: "s".repeat(43),
    });
    const parameters = rpc.mock.calls[0][1];

    expect(rpc.mock.calls[0][0]).toBe("public_booking_confirm_session_v4");
    expect(parameters.p_selection_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(parameters.p_selection_version).toBe(1);
    expect(parameters.p_session_key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(parameters.p_idempotency_key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(parameters.p_contact_preference).toBe("telegram");
    expect(JSON.stringify(parameters)).not.toContain("booking-submit-001");
    expect(JSON.stringify(parameters)).not.toContain("hhhhhhhh");
    expect(JSON.stringify(parameters)).not.toContain("ssssssss");
  });

  it("rotates and returns an active hold token for a verified session", async () => {
    rpc.mockResolvedValue({
      data: {
        currency: "EUR",
        date: "2026-08-01",
        durationMinutes: 60,
        expiresAt: "2026-08-01T07:05:00.000Z",
        priceCents: 8000,
        priceVariantId: "price-60",
        selectionId: "11111111-1111-4111-8111-111111111111",
        selectionVersion: 1,
        serviceSlug: "classic-massage",
        time: "10:00",
      },
      error: null,
    });

    const restored = await restorePublicBookingHold("s".repeat(43));
    const parameters = rpc.mock.calls[0][1];

    expect(restored?.holdToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(rpc.mock.calls[0][0]).toBe("public_booking_restore_session_hold_v4");
    expect(parameters.p_session_key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(parameters.p_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(parameters.p_token_hash).not.toBe(restored?.holdToken);
  });

  it("restores a confirmed appointment through the verified session", async () => {
    rpc.mockResolvedValue({
      data: {
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
      },
      error: null,
    });

    await expect(restorePublicBookingConfirmation("s".repeat(43))).resolves.toMatchObject({
      publicReference: "MMN-20260801-A1B2C3D4E5F6",
    });
    expect(rpc.mock.calls[0][0]).toBe("public_booking_restore_session_confirmation");
    expect(rpc.mock.calls[0][1].p_session_key_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("maps database conflicts to stable public error codes", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "slot_unavailable" } });

    await expect(createPublicBookingHold({
      date: "2026-08-01",
      priceVariantId: "price-60",
      sessionToken: "s".repeat(43),
      time: "10:00",
    })).rejects.toEqual(new PublicBookingServiceError("slot_unavailable"));
  });
});
