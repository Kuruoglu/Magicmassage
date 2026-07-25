"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null | undefined;

function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  return url && key ? { key, url } : null;
}

export function getSupabaseBrowserClient() {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const env = getPublicSupabaseEnv();

  if (!env) {
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = createClient(env.url, env.key, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });

  return cachedClient;
}

export function createSupabasePasswordRecoveryClient() {
  const env = getPublicSupabaseEnv();
  if (!env) {
    return null;
  }

  return createClient(env.url, env.key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: true,
      persistSession: false,
    },
  });
}

export async function getAdminAccessToken() {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return undefined;
  }

  const { data } = await client.auth.getSession();

  return data.session?.access_token;
}

export async function getAdminAuthorizationHeader() {
  const token = await getAdminAccessToken();

  return token ? `Bearer ${token}` : undefined;
}

export async function signOutAdminBrowserSession() {
  const client = getSupabaseBrowserClient();

  if (client) {
    await client.auth.signOut();
  }
}
