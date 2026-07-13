import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const playwrightCli = require.resolve("@playwright/test/cli");
const required = process.argv.includes("--required");
const result = spawnSync(process.execPath, [playwrightCli, "test", "--config", "playwright.admin-auth.config.ts"], {
  env: {
    ...process.env,
    ...(required ? { E2E_ADMIN_AUTH_REQUIRED: "true" } : {}),
  },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
