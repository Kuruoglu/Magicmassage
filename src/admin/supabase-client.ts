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

type AdminAuthInviteResult = {
  data: {
    user: {
      email?: string | null;
      id: string;
    } | null;
  };
  error: {
    message: string;
  } | null;
};

type AdminAuthGetUserResult = {
  data: {
    user: {
      id: string;
    } | null;
  };
  error: {
    message: string;
  } | null;
};

export type AdminSupabaseServiceClient = AdminSupabaseClient & {
  auth: {
    admin: {
      inviteUserByEmail(
        email: string,
        options?: {
          data?: Record<string, unknown>;
          redirectTo?: string;
        },
      ): PromiseLike<AdminAuthInviteResult>;
    };
    getUser(token: string): PromiseLike<AdminAuthGetUserResult>;
  };
};

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
  const key = firstConfiguredValue(
    env.SUPABASE_PUBLISHABLE_KEY,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    env.SUPABASE_ANON_KEY,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return url && key ? { key, url } : null;
}

export function resolveAdminSupabaseServiceEnv(env: AdminSupabaseEnvSource = process.env): AdminSupabaseEnv | null {
  const url = firstConfiguredValue(env.SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL);
  const key = firstConfiguredValue(env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_SECRET_KEY, env.SUPABASE_SERVICE_KEY);

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

export function createAdminSupabaseServiceClient(
  env: AdminSupabaseEnvSource = process.env,
  createClient: CreateSupabaseClient = createSupabaseJsClient,
): AdminSupabaseServiceClient | null {
  const supabaseEnv = resolveAdminSupabaseServiceEnv(env);

  if (!supabaseEnv) {
    return null;
  }

  return createClient(supabaseEnv.url, supabaseEnv.key, serverSafeAuthOptions) as AdminSupabaseServiceClient;
}
