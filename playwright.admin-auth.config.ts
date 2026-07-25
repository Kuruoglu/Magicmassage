import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 1,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3101",
    screenshot: "only-on-failure",
    trace: "off",
  },
  projects: [
    {
      name: "admin-auth-chromium",
      testMatch: "**/admin-auth.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      dependencies: ["public-booking-chromium"],
      grep: /@persistent/,
      name: "prompt-persistence-chromium",
      testMatch: "**/prompt-completion.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "public-booking-chromium",
      testMatch: "**/public-booking-auth.spec.ts",
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
