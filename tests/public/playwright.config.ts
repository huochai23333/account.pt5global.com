import { defineConfig, devices } from "@playwright/test";

/** 公共页检查不加载账号/管理员辅助入口；只复用已启动的本地服务，绝不自动开第二个。 */
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 45_000,
  outputDir: "../../output/security-auth-recovery-results",
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], channel: "chrome", baseURL: "http://localhost:3000",
    trace: "off", video: "off", screenshot: "off" },
});
