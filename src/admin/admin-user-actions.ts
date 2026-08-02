import type { AdminRoleId } from "./config";
import type { AdminUserStatus } from "./domain";
import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  type SupabaseAdminClient,
} from "@/lib/supabase/admin";

export type AdminUserActionResult = {
  message: string;
  mode: "demo" | "supabase";
  ok: boolean;
  statusCode?: 401 | 403 | 500 | 503;
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
  createClient?: () => SupabaseAdminClient | null;
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
  return deps?.createClient ? deps.createClient() : createSupabaseAdminClient();
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

async function upsertAdminProfile(client: SupabaseAdminClient, input: AdminProfileUpsertInput): Promise<AdminUserActionResult> {
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
    console.error("Supabase admin profile upsert failed", error.message);

    return {
      message: "Admin user action failed.",
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
      message: "Supabase secret key is not configured.",
      mode: "demo",
      ok: false,
    };
  }

  let actorUserId: string | undefined;
  if (!deps?.skipAuthorization) {
    const authorization = await authorizeSupabaseAdminAccess(client, deps?.actorToken, { allowedRoles: ["owner"] });

    if (!authorization.ok) {
      return authorization;
    }
    actorUserId = authorization.userId;
  }

  if (input.action === "updateProfile") {
    const status = mapStatusToDatabase(input.user.status);
    if (status === "suspended" && actorUserId === input.user.id) {
      return {
        message: "You cannot suspend your own owner account.",
        mode: "supabase",
        ok: false,
        statusCode: 403,
      };
    }

    if (status === "active") {
      const unbanResult = await client.auth.admin.updateUserById(input.user.id, { ban_duration: "none" });
      if (unbanResult.error) {
        console.error("Supabase admin user unban failed", unbanResult.error.message);
        return { message: "Admin user action failed.", mode: "supabase", ok: false };
      }
    }

    const profileResult = await upsertAdminProfile(client, {
      email: normalizeEmail(input.user.email),
      name: normalizeUserText(input.user.name),
      role: input.user.role,
      status,
      userId: input.user.id,
    });
    if (!profileResult.ok || status !== "suspended") return profileResult;

    const banResult = await client.auth.admin.updateUserById(input.user.id, { ban_duration: "876000h" });
    if (banResult.error) {
      console.error("Supabase admin user ban failed", banResult.error.message);
      return {
        message: "Profile access is suspended, but Supabase Auth ban needs attention.",
        mode: "supabase",
        ok: false,
      };
    }

    return profileResult;
  }

  const inviteOptions: Parameters<SupabaseAdminClient["auth"]["admin"]["inviteUserByEmail"]>[1] = {
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
    console.error("Supabase admin invite failed", inviteResult.error.message);

    return {
      message: "Admin user action failed.",
      mode: "supabase",
      ok: false,
    };
  }

  const invitedUserId = inviteResult.data.user?.id;

  if (!invitedUserId) {
    console.error("Supabase admin invite did not return a user id");

    return {
      message: "Admin user action failed.",
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
