import { expect, test } from "@playwright/test";

import {
  getRegressionAccount,
  getInactiveRegressionAccount,
  getStaleRoleRegressionAccount,
} from "./helpers/accounts";
import {
  expectForbiddenPage,
  loginAs,
  setTestLocale,
  type RegressionRole,
} from "./helpers/auth";

const workspaceRoles: readonly RegressionRole[] = [
  "administrator",
  "salesman",
  "operator",
  "client",
  "finance",
];

const rolesWithoutEnabledBusiness: readonly RegressionRole[] = [
  "promoter",
  "manager",
  "recruiter",
];

test.describe("authentication regression", () => {
  for (const role of workspaceRoles) {
    test(`${role} can sign in and reach its home workspace`, async ({
      page,
    }) => {
      await loginAs(page, role);
    });
  }

  for (const role of rolesWithoutEnabledBusiness) {
    test(`${role} signs in and sees the current no-service page`, async ({
      page,
    }) => {
      await loginAndExpectUnavailable(page, getRegressionAccount(role));
    });
  }

  test("restored session uses the database role instead of stale Auth metadata", async ({
    page,
  }) => {
    const account = getStaleRoleRegressionAccount();

    test.skip(!account, "This regression fixture is only available with local Supabase.");

    if (!account) {
      return;
    }

    await loginAndExpectUnavailable(page, account);

    // 重新进入公开入口等同于部署完成后，浏览器携带既有 Cookie 发起第一次整页请求。
    for (const entryPath of ["/", "/login"] as const) {
      await page.goto(entryPath);
      await expectUnavailablePage(page);
      // 这个账号的 Auth 缓存仍是业务员；页面隐藏内部员工专用入口，证明服务端采用了数据库中的客户角色。
      await expect(page.getByRole("link", { name: "邮件提醒" })).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "这个页面不在你的工作范围内" }),
      ).toHaveCount(0);
    }

    // 真正访问其他角色工作台时仍需显示权限提示，并保留当前登录状态。
    await page.goto("/admin/home");
    await expectForbiddenPage(page);
    await page.getByRole("link", { name: "返回我的首页" }).click();
    await expectUnavailablePage(page);
  });

  test("workspace without a session returns to the login page", async ({ page }) => {
    await page.goto("/admin/home");
    await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test("registration request is shown as pending verification instead of completed", async ({
    page,
  }) => {
    await setTestLocale(page, "zh");
    await page.goto("/login?registered=1");

    const acceptedNotice = page.locator(
      '[data-slot="feedback-notice"][data-tone="info"]',
    );
    await expect(acceptedNotice).toContainText("注册请求已提交");
    await expect(
      page.locator('[data-slot="feedback-notice"][data-tone="success"]'),
    ).toHaveCount(0);
  });

  test("inactive database account clears the restored session", async ({ page }) => {
    const account = getInactiveRegressionAccount();

    test.skip(!account, "This regression fixture is only available with local Supabase.");

    if (!account) {
      return;
    }

    await setTestLocale(page, "zh");
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(account.email);
    await page.locator('input[name="password"]').fill(account.password);
    await page.locator('form button[type="submit"]').click();

    await expect(page).toHaveURL(/\/login(?:[?#].*)?$/, { timeout: 30_000 });
    await expect(page.locator('input[name="email"]')).toBeVisible();

    // 再次输入工作台地址仍回到登录页，证明服务端退出入口已经清除了旧 Cookie。
    await page.goto("/client/home");
    await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);
  });
});

async function loginAndExpectUnavailable(
  page: import("@playwright/test").Page,
  account: ReturnType<typeof getRegressionAccount>,
) {
  await setTestLocale(page, "zh");
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await expectUnavailablePage(page);
}

async function expectUnavailablePage(page: import("@playwright/test").Page) {
  await expect(page).toHaveURL(/\/business-unavailable(?:[?#].*)?$/, {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: "当前没有可使用的业务" }),
  ).toBeVisible();
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
}
