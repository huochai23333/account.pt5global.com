import { expect, test, type Page } from "@playwright/test";
import type { Server } from "node:http";

import { getRegressionAccount, type RegressionRole } from "./helpers/accounts";
import { setTestLocale } from "./helpers/auth";
import { startEmailConnectMockServer } from "./helpers/emailconnect-mock-server";

let mockServer: Server;

test.beforeAll(async () => {
  mockServer = await startEmailConnectMockServer();
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => mockServer.close((error) => error ? reject(error) : resolve()));
});

async function loginForEmailReminders(page: Page, role: RegressionRole) {
  const account = getRegressionAccount(role);
  await setTestLocale(page, "zh");
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('input[name="email"]')).toHaveCount(0, { timeout: 30_000 });
}

for (const role of [
  "administrator",
  "finance",
  "manager",
  "operator",
  "promoter",
  "recruiter",
  "salesman",
] as const) {
  test(`${role} 状态正常时可以进入邮件提醒`, async ({ page }) => {
    await loginForEmailReminders(page, role);
    await page.goto("/email-reminders");
    await expect(page.getByRole("heading", { name: "邮件提醒" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "我的连接" })).toBeVisible();
    await expect(page.getByText("sa*******@example.com").first()).toBeVisible();
  });
}

test("客户看不到入口并且不能直接进入邮件提醒", async ({ page }) => {
  await loginForEmailReminders(page, "client");
  await page.goto("/client/my");
  await expect(page.getByRole("link", { name: "管理邮件提醒" })).toHaveCount(0);
  await page.goto("/email-reminders");
  await expect(page.getByRole("heading", { name: "这个页面不在你的工作范围内" })).toBeVisible();
});

test("管理员只看到脱敏健康信息并可维护规则", async ({ page }) => {
  await loginForEmailReminders(page, "administrator");
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/email-reminders");
    await expect(page.getByRole("heading", { name: "提醒规则" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "员工连接状态" })).toBeVisible();
    await expect(page.getByText("测试业务员")).toBeVisible();
    await expect(page.getByText("sa*******@example.com").first()).toBeVisible();
    await expect(page.getByText("New order")).toHaveCount(0);
    await expect(page.getByText("salesperson@example.com")).toHaveCount(0);
    const widths = await page.locator("body").evaluate((body) => ({
      client: body.clientWidth,
      scroll: body.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  }
});

test("内部员工可从个人页进入，暂无业务员工可从说明页进入", async ({ page }) => {
  await loginForEmailReminders(page, "salesman");
  await page.goto("/salesman/my");
  await expect(page.getByRole("link", { name: "管理邮件提醒" })).toHaveAttribute("href", "/email-reminders");

  await page.goto("/business-unavailable");
  await expect(page.getByRole("link", { name: "邮件提醒" })).toHaveAttribute("href", "/email-reminders");
});
