import { describe, expect, it } from "vitest";

import { createEmailPreferenceToken, verifyEmailPreferenceToken } from "./preferences-token";

const notificationId = "11111111-1111-4111-8111-111111111111";

describe("email preference tokens", () => {
  it("round-trips an opaque notification id with an HMAC signature", () => {
    const env = { EMAIL_PREFERENCES_SECRET: "test-preference-secret", NODE_ENV: "test" } satisfies NodeJS.ProcessEnv;
    const token = createEmailPreferenceToken(notificationId, env);

    expect(token).toBeTruthy();
    expect(token).not.toContain(notificationId);
    expect(verifyEmailPreferenceToken(token!, env)).toEqual({ notificationId });
  });

  it("rejects tampering and a different secret", () => {
    const env = { NODE_ENV: "test", SUPABASE_SECRET_KEY: "fallback-secret" } satisfies NodeJS.ProcessEnv;
    const token = createEmailPreferenceToken(notificationId, env)!;

    expect(verifyEmailPreferenceToken(`${token}x`, env)).toBeNull();
    expect(verifyEmailPreferenceToken(token, { NODE_ENV: "test", SUPABASE_SECRET_KEY: "other" })).toBeNull();
  });
});
