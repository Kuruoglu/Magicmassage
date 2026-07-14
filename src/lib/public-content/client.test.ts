import { describe, expect, it, vi } from "vitest";

import {
  createPublicContentSupabaseClient,
  resolvePublicContentSupabaseEnv,
} from "./client";

describe("public content Supabase client", () => {
  it("requires the public URL and publishable key", () => {
    expect(resolvePublicContentSupabaseEnv({})).toBeNull();
    expect(
      resolvePublicContentSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      }),
    ).toBeNull();
    expect(
      resolvePublicContentSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " publishable ",
        NEXT_PUBLIC_SUPABASE_URL: " https://example.supabase.co ",
      }),
    ).toEqual({ key: "publishable", url: "https://example.supabase.co" });
  });

  it("never falls back to a service or secret key", () => {
    const serviceRoleJwt = [
      "header",
      Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url"),
      "signature",
    ].join(".");

    expect(
      resolvePublicContentSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SECRET_KEY: "secret",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      }),
    ).toBeNull();
    expect(
      resolvePublicContentSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_private",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toBeNull();
    expect(
      resolvePublicContentSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: serviceRoleJwt,
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toBeNull();
  });

  it("creates a sessionless server client", () => {
    const client = { from: vi.fn() };
    const createClient = vi.fn(() => client);

    expect(
      createPublicContentSupabaseClient(
        {
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
          NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        },
        createClient,
      ),
    ).toBe(client);
    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "publishable",
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
  });
});
