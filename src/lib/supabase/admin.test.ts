import { describe, expect, it, vi } from "vitest";

import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
  resolveSupabaseAdminEnv,
  type SupabaseAdminClient,
} from "./admin";

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
    };

class FakeSupabaseAdminClient {
  readonly operations: Operation[] = [];
  authResult = {
    data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
    error: null as { message: string } | null,
  };
  profileRows: Array<{ role: string; status: string; user_id: string }> = [
    {
      role: "administrator",
      status: "active",
      user_id: "11111111-1111-4111-8111-111111111111",
    },
  ];
  profileError: { message: string } | null = null;

  readonly auth = {
    getUser: async (token: string) => {
      this.operations.push({ action: "getUser", token });

      return this.authResult;
    },
    admin: {
      inviteUserByEmail: vi.fn(),
    },
  };

  from(table: string) {
    return {
      select: (columns: string) => {
        const filters: Array<{ column: string; value: unknown }> = [];

        return {
          eq: async (column: string, value: unknown) => {
            filters.push({ column, value });
            this.operations.push({ action: "select", columns, filters, table });

            return {
              data: this.profileError ? null : this.profileRows,
              error: this.profileError,
            };
          },
        };
      },
    };
  }
}

describe("server-only Supabase admin client", () => {
  it("resolves only the server secret key", () => {
    expect(
      resolveSupabaseAdminEnv({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
        NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      }),
    ).toBeNull();

    expect(
      resolveSupabaseAdminEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    ).toBeNull();

    expect(
      resolveSupabaseAdminEnv({
        NEXT_PUBLIC_SUPABASE_URL: " https://demo.supabase.co ",
        SUPABASE_SECRET_KEY: " sb_secret_demo ",
      }),
    ).toEqual({
      key: "sb_secret_demo",
      url: "https://demo.supabase.co",
    });
  });

  it("creates a server-safe client with the secret key", () => {
    const fakeClient = { auth: { admin: { inviteUserByEmail: vi.fn() }, getUser: vi.fn() }, from: vi.fn() };
    const createClient = vi.fn(() => fakeClient);

    const client = createSupabaseAdminClient(
      {
        SUPABASE_SECRET_KEY: "sb_secret_demo",
        SUPABASE_URL: "https://server-only.supabase.co",
      },
      createClient,
    );

    expect(client).toBe(fakeClient);
    expect(createClient).toHaveBeenCalledWith("https://server-only.supabase.co", "sb_secret_demo", {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  });

  it("extracts a bearer token from the authorization header", () => {
    expect(getBearerToken("Bearer owner-token")).toBe("owner-token");
    expect(getBearerToken("Basic owner-token")).toBeUndefined();
    expect(getBearerToken(null)).toBeUndefined();
  });

  it("authorizes active owner and administrator profiles", async () => {
    const client = new FakeSupabaseAdminClient();

    await expect(
      authorizeSupabaseAdminAccess(client as unknown as SupabaseAdminClient, "admin-token", {
        allowedRoles: ["owner", "administrator"],
      }),
    ).resolves.toEqual({
      mode: "supabase",
      ok: true,
      role: "administrator",
      userId: "11111111-1111-4111-8111-111111111111",
    });
    expect(client.operations).toEqual([
      {
        action: "getUser",
        token: "admin-token",
      },
      {
        action: "select",
        columns: "role, status, user_id",
        filters: [{ column: "user_id", value: "11111111-1111-4111-8111-111111111111" }],
        table: "admin_profiles",
      },
    ]);
  });

  it("rejects missing tokens and non-admin profiles", async () => {
    const client = new FakeSupabaseAdminClient();

    await expect(authorizeSupabaseAdminAccess(client as unknown as SupabaseAdminClient, undefined)).resolves.toEqual({
      message: "Admin access requires an authenticated user.",
      mode: "supabase",
      ok: false,
      statusCode: 401,
    });
    expect(client.operations).toEqual([]);

    client.profileRows = [
      {
        role: "accountant",
        status: "active",
        user_id: "11111111-1111-4111-8111-111111111111",
      },
    ];

    await expect(
      authorizeSupabaseAdminAccess(client as unknown as SupabaseAdminClient, "accountant-token", {
        allowedRoles: ["owner", "administrator"],
      }),
    ).resolves.toEqual({
      message: "Admin access requires an active admin profile.",
      mode: "supabase",
      ok: false,
      statusCode: 403,
    });
  });
});
