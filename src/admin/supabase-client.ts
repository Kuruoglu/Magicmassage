import "server-only";

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

import type { AdminSupabaseClient } from "./repository";

export type AdminSupabaseEnvSource = Record<string, string | undefined>;

type AdminSupabaseAuthOptions = {
  auth: {
    autoRefreshToken: false;
    detectSessionInUrl: false;
    persistSession: false;
  };
};

export type AdminSupabaseEnv = {
  key: string;
  url: string;
};

type CreateSupabaseClient = (url: string, key: string, options: AdminSupabaseAuthOptions) => unknown;

const serverSafeAuthOptions: AdminSupabaseAuthOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

function firstConfiguredValue(...values: Array<string | undefined>) {
  const value = values.find((item) => item?.trim());

  return value?.trim();
}

export function resolveAdminSupabaseEnv(env: AdminSupabaseEnvSource = process.env): AdminSupabaseEnv | null {
  const url = firstConfiguredValue(env.SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL);
  const key = firstConfiguredValue(env.SUPABASE_SECRET_KEY, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  return url && key ? { key, url } : null;
}

export function createAdminSupabaseClient(
  env: AdminSupabaseEnvSource = process.env,
  createClient: CreateSupabaseClient = createSupabaseJsClient,
): AdminSupabaseClient | null {
  const supabaseEnv = resolveAdminSupabaseEnv(env);

  if (!supabaseEnv) {
    return null;
  }

  return createClient(supabaseEnv.url, supabaseEnv.key, serverSafeAuthOptions) as AdminSupabaseClient;
}
