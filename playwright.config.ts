import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const shouldStartWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER !== "1";

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: "output/playwright-results",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // 本地回归复用已经安装的稳定版 Chrome，避免浏览器包版本锁影响页面验收。
        channel: "chrome",
      },
    },
  ],
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "output/playwright-report" }],
  ],
  retries: process.env.CI ? 1 : 0,
  testDir: "./tests/e2e",
  timeout: 60_000,
  // 回归用例共用本地种子账号和 Supabase 数据。并发文件会互相覆盖筛选、额度和业务记录，
  // 还会让单个 Next dev server 同时承受多次登录与整页查询，因此固定串行才能得到可信结果。
  workers: 1,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: shouldStartWebServer
    ? {
        command: "npm run dev -- --hostname localhost",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        url: baseURL,
      }
    : undefined,
});
