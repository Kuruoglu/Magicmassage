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
        specialistId: "yana-public",
        specialistName: "Яна",
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
    expect(rpc.mock.calls[0][0]).toBe("public_booking_create_hold_v6");
    expect(parameters.p_specialist_slug).toBeNull();
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
        specialistName: "Яна",
        status: "confirmed",
        time: "10:00",
      },
      error: null,
    });

    await confirmPublicBooking({
      careEmailOptIn: false,
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

    expect(rpc.mock.calls[0][0]).toBe("public_booking_confirm_session_v5");
    expect(parameters.p_care_email_opt_in).toBe(false);
    expect(parameters.p_selection_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(parameters.p_selection_version).toBe(1);
    expect(parameters.p_session_key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(parameters.p_idempotency_key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(parameters.p_contact_preference).toBe("telegram");
    expect(parameters.p_email).toBeNull();
    expect(JSON.stringify(parameters)).not.toContain("booking-submit-001");
    expect(JSON.stringify(parameters)).not.toContain("hhhhhhhh");
    expect(JSON.stringify(parameters)).not.toContain("ssssssss");
  });

  it("passes a returning client's newly submitted booking email and care opt-in to the atomic RPC", async () => {
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
        specialistName: "Яна",
        status: "confirmed",
        time: "10:00",
      },
      error: null,
    });

    await confirmPublicBooking({
      careEmailOptIn: true,
      contactPreference: "email",
      email: "new-booking-address@example.com",
      fullName: "Returning Client",
      holdToken: "h".repeat(43),
      idempotencyKey: "returning-client-submit",
      locale: "en",
      note: "",
      phone: "+359 88 123 4567",
      phoneNormalized: "359881234567",
      privacyAccepted: true,
      selectionId: "11111111-1111-4111-8111-111111111111",
      selectionVersion: 1,
      sessionToken: "s".repeat(43),
    });

    expect(rpc).toHaveBeenCalledWith("public_booking_confirm_session_v5", expect.objectContaining({
      p_care_email_opt_in: true,
      p_email: "new-booking-address@example.com",
    }));
  });

  it("falls back to the deployed v4 confirmation only when v5 is missing", async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST202", message: "Could not find the function public_booking_confirm_session_v5" },
      })
      .mockResolvedValueOnce({
        data: {
          currency: "EUR",
          date: "2026-08-01",
          durationMinutes: 60,
          priceCents: 8000,
          priceVariantId: "price-60",
          publicReference: "MMN-20260801-A1B2C3D4E5F6",
          serviceName: "Classic massage",
          serviceSlug: "classic-massage",
          specialistName: "Natali",
          status: "confirmed",
          time: "10:00",
        },
        error: null,
      });

    await expect(confirmPublicBooking({
      careEmailOptIn: false,
      contactPreference: "email",
      email: "client@example.com",
      fullName: "Client Example",
      holdToken: "h".repeat(43),
      idempotencyKey: "booking-submit-compatibility",
      locale: "ru",
      note: "",
      phone: "+359 88 123 4567",
      phoneNormalized: "359881234567",
      privacyAccepted: true,
      selectionId: "11111111-1111-4111-8111-111111111111",
      selectionVersion: 1,
      sessionToken: "s".repeat(43),
    })).resolves.toMatchObject({ status: "confirmed" });

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][0]).toBe("public_booking_confirm_session_v5");
    expect(rpc.mock.calls[1][0]).toBe("public_booking_confirm_session_v4");
    expect(rpc.mock.calls[1][1]).not.toHaveProperty("p_care_email_opt_in");
    expect(rpc.mock.calls[1][1]).toMatchObject({
      p_email: "client@example.com",
      p_selection_id: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("does not discard care consent when v5 is missing", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function public_booking_confirm_session_v5" },
    });

    await expect(confirmPublicBooking({
      careEmailOptIn: true,
      contactPreference: "email",
      email: "client@example.com",
      fullName: "Client Example",
      holdToken: "h".repeat(43),
      idempotencyKey: "booking-submit-consent",
      locale: "ru",
      note: "",
      phone: "+359 88 123 4567",
      phoneNormalized: "359881234567",
      privacyAccepted: true,
      selectionId: "11111111-1111-4111-8111-111111111111",
      selectionVersion: 1,
      sessionToken: "s".repeat(43),
    })).rejects.toEqual(new PublicBookingServiceError("booking_unavailable"));

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("public_booking_confirm_session_v5");
  });

  it("does not use the compatibility fallback for a real confirmation conflict", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "slot_unavailable" },
    });

    await expect(confirmPublicBooking({
      careEmailOptIn: false,
      contactPreference: "phone",
      email: null,
      fullName: "Client Example",
      holdToken: "h".repeat(43),
      idempotencyKey: "booking-submit-conflict",
      locale: "ru",
      note: "",
      phone: "+359 88 123 4567",
      phoneNormalized: "359881234567",
      privacyAccepted: true,
      selectionId: "11111111-1111-4111-8111-111111111111",
      selectionVersion: 1,
      sessionToken: "s".repeat(43),
    })).rejects.toEqual(new PublicBookingServiceError("slot_unavailable"));

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("public_booking_confirm_session_v5");
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
        specialistId: "yana-public",
        specialistName: "Яна",
        time: "10:00",
      },
      error: null,
    });

    const restored = await restorePublicBookingHold("s".repeat(43));
    const parameters = rpc.mock.calls[0][1];

    expect(restored?.holdToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(rpc.mock.calls[0][0]).toBe("public_booking_restore_session_hold_v6");
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
        specialistName: "Яна",
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
