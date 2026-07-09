import { describe, expect, it, vi } from "vitest";

import {
  createAdminSupabaseClient,
  createAdminSupabaseServiceClient,
  resolveAdminSupabaseEnv,
  resolveAdminSupabaseServiceEnv,
} from "./supabase-client";

describe("admin Supabase client", () => {
  it("returns null when Supabase environment values are missing", () => {
    expect(resolveAdminSupabaseEnv({})).toBeNull();
    expect(resolveAdminSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co" })).toBeNull();
  });

  it("resolves supported publishable and anon key environment names", () => {
    expect(
      resolveAdminSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: " anon-key ",
        NEXT_PUBLIC_SUPABASE_URL: " https://demo.supabase.co ",
      }),
    ).toEqual({
      key: "anon-key",
      url: "https://demo.supabase.co",
    });

    expect(
      resolveAdminSupabaseEnv({
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
        SUPABASE_URL: "https://server-only.supabase.co",
      }),
    ).toEqual({
      key: "sb_publishable_demo",
      url: "https://server-only.supabase.co",
    });
  });

  it("creates a server-safe Supabase client when env is configured", () => {
    const fakeClient = { from: vi.fn() };
    const createClient = vi.fn(() => fakeClient);

    const client = createAdminSupabaseClient(
      {
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      },
      createClient,
    );

    expect(client).toBe(fakeClient);
    expect(createClient).toHaveBeenCalledWith("https://demo.supabase.co", "anon-key", {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  });

  it("resolves only server-only service role keys for admin Auth writes", () => {
    expect(
      resolveAdminSupabaseServiceEnv({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      }),
    ).toBeNull();

    expect(
      resolveAdminSupabaseServiceEnv({
        NEXT_PUBLIC_SUPABASE_URL: " https://demo.supabase.co ",
        SUPABASE_SERVICE_ROLE_KEY: " service-role-key ",
      }),
    ).toEqual({
      key: "service-role-key",
      url: "https://demo.supabase.co",
    });
  });

  it("creates a server-safe service role client for admin Auth writes", () => {
    const fakeClient = { auth: { admin: { inviteUserByEmail: vi.fn() } }, from: vi.fn() };
    const createClient = vi.fn(() => fakeClient);

    const client = createAdminSupabaseServiceClient(
      {
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        SUPABASE_URL: "https://server-only.supabase.co",
      },
      createClient,
    );

    expect(client).toBe(fakeClient);
    expect(createClient).toHaveBeenCalledWith("https://server-only.supabase.co", "service-role-key", {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  });
});
