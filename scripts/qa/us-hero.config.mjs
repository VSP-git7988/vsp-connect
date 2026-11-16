import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "us-hero.spec.ts",
  workers: 1,
  timeout: 120000,
  use: { baseURL: "http://localhost:43129" },
  webServer: {
    command: "node us-profile-preview.mjs",
    url: "http://localhost:43129",
    reuseExistingServer: false,
    timeout: 180000,
  },
  reporter: "list",
});
