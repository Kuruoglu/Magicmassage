import { describe, expect, it } from "vitest";

import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminUserActionInput, runAdminUserAction } from "./admin-user-actions";

type Operation =
  | {
      action: "getUser";
      token: string;
    }
  | {
      action: "select";
      columns: string;
      filters: Array<{ column: string; value: unknown }>;
      table: string;
    }
  | {
      action: "invite";
      email: string;
      options: unknown;
    }
  | {
      action: "upsert";
      options: unknown;
      table: string;
      values: unknown;
    };

class FakeAdminServiceClient {
  readonly operations: Operation[] = [];
  actorUserResult: {
    data: { user: { id: string } | null };
    error: { message: string } | null;
  } = {
    data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
    error: null,
  };
  inviteResult: {
    data: { user: { email?: string | null; id: string } | null };
    error: { message: string } | null;
  } = {
    data: { user: { email: "accountant@example.com", id: "00000000-0000-0000-0000-000000000002" } },
    error: null,
  };
  profileRows: Array<{ role: string; status: string; user_id: string }> = [
    {
      role: "owner",
      status: "active",
      user_id: "11111111-1111-4111-8111-111111111111",
    },
  ];
  profileSelectResult: { error: { message: string } | null } = { error: null };
  upsertResult: { error: { message: string } | null } = { error: null };

  readonly auth = {
    getUser: async (token: string) => {
      this.operations.push({ action: "getUser", token });

      return this.actorUserResult;
    },
    admin: {
      inviteUserByEmail: async (email: string, options?: unknown) => {
        this.operations.push({ action: "invite", email, options });

        return this.inviteResult;
      },
    },
  };

  from(table: string) {
    return {
      insert: async (values: unknown) => {
        this.operations.push({ action: "upsert", options: undefined, table, values });

        return this.upsertResult;
      },
      select: (columns: string) => {
        const filters: Array<{ column: string; value: unknown }> = [];

        return {
          eq: async (column: string, value: unknown) => {
            filters.push({ column, value });
            this.operations.push({ action: "select", columns, filters, table });

            return {
              data: this.profileSelectResult.error ? null : this.profileRows,
              error: this.profileSelectResult.error,
            };
          },
        };
      },
      upsert: async (values: unknown, options?: unknown) => {
        this.operations.push({ action: "upsert", options, table, values });

        return this.upsertResult;
      },
    };
  }
}

describe("admin user actions", () => {
  it("keeps Auth writes in demo mode when the service role key is missing", async () => {
    const result = await runAdminUserAction(
      {
        action: "invite",
        user: {
          email: "accountant@example.com",
          name: "Accountant Example",
          role: "accountant",
        },
      },
      {
        createClient: () => null,
      },
    );

    expect(result).toEqual({
      message: "Supabase secret key is not configured.",
      mode: "demo",
      ok: false,
    });
  });

  it("requires an authenticated owner before using Supabase Auth admin writes", async () => {
    const client = new FakeAdminServiceClient();

    const result = await runAdminUserAction(
      {
        action: "invite",
        user: {
          email: "accountant@example.com",
          name: "Accountant Example",
          role: "accountant",
        },
      },
      {
        createClient: () => client as unknown as SupabaseAdminClient,
      },
    );

    expect(result).toEqual({
      message: "Unauthorized",
      mode: "supabase",
      ok: false,
      statusCode: 401,
    });
    expect(client.operations).toEqual([]);
  });

  it("invites an admin user through Supabase Auth and writes the role profile", async () => {
    const client = new FakeAdminServiceClient();

    const result = await runAdminUserAction(
      {
        action: "invite",
        redirectTo: "https://example.com/admin",
        user: {
          accessNote: "Tax exports only.",
          email: "accountant@example.com",
          name: "Accountant Example",
          role: "accountant",
        },
      },
      {
        actorToken: "owner-token",
        createClient: () => client as unknown as SupabaseAdminClient,
      },
    );

    expect(result).toEqual({
      message: "Admin user invitation saved in Supabase.",
      mode: "supabase",
      ok: true,
      userId: "00000000-0000-0000-0000-000000000002",
    });
    expect(client.operations).toEqual([
      {
        action: "getUser",
        token: "owner-token",
      },
      {
        action: "select",
        columns: "role, status, user_id",
        filters: [{ column: "user_id", value: "11111111-1111-4111-8111-111111111111" }],
        table: "admin_profiles",
      },
      {
        action: "invite",
        email: "accountant@example.com",
        options: {
          data: {
            access_note: "Tax exports only.",
            admin_role: "accountant",
            display_name: "Accountant Example",
          },
          redirectTo: "https://example.com/admin",
        },
      },
      {
        action: "upsert",
        options: { onConflict: "user_id" },
        table: "admin_profiles",
        values: {
          display_name: "Accountant Example",
          email: "accountant@example.com",
          role: "accountant",
          status: "invited",
          user_id: "00000000-0000-0000-0000-000000000002",
        },
      },
    ]);
  });

  it("does not write a role profile when the Supabase Auth invite fails", async () => {
    const client = new FakeAdminServiceClient();
    client.inviteResult = {
      data: { user: null },
      error: { message: "User already registered" },
    };

    const result = await runAdminUserAction(
      {
        action: "invite",
        user: {
          email: "accountant@example.com",
          name: "Accountant Example",
          role: "accountant",
        },
      },
      {
        actorToken: "owner-token",
        createClient: () => client as unknown as SupabaseAdminClient,
      },
    );

    expect(result).toEqual({
      message: "Admin user action failed.",
      mode: "supabase",
      ok: false,
    });
    expect(client.operations).toHaveLength(3);
  });

  it("updates an existing Supabase Auth user's admin profile role", async () => {
    const client = new FakeAdminServiceClient();

    const result = await runAdminUserAction(
      {
        action: "updateProfile",
        user: {
          email: "editor@example.com",
          id: "11111111-1111-4111-8111-111111111113",
          name: "Editor Example",
          role: "editor",
        },
      },
      {
        actorToken: "owner-token",
        createClient: () => client as unknown as SupabaseAdminClient,
      },
    );

    expect(result).toEqual({
      message: "Admin user profile saved in Supabase.",
      mode: "supabase",
      ok: true,
      userId: "11111111-1111-4111-8111-111111111113",
    });
    expect(client.operations).toEqual([
      {
        action: "getUser",
        token: "owner-token",
      },
      {
        action: "select",
        columns: "role, status, user_id",
        filters: [{ column: "user_id", value: "11111111-1111-4111-8111-111111111111" }],
        table: "admin_profiles",
      },
      {
        action: "upsert",
        options: { onConflict: "user_id" },
        table: "admin_profiles",
        values: {
          display_name: "Editor Example",
          email: "editor@example.com",
          role: "editor",
          status: "active",
          user_id: "11111111-1111-4111-8111-111111111113",
        },
      },
    ]);
  });

  it("validates invite and profile update payloads", () => {
    expect(
      isAdminUserActionInput({
        action: "invite",
        user: {
          email: "accountant@example.com",
          name: "Accountant Example",
          role: "accountant",
        },
      }),
    ).toBe(true);
    expect(
      isAdminUserActionInput({
        action: "updateProfile",
        user: {
          email: "viewer@example.com",
          id: "11111111-1111-4111-8111-111111111114",
          name: "Viewer Example",
          role: "viewer",
        },
      }),
    ).toBe(true);
    expect(
      isAdminUserActionInput({
        action: "updateProfile",
        user: {
          email: "viewer@example.com",
          id: "admin-user-viewer",
          name: "Viewer Example",
          role: "viewer",
        },
      }),
    ).toBe(false);
  });
});
