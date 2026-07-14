import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
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

async function provisionEphemeralAdmin() {
  const url = configuredValue("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = configuredValue("SUPABASE_SECRET_KEY");
  const configuredEmail = configuredValue("E2E_ADMIN_EMAIL");
  const configuredPassword = configuredValue("E2E_ADMIN_PASSWORD");

  if (Boolean(configuredEmail) !== Boolean(configuredPassword)) {
    throw new Error("E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be configured together.");
  }

  if (configuredEmail && configuredPassword) {
    return {
      cleanup: async () => undefined,
      credentials: { email: configuredEmail, password: configuredPassword },
      serviceClient: url && secretKey ? createClient(url, secretKey) : null,
    };
  }

  if (!url || !secretKey) {
    return { cleanup: async () => undefined, credentials: null, serviceClient: null };
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
    user_metadata: { display_name: "Codex E2E Owner" },
  });
  const userId = data.user?.id;

  if (error || !userId) {
    throw new Error("Could not provision the ephemeral Supabase E2E user.");
  }

  const { error: profileError } = await serviceClient.from("admin_profiles").insert({
    display_name: "Codex E2E Owner",
    email,
    role: "owner",
    status: "active",
    user_id: userId,
  });

  if (profileError) {
    await serviceClient.auth.admin.deleteUser(userId);
    throw new Error("Could not provision the ephemeral Supabase E2E admin profile.");
  }

  return {
    credentials: { email, password },
    serviceClient,
    cleanup: async () => {
      await serviceClient.from("admin_profiles").delete().eq("user_id", userId);
      await serviceClient.auth.admin.deleteUser(userId);
    },
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
        ...(required ? { E2E_ADMIN_AUTH_REQUIRED: "true" } : {}),
      },
      stdio: "inherit",
    },
  );
  exitCode = result.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Admin auth E2E setup failed.");
} finally {
  try {
    await restorePersistentState(provisioned?.serviceClient ?? null, persistentSnapshot);
    await cleanupPersistentFixtures(provisioned?.serviceClient ?? null);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Admin auth E2E cleanup failed.");
    exitCode = 1;
  } finally {
    await provisioned?.cleanup();
  }
}

process.exit(exitCode);
