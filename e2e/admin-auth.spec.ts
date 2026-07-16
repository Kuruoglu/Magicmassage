import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { createTotpCode } from "../test/totp";

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
  const secretKey = configuredValue(process.env.SUPABASE_SECRET_KEY);
  const securityAlertId = configuredValue(process.env.E2E_SECURITY_ALERT_ID);
  const totpSecret = configuredValue(process.env.E2E_ADMIN_TOTP_SECRET);

  if (required && (!publicSupabasePair || !credentialsPair || !secretKey || !securityAlertId || !totpSecret)) {
    throw new Error(
      "E2E_ADMIN_AUTH_REQUIRED needs Supabase keys, dedicated E2E admin credentials, a run-scoped alert, and its TOTP secret.",
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
    secretKey,
    securityAlertId,
    totpSecret,
  };
}

async function countLoginAudits(client: SupabaseClient, userId: string) {
  const { count, error } = await client
    .from("admin_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "auth.login")
    .eq("actor_user_id", userId);

  expect(error, "Could not count E2E admin login audit rows.").toBeNull();
  expect(count).not.toBeNull();

  return count!;
}

async function elevateAdminSession(
  client: SupabaseClient,
  configuredTotpSecret: string | undefined,
) {
  const { data: factorData, error: factorError } = await client.auth.mfa.listFactors();

  if (factorError) {
    throw new Error(`Could not list the E2E admin MFA factors: ${factorError.message}`);
  }

  let factorId = factorData.totp.find((factor) => factor.status === "verified")?.id;
  let secret = configuredTotpSecret;

  if (!factorId) {
    for (const pendingFactor of factorData.totp.filter((factor) => factor.status !== "verified")) {
      const { error } = await client.auth.mfa.unenroll({ factorId: pendingFactor.id });
      if (error) {
        throw new Error(`Could not remove a pending E2E MFA factor: ${error.message}`);
      }
    }

    const { data: enrollment, error: enrollmentError } = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Magic Massage E2E ${Date.now()}`,
    });

    if (enrollmentError || !enrollment) {
      throw new Error(
        `Could not enroll the E2E admin MFA factor: ${enrollmentError?.message ?? "missing enrollment"}`,
      );
    }

    factorId = enrollment.id;
    secret = enrollment.totp.secret;
  }

  if (!secret) {
    throw new Error(
      "E2E_ADMIN_TOTP_SECRET is required when the configured E2E admin already has a verified MFA factor.",
    );
  }

  const { error: verifyError } = await client.auth.mfa.challengeAndVerify({
    code: createTotpCode(secret),
    factorId,
  });

  if (verifyError) {
    throw new Error(`Could not verify the E2E admin MFA factor: ${verifyError.message}`);
  }

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) {
    throw new Error(
      `Could not read the elevated E2E admin session: ${sessionError?.message ?? "missing session"}`,
    );
  }

  const { data: assurance, error: assuranceError } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();

  if (assuranceError || assurance?.currentLevel !== "aal2") {
    throw new Error(
      `E2E admin session did not reach aal2: ${assuranceError?.message ?? assurance?.currentLevel}`,
    );
  }

  return accessToken;
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
      !adminAuthEnvironment.credentials || !adminAuthEnvironment.secretKey,
      "Set dedicated E2E admin credentials and SUPABASE_SECRET_KEY for the audited auth smoke.",
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
      expect(data.user?.id).toBeTruthy();

      const serviceClient = createClient(publicSupabase!.url, adminAuthEnvironment.secretKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const loginAuditCountBefore = await countLoginAudits(serviceClient, data.user!.id);
      const aal1Response = await fetch(new URL("/api/admin/auth/session", baseURL), {
        headers: {
          Authorization: `Bearer ${data.session!.access_token}`,
        },
        method: "POST",
      });

      expect(aal1Response.status).toBe(401);
      expect(aal1Response.headers.get("set-cookie")).toBeNull();
      expect((await context.cookies()).some((cookie) => cookie.name === adminCookieName)).toBe(false);
      expect(await countLoginAudits(serviceClient, data.user!.id)).toBe(loginAuditCountBefore);

      const accessToken = await elevateAdminSession(
        client,
        adminAuthEnvironment.totpSecret,
      );

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
          Authorization: `Bearer ${accessToken}`,
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

  test("shows and resolves security alerts after a real MFA browser login", async ({ page }) => {
    test.skip(
      !adminAuthEnvironment.credentials ||
        !adminAuthEnvironment.securityAlertId ||
        !adminAuthEnvironment.totpSecret,
      "Set E2E admin credentials, a run-scoped alert, and its TOTP secret for the browser MFA flow.",
    );

    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(adminAuthEnvironment.credentials!.email);
    await page.getByLabel("Password").fill(adminAuthEnvironment.credentials!.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByLabel("Код").fill(createTotpCode(adminAuthEnvironment.totpSecret!));
    await Promise.all([
      page.waitForURL(/\/admin$/),
      page.getByRole("button", { exact: true, name: "Войти" }).click(),
    ]);

    const alertRow = page.locator(
      `[data-security-alert-id="${adminAuthEnvironment.securityAlertId}"]`,
    );

    await expect(alertRow).toBeVisible();
    await expect(alertRow).toContainText("20");
    await page.screenshot({ fullPage: true, path: "test-results/admin-security-alerts.png" });
    await page.setViewportSize({ height: 844, width: 390 });
    await expect(alertRow.getByRole("button", { name: "Просмотрено" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ fullPage: true, path: "test-results/admin-security-alerts-mobile.png" });
    await alertRow.getByRole("button", { name: "Просмотрено" }).click();
    await expect(alertRow).toHaveCount(0);
  });
});
