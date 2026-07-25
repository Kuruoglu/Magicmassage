import { createHmac, timingSafeEqual } from "node:crypto";

const maxLifetimeSeconds = 90 * 24 * 60 * 60;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PreferenceTokenPayload = {
  expiresAt: number;
  notificationId: string;
};

function secretFromEnv(env: NodeJS.ProcessEnv) {
  return env.EMAIL_PREFERENCES_SECRET?.trim() || env.SUPABASE_SECRET_KEY?.trim() || null;
}

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createEmailPreferenceToken(
  notificationId: string,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
) {
  const secret = secretFromEnv(env);
  if (!secret || !uuidPattern.test(notificationId)) return null;

  const payload: PreferenceTokenPayload = {
    expiresAt: Math.floor(now / 1000) + maxLifetimeSeconds,
    notificationId,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifyEmailPreferenceToken(
  token: string,
  env: NodeJS.ProcessEnv = process.env,
): { notificationId: string } | null {
  const secret = secretFromEnv(env);
  const [encoded, providedSignature, extra] = token.split(".");
  if (!secret || !encoded || !providedSignature || extra) return null;

  const expected = Buffer.from(signature(encoded, secret));
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<PreferenceTokenPayload>;
    const now = Math.floor(Date.now() / 1000);
    if (
      !uuidPattern.test(payload.notificationId ?? "")
      || !Number.isInteger(payload.expiresAt)
      || Number(payload.expiresAt) <= now
      || Number(payload.expiresAt) > now + maxLifetimeSeconds
    ) {
      return null;
    }

    return { notificationId: payload.notificationId as string };
  } catch {
    return null;
  }
}
