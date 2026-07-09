import type { AdminRoleId } from "./config";
import type { AdminUserStatus } from "./domain";
import { createAdminSupabaseServiceClient, type AdminSupabaseServiceClient } from "./supabase-client";

export type AdminUserActionResult = {
  message: string;
  mode: "demo" | "supabase";
  ok: boolean;
  statusCode?: 401 | 403 | 500;
  userId?: string;
};

export type AdminUserInviteActionInput = {
  action: "invite";
  redirectTo?: string;
  user: {
    accessNote?: string;
    email: string;
    name: string;
    role: AdminRoleId;
  };
};

export type AdminUserProfileUpdateActionInput = {
  action: "updateProfile";
  user: {
    accessNote?: string;
    email: string;
    id: string;
    name: string;
    role: AdminRoleId;
    status?: AdminUserStatus;
  };
};

export type AdminUserActionInput = AdminUserInviteActionInput | AdminUserProfileUpdateActionInput;

type RunAdminUserActionDeps = {
  actorToken?: string;
  createClient?: () => AdminSupabaseServiceClient | null;
  skipAuthorization?: boolean;
};

type AdminProfileUpsertInput = {
  email: string;
  name: string;
  role: AdminRoleId;
  status: "active" | "invited" | "suspended";
  userId: string;
};

const adminRoleIds = new Set<AdminRoleId>(["owner", "administrator", "specialist", "editor", "accountant", "viewer"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const databaseStatusByAdminStatus = new Map<AdminUserStatus, AdminProfileUpsertInput["status"]>([
  ["Активен", "active"],
  ["Приглашен", "invited"],
  ["Пауза", "suspended"],
  ["Заблокирован", "suspended"],
]);

type AdminActorProfileRow = {
  role?: string;
  status?: string;
  user_id?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isEmail(value: unknown): value is string {
  return isNonEmptyString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isAdminRoleId(value: unknown): value is AdminRoleId {
  return typeof value === "string" && adminRoleIds.has(value as AdminRoleId);
}

function isSupabaseUserId(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function isAdminUserStatus(value: unknown): value is AdminUserStatus {
  return typeof value === "string" && databaseStatusByAdminStatus.has(value as AdminUserStatus);
}

function getServiceClient(deps?: RunAdminUserActionDeps) {
  return deps?.createClient ? deps.createClient() : createAdminSupabaseServiceClient();
}

function normalizeUserText(value: string) {
  return value.trim();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function mapStatusToDatabase(status: AdminUserStatus | undefined): AdminProfileUpsertInput["status"] {
  return status ? (databaseStatusByAdminStatus.get(status) ?? "invited") : "active";
}

async function authorizeAdminUserAction(
  client: AdminSupabaseServiceClient,
  actorToken: string | undefined,
): Promise<AdminUserActionResult> {
  if (!actorToken) {
    return {
      message: "Admin user action requires an authenticated owner.",
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

  if (actorProfile?.role !== "owner" || actorProfile.status !== "active") {
    return {
      message: "Admin user action requires an active owner profile.",
      mode: "supabase",
      ok: false,
      statusCode: 403,
    };
  }

  return {
    message: "Admin user action authorized.",
    mode: "supabase",
    ok: true,
    userId: actorUserId,
  };
}

async function upsertAdminProfile(client: AdminSupabaseServiceClient, input: AdminProfileUpsertInput): Promise<AdminUserActionResult> {
  const { error } = await client.from("admin_profiles").upsert(
    {
      display_name: input.name,
      email: input.email,
      role: input.role,
      status: input.status,
      user_id: input.userId,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return {
      message: `admin_profiles: ${error.message}`,
      mode: "supabase",
      ok: false,
    };
  }

  return {
    message:
      input.status === "invited" ? "Admin user invitation saved in Supabase." : "Admin user profile saved in Supabase.",
    mode: "supabase",
    ok: true,
    userId: input.userId,
  };
}

export function isAdminUserActionInput(input: unknown): input is AdminUserActionInput {
  if (!isObject(input) || !isObject(input.user)) {
    return false;
  }

  if (input.action === "invite") {
    return (
      isEmail(input.user.email) &&
      isNonEmptyString(input.user.name) &&
      isAdminRoleId(input.user.role) &&
      isOptionalString(input.user.accessNote) &&
      isOptionalString(input.redirectTo)
    );
  }

  if (input.action === "updateProfile") {
    return (
      isSupabaseUserId(input.user.id) &&
      isEmail(input.user.email) &&
      isNonEmptyString(input.user.name) &&
      isAdminRoleId(input.user.role) &&
      isOptionalString(input.user.accessNote) &&
      (input.user.status === undefined || isAdminUserStatus(input.user.status))
    );
  }

  return false;
}

export async function runAdminUserAction(
  input: AdminUserActionInput,
  deps?: RunAdminUserActionDeps,
): Promise<AdminUserActionResult> {
  const client = getServiceClient(deps);

  if (!client) {
    return {
      message: "Supabase service role is not configured.",
      mode: "demo",
      ok: false,
    };
  }

  if (!deps?.skipAuthorization) {
    const authorization = await authorizeAdminUserAction(client, deps?.actorToken);

    if (!authorization.ok) {
      return authorization;
    }
  }

  if (input.action === "updateProfile") {
    return upsertAdminProfile(client, {
      email: normalizeEmail(input.user.email),
      name: normalizeUserText(input.user.name),
      role: input.user.role,
      status: mapStatusToDatabase(input.user.status),
      userId: input.user.id,
    });
  }

  const inviteOptions: Parameters<AdminSupabaseServiceClient["auth"]["admin"]["inviteUserByEmail"]>[1] = {
    data: {
      admin_role: input.user.role,
      display_name: normalizeUserText(input.user.name),
    },
  };
  const accessNote = input.user.accessNote?.trim();

  if (accessNote) {
    inviteOptions.data = {
      ...inviteOptions.data,
      access_note: accessNote,
    };
  }

  if (input.redirectTo?.trim()) {
    inviteOptions.redirectTo = input.redirectTo.trim();
  }

  const inviteResult = await client.auth.admin.inviteUserByEmail(normalizeEmail(input.user.email), inviteOptions);

  if (inviteResult.error) {
    return {
      message: `auth.users: ${inviteResult.error.message}`,
      mode: "supabase",
      ok: false,
    };
  }

  const invitedUserId = inviteResult.data.user?.id;

  if (!invitedUserId) {
    return {
      message: "auth.users: invite did not return a user id.",
      mode: "supabase",
      ok: false,
    };
  }

  return upsertAdminProfile(client, {
    email: normalizeEmail(inviteResult.data.user?.email ?? input.user.email),
    name: normalizeUserText(input.user.name),
    role: input.user.role,
    status: "invited",
    userId: invitedUserId,
  });
}
