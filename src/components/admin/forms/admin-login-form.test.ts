import { describe, expect, it } from "vitest";

import { createMfaFriendlyName, normalizeMfaQrCodeSrc } from "./admin-login-form-utils";

describe("normalizeMfaQrCodeSrc", () => {
  it("removes trailing whitespace from Supabase data URLs", () => {
    expect(normalizeMfaQrCodeSrc("data:image/svg+xml,<svg /> \r\n")).toBe(
      "data:image/svg+xml,<svg />",
    );
  });
});

describe("createMfaFriendlyName", () => {
  it("uses a unique timestamp to recover from abandoned enrollments", () => {
    expect(createMfaFriendlyName(1784198400000)).toBe("Magic Massage Admin 1784198400000");
  });
});
