import { describe, expect, it } from "vitest";

import { createTotpCode } from "./totp";

describe("E2E TOTP helper", () => {
  it("matches the RFC 6238 SHA-1 vectors truncated to six digits", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

    expect(createTotpCode(secret, 59_000)).toBe("287082");
    expect(createTotpCode(secret, 1_111_111_109_000)).toBe("081804");
  });
});
