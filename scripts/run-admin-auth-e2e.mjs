import { spawnSync } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
const require = createRequire(import.meta.url);
const playwrightCli = require.resolve("@playwright/test/cli");
const required = process.argv.includes("--required");
const playwrightArgs = process.argv.slice(2).filter((argument) => argument !== "--required");

loadEnvConfig(process.cwd());

function configuredValue(name) {
  return process.env[name]?.trim() || undefined;
}

function decodeBase32(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = value
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "")
    .split("")
    .map((character) => alphabet.indexOf(character).toString(2).padStart(5, "0"))
    .join("");
  const bytes = [];

  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }

  return Buffer.from(bytes);
}

function createTotpCode(secret, timestamp = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 30_000)));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binaryCode =
    (digest[offset] & 0x7f) * 0x1000000 +
    digest[offset + 1] * 0x10000 +
    digest[offset + 2] * 0x100 +
    digest[offset + 3];

  return String(binaryCode % 1_000_000).padStart(6, "0");
}

async function runCleanupSteps(steps) {
  const failures = [];

  for (const [label, operation] of steps) {
    try {
      const result = await operation();
      if (result?.error) {
        failures.push(`${label}: ${result.error.message}`);
      }
    } catch (error) {
      failures.push(`${label}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

async function failAfterCleanup(message, steps) {
  try {
    await runCleanupSteps(steps);
  } catch (cleanupError) {
    throw new Error(
      `${message} Cleanup also failed: ${cleanupError instanceof Error ? cleanupError.message : "unknown error"}`,
    );
  }

  throw new Error(message);
}

async function createRunSecurityAlert(serviceClient, userId) {
  const { data, error } = await serviceClient
    .from("admin_security_alerts")
    .insert({
      actor_user_id: userId,
      alert_type: "bulk_contact_reveal",
      metadata: {
        contactRevealCount: 20,
        e2eRunId: randomUUID(),
        windowMinutes: 10,
      },
      severity: "warning",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(`Could not provision the E2E security alert: ${error?.message ?? "missing alert id"}`);
  }

  return data.id;
}

async function resolveConfiguredUserId(url, publishableKey, credentials) {
  const authClient = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword(credentials);
  const userId = data.user?.id;
  const { error: signOutError } = await authClient.auth.signOut({ scope: "local" });

  if (error || !userId) {
    throw new Error(`Could not resolve the configured E2E admin user: ${error?.message ?? "missing user"}`);
  }
  if (signOutError) {
    throw new Error(`Could not close the configured E2E lookup session: ${signOutError.message}`);
  }

  return userId;
}

async function provisionEphemeralAdmin() {
  const url = configuredValue("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = configuredValue("SUPABASE_SECRET_KEY");
  const publishableKey = configuredValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const configuredEmail = configuredValue("E2E_ADMIN_EMAIL");
  const configuredPassword = configuredValue("E2E_ADMIN_PASSWORD");

  if (Boolean(configuredEmail) !== Boolean(configuredPassword)) {
    throw new Error("E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be configured together.");
  }

  if (configuredEmail && configuredPassword) {
    if (!url || !secretKey || !publishableKey) {
      throw new Error(
        "Configured E2E admin credentials require the Supabase URL, publishable key, and secret key.",
      );
    }
    const serviceClient = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const credentials = { email: configuredEmail, password: configuredPassword };
    const userId = await resolveConfiguredUserId(url, publishableKey, credentials);
    const alertId = await createRunSecurityAlert(serviceClient, userId);

    return {
      alertId,
      cleanup: () => runCleanupSteps([
        ["configured security alert cleanup", () => serviceClient.from("admin_security_alerts").delete().eq("id", alertId)],
      ]),
      credentials,
      serviceClient,
      totpSecret: configuredValue("E2E_ADMIN_TOTP_SECRET"),
    };
  }

  if (!url || !secretKey || !publishableKey) {
    return { alertId: null, cleanup: async () => undefined, credentials: null, serviceClient: null, totpSecret: null };
  }

  const serviceClient = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `codex-e2e-${Date.now()}-${randomUUID().slice(0, 8)}@example.com`;
  const password = `E2E-${randomBytes(24).toString("base64url")}!9a`;
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { display_name: "Codex E2E Administrator" },
  });
  const userId = data.user?.id;

  if (error || !userId) {
    throw new Error("Could not provision the ephemeral Supabase E2E user.");
  }

  const { error: profileError } = await serviceClient.from("admin_profiles").insert({
    display_name: "Codex E2E Administrator",
    email,
    role: "administrator",
    status: "active",
    user_id: userId,
  });

  if (profileError) {
    await failAfterCleanup("Could not provision the ephemeral Supabase E2E admin profile.", [
      ["ephemeral Auth cleanup after profile failure", () => serviceClient.auth.admin.deleteUser(userId)],
    ]);
  }

  const authClient = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const { error: signInError } = await authClient.auth.signInWithPassword({ email, password });
  if (signInError) {
    await failAfterCleanup("Could not sign in the ephemeral Supabase E2E user for MFA enrollment.", [
      ["ephemeral profile cleanup after sign-in failure", () => serviceClient.from("admin_profiles").delete().eq("user_id", userId)],
      ["ephemeral Auth cleanup after sign-in failure", () => serviceClient.auth.admin.deleteUser(userId)],
    ]);
  }
  const { data: enrollment, error: enrollmentError } = await authClient.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Magic Massage E2E ${Date.now()}`,
  });
  if (enrollmentError || !enrollment) {
    await failAfterCleanup("Could not enroll MFA for the ephemeral Supabase E2E user.", [
      ["ephemeral MFA session cleanup after enrollment failure", () => authClient.auth.signOut({ scope: "local" })],
      ["ephemeral profile cleanup after enrollment failure", () => serviceClient.from("admin_profiles").delete().eq("user_id", userId)],
      ["ephemeral Auth cleanup after enrollment failure", () => serviceClient.auth.admin.deleteUser(userId)],
    ]);
  }
  const totpSecret = enrollment.totp.secret;
  const { error: verifyError } = await authClient.auth.mfa.challengeAndVerify({
    code: createTotpCode(totpSecret),
    factorId: enrollment.id,
  });
  const { error: enrollmentSignOutError } = await authClient.auth.signOut({ scope: "local" });
  if (verifyError || enrollmentSignOutError) {
    await failAfterCleanup(
      `Could not verify and close MFA enrollment for the ephemeral Supabase E2E user: ${
        verifyError?.message ?? enrollmentSignOutError?.message ?? "unknown error"
      }`,
      [
        ["ephemeral profile cleanup after verification failure", () => serviceClient.from("admin_profiles").delete().eq("user_id", userId)],
        ["ephemeral Auth cleanup after verification failure", () => serviceClient.auth.admin.deleteUser(userId)],
      ],
    );
  }
  let alertId;
  try {
    alertId = await createRunSecurityAlert(serviceClient, userId);
  } catch (alertError) {
    await runCleanupSteps([
      ["ephemeral profile cleanup after alert failure", () => serviceClient.from("admin_profiles").delete().eq("user_id", userId)],
      ["ephemeral Auth cleanup after alert failure", () => serviceClient.auth.admin.deleteUser(userId)],
    ]);
    throw alertError;
  }

  return {
    alertId,
    credentials: { email, password },
    serviceClient,
    totpSecret,
    cleanup: () => runCleanupSteps([
      ["ephemeral security alert cleanup", () => serviceClient.from("admin_security_alerts").delete().eq("id", alertId)],
      ["ephemeral profile cleanup", () => serviceClient.from("admin_profiles").delete().eq("user_id", userId)],
      ["ephemeral Auth cleanup", () => serviceClient.auth.admin.deleteUser(userId)],
    ]),
  };
}

async function cleanupPersistentFixtures(serviceClient) {
  if (!serviceClient) return;

  const cleanupResults = [
    await serviceClient.from("admin_clients").delete().like("id", "e2e-direct-dml-%"),
    await serviceClient.from("admin_clients").delete().like("full_name", "Playwright Note Client %"),
  ];
  const { data: generatedPosts, error: generatedPostsError } = await serviceClient
    .from("admin_blog_posts")
    .select("id")
    .like("slug", "playwright-published-massage-guide-%");
  if (generatedPostsError) throw new Error("Could not find generated blog E2E fixtures for cleanup.");

  for (const post of generatedPosts ?? []) {
    cleanupResults.push(
      await serviceClient
        .from("admin_media_placements")
        .delete()
        .eq("page_key", `blog:${post.id}`),
    );
  }
  cleanupResults.push(
    await serviceClient
      .from("admin_blog_posts")
      .delete()
      .like("slug", "playwright-published-massage-guide-%"),
    await serviceClient
      .from("admin_media_placements")
      .delete()
      .eq("page_key", "blog:blog-playwright-published-massage-guide"),
    await serviceClient
      .from("admin_blog_posts")
      .delete()
      .eq("id", "blog-playwright-published-massage-guide"),
  );

  if (cleanupResults.some((result) => result.error)) {
    throw new Error("Could not clean persistent E2E fixtures.");
  }
}

async function snapshotPersistentState(serviceClient) {
  if (!serviceClient) return null;

  const [serviceResult, settingsResult, servicePlacementsResult, mediaPlacementsResult] = await Promise.all([
    serviceClient.from("admin_services").select("*").eq("slug", "classic-massage"),
    serviceClient.from("admin_site_settings").select("*").eq("id", "site"),
    serviceClient.from("admin_media_placements").select("*").eq("page_key", "service:classic-massage"),
    serviceClient.from("admin_media_placements").select("*").eq("media_asset_id", "media-classic-cover"),
  ]);
  const error =
    serviceResult.error ??
    settingsResult.error ??
    servicePlacementsResult.error ??
    mediaPlacementsResult.error;

  if (error) {
    throw new Error(`Could not snapshot persistent E2E state: ${error.message}`);
  }

  const placements = new Map(
    [...(servicePlacementsResult.data ?? []), ...(mediaPlacementsResult.data ?? [])].map((row) => [row.id, row]),
  );

  return {
    placements: [...placements.values()],
    services: serviceResult.data ?? [],
    settings: settingsResult.data ?? [],
  };
}

async function restorePersistentState(serviceClient, snapshot) {
  if (!serviceClient || !snapshot) return;

  const restores = [];
  if (snapshot.services.length > 0) {
    restores.push(serviceClient.from("admin_services").upsert(snapshot.services, { onConflict: "slug" }));
  }
  if (snapshot.settings.length > 0) {
    restores.push(serviceClient.from("admin_site_settings").upsert(snapshot.settings, { onConflict: "id" }));
  }
  if (snapshot.placements.length > 0) {
    restores.push(serviceClient.from("admin_media_placements").upsert(snapshot.placements, { onConflict: "id" }));
  }

  const results = await Promise.all(restores);
  const error = results.find((result) => result.error)?.error;
  if (error) {
    throw new Error(`Could not restore persistent E2E state: ${error.message}`);
  }
}

let exitCode = 1;
let provisioned;
let persistentSnapshot;

try {
  provisioned = await provisionEphemeralAdmin();
  persistentSnapshot = await snapshotPersistentState(provisioned.serviceClient);
  const result = spawnSync(
    process.execPath,
    [playwrightCli, "test", "--config", "playwright.admin-auth.config.ts", ...playwrightArgs],
    {
      env: {
        ...process.env,
        ...(provisioned.credentials
          ? {
              E2E_ADMIN_EMAIL: provisioned.credentials.email,
              E2E_ADMIN_PASSWORD: provisioned.credentials.password,
            }
          : {}),
        ...(provisioned.totpSecret
          ? { E2E_ADMIN_TOTP_SECRET: provisioned.totpSecret }
          : {}),
        ...(provisioned.alertId ? { E2E_SECURITY_ALERT_ID: provisioned.alertId } : {}),
        ...(required ? { E2E_ADMIN_AUTH_REQUIRED: "true" } : {}),
      },
      stdio: "inherit",
    },
  );
  exitCode = result.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Admin auth E2E setup failed.");
} finally {
  const finalizers = [
    ["Persistent state restoration", () => restorePersistentState(provisioned?.serviceClient ?? null, persistentSnapshot)],
    ["Persistent fixture cleanup", () => cleanupPersistentFixtures(provisioned?.serviceClient ?? null)],
    ["Provisioned auth fixture cleanup", () => provisioned?.cleanup()],
  ];

  for (const [label, finalize] of finalizers) {
    try {
      await finalize();
    } catch (error) {
      console.error(`${label} failed: ${error instanceof Error ? error.message : "unknown error"}`);
      exitCode = 1;
    }
  }
}

process.exit(exitCode);
