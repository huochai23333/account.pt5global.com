import { expect, test } from "@playwright/test";

import {
  expectForbiddenPage,
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";

// 页面准入、业务停用和登录状态分别检查；看见拒绝页不能代替数据库RLS验证，也不能当成会话已失效。
test.describe("workspace permission regression", () => {
  test("client cannot open the administrator workspace", async ({ page }) => {
    await loginAs(page, "client");

    await page.goto("/admin/home");

    await expectForbiddenPage(page);
  });

  test("salesman cannot open administrator review queues", async ({ page }) => {
    await loginAs(page, "salesman");

    await page.goto("/admin/reviews");

    await expectForbiddenPage(page);

    // 返回自己的首页时不应再次登录，用这个断言防止以后又把越权和退出登录混在一起。
    await page.getByRole("link", { name: "返回我的首页" }).click();
    await expect(page).toHaveURL(/\/salesman\/home(?:[?#].*)?$/);
    await expectWorkspaceShell(page);
  });

  test("retired tourism review route does not open the global review center", async ({
    page,
  }) => {
    await loginAs(page, "administrator");

    await page.goto("/admin/tourism/reviews");

    await expect(
      page.getByRole("heading", { name: "旅游业务暂时停止服务" }),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/\/admin\/reviews(?:[?#].*)?$/);
  });

  test("salesman cannot open administrator operation records", async ({ page }) => {
    await loginAs(page, "salesman");

    await page.goto("/admin/tourism/records");

    await expectForbiddenPage(page);
  });

  test("salesman cannot open tourism business by default", async ({ page }) => {
    await loginAs(page, "salesman");

    await page.goto("/salesman/tourism/orders");

    await expect(
      page.getByRole("heading", { name: "旅游业务暂时停止服务" }),
    ).toBeVisible();
  });

  test("client cannot open wholesale settlement releases", async ({ page }) => {
    await loginAs(page, "client");

    await page.goto("/client/wholesale/settlement-releases");

    await expectForbiddenPage(page);
  });

  test("finance can open wholesale business", async ({ page }) => {
    await loginAs(page, "finance");

    await page.goto("/finance/wholesale/orders");

    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
  });

  test("finance can open salesman wholesale customer page", async ({ page }) => {
    await loginAs(page, "finance");

    await page.goto("/finance/wholesale/customers");

    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
  });

  test("finance cannot open administrator-only wholesale pages", async ({ page }) => {
    await loginAs(page, "finance");

    await page.goto("/finance/wholesale/people");

    await expectForbiddenPage(page);
  });

  test("finance cannot open tourism business", async ({ page }) => {
    await loginAs(page, "finance");

    await page.goto("/finance/tourism/commission");

    await expect(
      page.getByRole("heading", { name: "旅游业务暂时停止服务" }),
    ).toBeVisible();
  });

  test("finance cannot open salesman task workspace", async ({ page }) => {
    await loginAs(page, "finance");

    await page.goto("/salesman/tourism/tasks");

    await expectForbiddenPage(page);
  });

  test("salesman cannot open company expenses", async ({ page }) => {
    await loginAs(page, "salesman");

    await page.goto("/salesman/company-expenses");

    await expectForbiddenPage(page);
  });
});
