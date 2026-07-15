// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { consumePublicBookingRateLimit, getPublicBookingAvailability } from "@/booking/service";

import { GET } from "./route";

vi.mock("@/booking/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/booking/service")>();

  return {
    ...actual,
    consumePublicBookingRateLimit: vi.fn(async () => true),
    getPublicBookingAvailability: vi.fn(async () => ({
      days: [{ capReached: false, date: "2026-08-01", slots: ["10:00", "10:30"] }],
      enabled: true,
      from: "2026-08-01",
      priceVariantId: "price-60",
      timezone: "Europe/Sofia",
    })),
  };
});

describe("public booking availability route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(consumePublicBookingRateLimit).mockResolvedValue(true);
  });

  it("returns slots using the strict priceVariantId/from/days query", async () => {
    const response = await GET(new Request(
      "https://example.com/api/public/booking/availability?priceVariantId=price-60&from=2026-08-01&days=7",
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      days: [{ capReached: false, date: "2026-08-01", slots: ["10:00", "10:30"] }],
    });
    expect(getPublicBookingAvailability).toHaveBeenCalledWith({
      days: 7,
      from: "2026-08-01",
      priceVariantId: "price-60",
    });
  });

  it("rejects missing ranges before querying availability", async () => {
    const response = await GET(new Request(
      "https://example.com/api/public/booking/availability?priceVariantId=price-60",
    ));

    expect(response.status).toBe(400);
    expect(getPublicBookingAvailability).not.toHaveBeenCalled();
  });
});
