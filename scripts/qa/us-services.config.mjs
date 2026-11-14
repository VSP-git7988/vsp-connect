import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../..", import.meta.url));
export default defineConfig({
  testDir: ".",
  testMatch: "us-services.spec.ts",
  workers: 1,
  timeout: 120000,
  use: { baseURL: "http://localhost:43129" },
  webServer: {
    cwd: root,
    command: "node scripts/qa/us-profile-preview.mjs",
    url: "http://localhost:43129",
    reuseExistingServer: false,
    timeout: 180000,
  },
  reporter: "list",
});
