import "server-only";

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

import type { AdminRoleId } from "@/admin/config";
import type { AdminSupabaseClient } from "@/admin/repository";
import type { AdminSupabaseEnv, AdminSupabaseEnvSource } from "@/admin/supabase-client";

type AdminSupabaseAuthOptions = {
  auth: {
    autoRefreshToken: false;
    detectSessionInUrl: false;
    persistSession: false;
  };
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

export type SupabaseAdminClient = AdminSupabaseClient & {
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

export type SupabaseAdminAuthorizationResult =
  | {
      mode: "supabase";
      ok: true;
      role: AdminRoleId;
      userId: string;
    }
  | {
      message: string;
      mode: "supabase";
      ok: false;
      statusCode: 401 | 403 | 500;
    };

type AuthorizeSupabaseAdminAccessOptions = {
  allowedRoles?: readonly AdminRoleId[];
};

type AdminActorProfileRow = {
  role?: string;
  status?: string;
  user_id?: string;
};

const serverSafeAuthOptions: AdminSupabaseAuthOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

const defaultAdminRoles = ["owner", "administrator"] satisfies AdminRoleId[];

function firstConfiguredValue(...values: Array<string | undefined>) {
  const value = values.find((item) => item?.trim());

  return value?.trim();
}

function isAdminRoleId(value: unknown): value is AdminRoleId {
  return (
    value === "owner" ||
    value === "administrator" ||
    value === "specialist" ||
    value === "editor" ||
    value === "accountant" ||
    value === "viewer"
  );
}

export function resolveSupabaseAdminEnv(env: AdminSupabaseEnvSource = process.env): AdminSupabaseEnv | null {
  const url = firstConfiguredValue(env.SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL);
  const key = firstConfiguredValue(env.SUPABASE_SECRET_KEY);

  return url && key ? { key, url } : null;
}

export function createSupabaseAdminClient(
  env: AdminSupabaseEnvSource = process.env,
  createClient: CreateSupabaseClient = createSupabaseJsClient,
): SupabaseAdminClient | null {
  const supabaseEnv = resolveSupabaseAdminEnv(env);

  if (!supabaseEnv) {
    return null;
  }

  return createClient(supabaseEnv.url, supabaseEnv.key, serverSafeAuthOptions) as SupabaseAdminClient;
}

export function getBearerToken(authorizationHeader: string | null) {
  const [scheme, token] = authorizationHeader?.split(/\s+/, 2) ?? [];

  if (scheme !== "Bearer" || !token?.trim()) {
    return undefined;
  }

  return token.trim();
}

export async function authorizeSupabaseAdminAccess(
  client: SupabaseAdminClient,
  actorToken: string | undefined,
  options: AuthorizeSupabaseAdminAccessOptions = {},
): Promise<SupabaseAdminAuthorizationResult> {
  if (!actorToken) {
    return {
      message: "Admin access requires an authenticated user.",
      mode: "supabase",
      ok: false,
      statusCode: 401,
    };
  }

  const { data: authData, error: authError } = await client.auth.getUser(actorToken);
  const actorUserId = authData.user?.id;

  if (authError || !actorUserId) {
    return {
      message: `auth.users: ${authError?.message ?? "authenticated user was not found"}`,
      mode: "supabase",
      ok: false,
      statusCode: 401,
    };
  }

  const { data: profiles, error: profileError } = await client
    .from("admin_profiles")
    .select("role, status, user_id")
    .eq("user_id", actorUserId);

  if (profileError) {
    return {
      message: `admin_profiles: ${profileError.message}`,
      mode: "supabase",
      ok: false,
      statusCode: 500,
    };
  }

  const actorProfile = (profiles?.[0] ?? null) as AdminActorProfileRow | null;
  const allowedRoles = new Set(options.allowedRoles ?? defaultAdminRoles);

  if (!isAdminRoleId(actorProfile?.role) || actorProfile.status !== "active" || !allowedRoles.has(actorProfile.role)) {
    return {
      message: "Admin access requires an active admin profile.",
      mode: "supabase",
      ok: false,
      statusCode: 403,
    };
  }

  return {
    mode: "supabase",
    ok: true,
    role: actorProfile.role,
    userId: actorUserId,
  };
}
