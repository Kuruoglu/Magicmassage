// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";

import {
  hashPublicBookingSecret,
  isAllowedPublicBookingOrigin,
  publicBookingRateLimitKey,
  publicBookingSessionRateLimitKey,
} from "./security";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe("public booking request security", () => {
  it("accepts same-origin requests and rejects cross-site browser requests", () => {
    expect(isAllowedPublicBookingOrigin(new Request("https://example.com/api/public/booking/options", {
      headers: { origin: "https://example.com", "sec-fetch-site": "same-origin" },
    }))).toBe(true);
    expect(isAllowedPublicBookingOrigin(new Request("https://example.com/api/public/booking/options", {
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    }))).toBe(false);
    expect(isAllowedPublicBookingOrigin(new Request("http://localhost:3101/api/public/booking/holds", {
      headers: {
        host: "127.0.0.1:3101",
        origin: "http://127.0.0.1:3101",
        "sec-fetch-site": "same-origin",
        "x-forwarded-proto": "http",
      },
    }))).toBe(true);
  });

  it("stores only deterministic SHA-256 values for tokens and rate-limit keys", () => {
    const tokenHash = hashPublicBookingSecret("opaque-token");
    const request = new Request("https://example.com/api/public/booking/options", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });
    const rateKey = publicBookingRateLimitKey(request, "options");
    const sessionRateKey = publicBookingSessionRateLimitKey("opaque-session", "holds_session");
    const spoofedFirstHopKey = publicBookingRateLimitKey(new Request(
      "https://example.com/api/public/booking/options",
      { headers: { "x-forwarded-for": "198.51.100.99, 10.0.0.1" } },
    ), "options");

    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(rateKey).toMatch(/^[a-f0-9]{64}$/);
    expect(rateKey).not.toContain("203.0.113.10");
    expect(spoofedFirstHopKey).toBe(rateKey);
    expect(sessionRateKey).toMatch(/^[a-f0-9]{64}$/);
    expect(sessionRateKey).not.toContain("opaque-session");
  });
});
