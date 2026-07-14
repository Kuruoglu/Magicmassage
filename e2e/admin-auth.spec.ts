import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const adminCookieName = "mmn_admin_access_token";

function configuredValue(value: string | undefined) {
  const configured = value?.trim();

  return configured || undefined;
}

function configuredBoolean(name: string) {
  const value = configuredValue(process.env[name]);

  if (!value) {
    return false;
  }

  if (!/^(true|false)$/i.test(value)) {
    throw new Error(`${name} must be either true or false.`);
  }

  return value.toLowerCase() === "true";
}

function resolveConfiguredPair(firstName: string, secondName: string) {
  const first = configuredValue(process.env[firstName]);
  const second = configuredValue(process.env[secondName]);

  if (Boolean(first) !== Boolean(second)) {
    throw new Error(`${firstName} and ${secondName} must be configured together.`);
  }

  return first && second ? { first, second } : null;
}

function resolveAdminAuthEnvironment() {
  const publicSupabasePair = resolveConfiguredPair(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
  const credentialsPair = resolveConfiguredPair("E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD");
  const required = configuredBoolean("E2E_ADMIN_AUTH_REQUIRED");

  if (required && (!publicSupabasePair || !credentialsPair)) {
    throw new Error(
      "E2E_ADMIN_AUTH_REQUIRED needs the public Supabase pair and dedicated E2E admin credentials.",
    );
  }

  return {
    credentials: credentialsPair
      ? { email: credentialsPair.first, password: credentialsPair.second }
      : null,
    publicSupabase: publicSupabasePair
      ? { publishableKey: publicSupabasePair.second, url: publicSupabasePair.first }
      : null,
    required,
  };
}

const adminAuthEnvironment = resolveAdminAuthEnvironment();

test.describe("real admin authentication", () => {
  test.skip(
    !adminAuthEnvironment.publicSupabase,
    "Configure the public Supabase URL and publishable key to run the real admin auth smoke.",
  );

  test("protects the admin workspace without a session", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole("heading", { name: "Admin login" })).toBeVisible();
  });

  test("accepts a real Supabase admin session", async ({ baseURL, context, page }) => {
    test.skip(
      !adminAuthEnvironment.credentials,
      "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for a dedicated active admin test user.",
    );

    const publicSupabase = adminAuthEnvironment.publicSupabase;
    const credentials = adminAuthEnvironment.credentials;

    expect(publicSupabase).not.toBeNull();
    expect(credentials).not.toBeNull();

    const client = createClient(publicSupabase!.url, publicSupabase!.publishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    let hasSupabaseSession = false;

    try {
      const { data, error } = await client.auth.signInWithPassword(credentials!);
      hasSupabaseSession = Boolean(data.session);

      expect(error, "Supabase rejected the configured admin E2E credentials.").toBeNull();
      expect(data.session?.access_token).toBeTruthy();

      const { error: directWriteError } = await client.from("admin_clients").insert({
        email: "direct-dml@example.com",
        full_name: "Direct DML must fail",
        id: `e2e-direct-dml-${Date.now()}`,
        locale: "ru",
        phone: "+359887000099",
        phone_normalized: "+359887000099",
      });

      expect(
        directWriteError,
        "Authenticated browser sessions must not bypass the server admin records API.",
      ).not.toBeNull();

      const sessionResponse = await fetch(new URL("/api/admin/auth/session", baseURL), {
        headers: {
          Authorization: `Bearer ${data.session!.access_token}`,
        },
        method: "POST",
      });

      expect(sessionResponse.status).toBe(200);
      await expect(sessionResponse.clone().json()).resolves.toEqual(
        expect.objectContaining({
          ok: true,
          role: expect.stringMatching(/^(owner|administrator|specialist|editor|accountant|viewer)$/),
        }),
      );

      const setCookie = sessionResponse.headers.get("set-cookie");
      const cookieMatch = setCookie?.match(new RegExp(`^${adminCookieName}=([^;]+)`));

      expect(cookieMatch?.[1], "Admin session route did not set its HTTP-only cookie.").toBeTruthy();

      await context.addCookies([
        {
          domain: new URL(baseURL!).hostname,
          httpOnly: true,
          name: adminCookieName,
          path: "/admin",
          sameSite: "Lax",
          value: decodeURIComponent(cookieMatch![1]),
        },
      ]);
      await page.goto("/admin");

      await expect(page).toHaveURL(/\/admin$/);
      await expect(page.getByRole("navigation", { name: "Admin sections" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

      await page.evaluate(async () => {
        await fetch("/api/admin/auth/logout", { method: "POST" });
      });
      await page.goto("/admin");

      await expect(page).toHaveURL(/\/admin\/login$/);
    } finally {
      if (hasSupabaseSession) {
        const { error: signOutError } = await client.auth.signOut({ scope: "local" });

        expect(signOutError, "Supabase could not close the admin E2E session.").toBeNull();
      }
    }
  });
});
