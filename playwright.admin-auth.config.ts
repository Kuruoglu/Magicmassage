import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/admin-auth.spec.ts",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3101",
    screenshot: "only-on-failure",
    trace: "off",
  },
  projects: [
    {
      name: "admin-auth-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev:e2e:admin-auth",
    url: "http://127.0.0.1:3101/admin/login",
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
