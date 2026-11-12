import { defineConfig, devices } from "@playwright/test";

// 只复用已运行的本地 Web；本套件创建专属夹具，不恢复固定账号或启动第二个服务。
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60_000,
  outputDir: "../../output/learning-browser-results",
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    channel: "chrome",
    baseURL: "http://localhost:3000",
    viewport: { width: 1440, height: 1000 },
    trace: "off",
    video: "off",
    screenshot: "off",
  },
});
