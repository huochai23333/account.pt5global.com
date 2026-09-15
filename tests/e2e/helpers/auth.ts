import { expect, type Page } from "@playwright/test";

import {
  getRegressionAccount,
  type RegressionAccount,
  type RegressionRole,
} from "./accounts";

export type { RegressionRole } from "./accounts";

export async function loginAs(
  page: Page,
  role: RegressionRole,
): Promise<RegressionAccount> {
  const account = getRegressionAccount(role);

  await loginWithAccount(page, account);

  return account;
}

export async function loginWithAccount(
  page: Page,
  account: RegressionAccount,
) {
  // 大多数既有回归断言使用中文文案，因此测试必须明确选择中文，
  // 不能再依赖测试浏览器自身的 Accept-Language。
  await setTestLocale(page, "zh");
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.locator('form button[type="submit"]').click();

  // 经理、推广和招聘目前没有任何已启用业务。登录成功的权威页面是停用说明，
  // 不能为了让旧测试进入空工作台而把这三个角色误判成登录失败。
  if (["manager", "promoter", "recruiter"].includes(account.role)) {
    await expect(page).toHaveURL(/\/business-unavailable(?:[?#].*)?$/, {
      timeout: 30_000,
    });
    await expect(
      page.getByRole("heading", { name: "当前没有可使用的业务" }),
    ).toBeVisible();
    await expect(page.locator('input[name="email"]')).toHaveCount(0);
    return;
  }

  await expect(page).toHaveURL(
    new RegExp(`${escapeRegExp(account.workspacePath)}/home(?:[?#].*)?$`),
    { timeout: 30_000 },
  );
  await expectWorkspaceShell(page);
  await dismissWorkspaceAnnouncements(page);
}

export async function setTestLocale(page: Page, locale: "en" | "zh") {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

  await page.context().addCookies([
    {
      name: "bs-locale",
      url: baseUrl,
      value: locale,
    },
  ]);
}

export async function expectWorkspaceShell(page: Page) {
  await expect(
    page.getByRole("heading", { name: "PT5 系统" }),
  ).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
}

export async function expectForbiddenPage(page: Page) {
  // 有效账号访问工作范围之外的页面时保留登录，只显示清楚的返回入口。
  await expect(
    page.getByRole("heading", { name: "这个页面不在你的工作范围内" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "返回我的首页" })).toBeVisible();
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
}

export async function expectNotForbiddenPage(page: Page) {
  // 正常可访问的页面不应该被权限拦截踢回登录页。
  await expect(page).not.toHaveURL(/\/login(?:[?#].*)?$/);
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function dismissWorkspaceAnnouncements(page: Page) {
  const acknowledgeButton = page.getByRole("button", { name: "我知道了" });

  if (await acknowledgeButton.isVisible().catch(() => false)) {
    await acknowledgeButton.click();
    await expect(acknowledgeButton).toHaveCount(0);
  }
}
