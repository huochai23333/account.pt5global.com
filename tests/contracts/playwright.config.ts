import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 15_000,
  outputDir: "../../output/contract-results",
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], channel: "chrome", trace: "off", video: "off", screenshot: "off" },
});
