import "server-only";

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

import type { PublicContentSupabaseClient } from "./types";

export type PublicContentEnvSource = Record<string, string | undefined>;

export type PublicContentSupabaseEnv = {
  key: string;
  url: string;
};

type PublicClientOptions = {
  auth: {
    autoRefreshToken: false;
    detectSessionInUrl: false;
    persistSession: false;
  };
};

type CreateSupabaseClient = (url: string, key: string, options: PublicClientOptions) => unknown;

const serverReadOnlyAuthOptions: PublicClientOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function hasServiceRoleClaim(key: string) {
  const [, encodedPayload] = key.split(".");

  if (!encodedPayload || key.split(".").length !== 3) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      role?: unknown;
    };

    return payload.role === "service_role";
  } catch {
    return false;
  }
}

function isPublishableKey(key: string) {
  return !key.startsWith("sb_secret_") && !hasServiceRoleClaim(key);
}

export function resolvePublicContentSupabaseEnv(
  env: PublicContentEnvSource = process.env,
): PublicContentSupabaseEnv | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !key || !isHttpUrl(url) || !isPublishableKey(key)) {
    return null;
  }

  return { key, url };
}

export function createPublicContentSupabaseClient(
  env: PublicContentEnvSource = process.env,
  createClient: CreateSupabaseClient = createSupabaseJsClient,
): PublicContentSupabaseClient | null {
  const supabaseEnv = resolvePublicContentSupabaseEnv(env);

  if (!supabaseEnv) {
    return null;
  }

  return createClient(
    supabaseEnv.url,
    supabaseEnv.key,
    serverReadOnlyAuthOptions,
  ) as PublicContentSupabaseClient;
}
