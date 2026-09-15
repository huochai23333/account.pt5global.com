import { expect, test, type Page } from "@playwright/test";

import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
  type RegressionRole,
} from "./helpers/auth";

const ROLE_PAGES: ReadonlyArray<{ path: string; role: RegressionRole }> = [
  { path: "/admin/announcements", role: "administrator" },
  { path: "/salesman/wholesale/orders", role: "salesman" },
  { path: "/finance/company-expenses", role: "finance" },
  { path: "/client/home", role: "client" },
];

test.describe("全工作台共享结构", () => {
  for (const entry of ROLE_PAGES) {
    test(`${entry.role} 页面使用统一页面外壳`, async ({ page }) => {
      await loginAs(page, entry.role);
      await page.goto(entry.path);
      await expectWorkspaceShell(page);
      await expectNotForbiddenPage(page);
      await expect(page.locator('[data-dashboard-page-shell="true"]')).toHaveCount(1);
    });
  }

  test("表单校验失败后保留弹窗、输入和反馈", async ({ page }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/announcements");

    await page.getByRole("button", { name: "新建公告" }).click();
    const dialog = page.getByRole("dialog", { name: "新建公告" });
    const titleInput = dialog.getByLabel("公告标题");
    await titleInput.fill("保留输入的表单测试");
    await dialog.getByRole("button", { name: "保存草稿" }).click();

    await expect(dialog).toBeVisible();
    await expect(titleInput).toHaveValue("保留输入的表单测试");
    await expect(dialog.getByText("请填写公告内容。")).toBeVisible();
  });

  test("共享页面、筛选与列表在移动宽度没有横向溢出", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await loginAs(page, "administrator");

    for (const path of [
      "/admin/announcements",
      "/admin/accounts",
      // 旅游业务已经停用，不能把停用说明页的“不溢出”冒充工作台页面通过。
      "/admin/wholesale/customers",
      "/admin/wholesale/orders",
    ]) {
      await page.goto(path);
      await expectNotForbiddenPage(page);
      await expectNoHorizontalOverflow(page);
    }
  });
});

async function expectNoHorizontalOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 2);
}
