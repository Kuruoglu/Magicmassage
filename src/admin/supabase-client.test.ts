import { describe, expect, it, vi } from "vitest";

import {
  createAdminSupabaseClient,
  resolveAdminSupabaseEnv,
} from "./supabase-client";

describe("admin Supabase client", () => {
  it("returns null when Supabase environment values are missing", () => {
    expect(resolveAdminSupabaseEnv({})).toBeNull();
    expect(resolveAdminSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co" })).toBeNull();
  });

  it("resolves only the public publishable key environment name", () => {
    expect(
      resolveAdminSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " sb_publishable_demo ",
        NEXT_PUBLIC_SUPABASE_URL: " https://demo.supabase.co ",
      }),
    ).toEqual({
      key: "sb_publishable_demo",
      url: "https://demo.supabase.co",
    });

    expect(
      resolveAdminSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      }),
    ).toBeNull();
  });

  it("creates a server-safe Supabase client when env is configured", () => {
    const fakeClient = { from: vi.fn() };
    const createClient = vi.fn(() => fakeClient);

    const client = createAdminSupabaseClient(
      {
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
        NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      },
      createClient,
    );

    expect(client).toBe(fakeClient);
    expect(createClient).toHaveBeenCalledWith("https://demo.supabase.co", "sb_publishable_demo", {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  });
});
