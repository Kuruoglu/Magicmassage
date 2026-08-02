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
    code?: string;
    message: string;
    status?: number;
  } | null;
};

type AdminAuthUpdateUserResult = {
  data: { user: { id: string } | null };
  error: { message: string } | null;
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
      updateUserById(
        userId: string,
        attributes: { ban_duration?: string },
      ): PromiseLike<AdminAuthUpdateUserResult>;
    };
    getUser(token: string): PromiseLike<AdminAuthGetUserResult>;
  };
};

export type SupabaseAdminAuthorizationResult =
  | {
      mode: "supabase";
      ok: true;
      role: AdminRoleId;
      specialistId?: string;
      userId: string;
    }
  | {
      message: string;
      mode: "supabase";
      ok: false;
      statusCode: 401 | 403 | 503;
    };

type AuthorizeSupabaseAdminAccessOptions = {
  allowedRoles?: readonly AdminRoleId[];
  requireAal2?: boolean;
};

type AdminActorProfileRow = {
  role?: string;
  specialist_id?: string | null;
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
export const adminAccessTokenCookieName = "mmn_admin_access_token";
export const allAdminRoles = [
  "owner",
  "administrator",
  "specialist",
  "editor",
  "accountant",
  "viewer",
] satisfies AdminRoleId[];

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

function getJwtAssuranceLevel(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return undefined;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(normalized, "base64").toString("utf8");
    const value = JSON.parse(decoded) as { aal?: unknown };
    return value.aal === "aal1" || value.aal === "aal2" ? value.aal : undefined;
  } catch {
    return undefined;
  }
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

function isInvalidAdminTokenError(error: NonNullable<AdminAuthGetUserResult["error"]>) {
  if (error.status === 401 || error.status === 403) {
    return true;
  }

  const details = `${error.code ?? ""} ${error.message}`.toLowerCase();
  return ["invalid jwt", "jwt expired", "invalid token", "session expired"].some((value) =>
    details.includes(value),
  );
}

export async function authorizeSupabaseAdminAccess(
  client: SupabaseAdminClient,
  actorToken: string | undefined,
  options: AuthorizeSupabaseAdminAccessOptions = {},
): Promise<SupabaseAdminAuthorizationResult> {
  if (!actorToken) {
    return {
      message: "Unauthorized",
      mode: "supabase",
      ok: false,
      statusCode: 401,
    };
  }

  const { data: authData, error: authError } = await client.auth.getUser(actorToken);
  const actorUserId = authData.user?.id;

  if (authError) {
    const invalidToken = isInvalidAdminTokenError(authError);
    console.error("Supabase admin auth failed", authError.message);

    return {
      message: invalidToken ? "Unauthorized" : "Service unavailable",
      mode: "supabase",
      ok: false,
      statusCode: invalidToken ? 401 : 503,
    };
  }

  if (!actorUserId) {
    console.error("Supabase admin auth failed", "authenticated user was not found");

    return {
      message: "Unauthorized",
      mode: "supabase",
      ok: false,
      statusCode: 401,
    };
  }

  const { data: profiles, error: profileError } = await client
    .from("admin_profiles")
    .select("role, specialist_id, status, user_id")
    .eq("user_id", actorUserId);

  if (profileError) {
    console.error("Supabase admin profile lookup failed", profileError.message);

    return {
      message: "Service unavailable",
      mode: "supabase",
      ok: false,
      statusCode: 503,
    };
  }

  const actorProfile = (profiles?.[0] ?? null) as AdminActorProfileRow | null;
  const allowedRoles = new Set(options.allowedRoles ?? defaultAdminRoles);

  if (!actorProfile || !isAdminRoleId(actorProfile.role)) {
    return {
      message: "Forbidden",
      mode: "supabase",
      ok: false,
      statusCode: 403,
    };
  }

  if (actorProfile.status !== "active") {
    return {
      message: "Admin profile is not active",
      mode: "supabase",
      ok: false,
      statusCode: 403,
    };
  }

  if (!allowedRoles.has(actorProfile.role)) {
    return {
      message: "Forbidden",
      mode: "supabase",
      ok: false,
      statusCode: 403,
    };
  }

  const requireAal2 = options.requireAal2 ?? true;
  if (requireAal2 && getJwtAssuranceLevel(actorToken) !== "aal2") {
    return {
      message: "Multi-factor authentication required",
      mode: "supabase",
      ok: false,
      statusCode: 401,
    };
  }

  if (actorProfile.role === "specialist" && !actorProfile.specialist_id) {
    return {
      message: "Specialist profile is not linked to a calendar",
      mode: "supabase",
      ok: false,
      statusCode: 403,
    };
  }

  return {
    mode: "supabase",
    ok: true,
    role: actorProfile.role,
    specialistId: actorProfile.specialist_id ?? undefined,
    userId: actorUserId,
  };
}
