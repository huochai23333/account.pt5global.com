import {
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import { expectWorkspaceShell, loginAs } from "./helpers/auth";
import {
  getDesktopBusinessGroupButton,
  restoreDefaultAdminBusinessGroups,
  setDesktopBusinessGroupExpanded,
} from "./helpers/workspace-navigation";

test.describe("workspace navigation preferences", () => {
  test("desktop business groups follow the account across browser sessions", async ({
    browser,
    page,
  }) => {
    let secondContext: BrowserContext | null = null;
    let secondPage: Page | null = null;

    try {
      await loginAs(page, "administrator");

      // 第一台“设备”收起当前唯一启用的批发业务，并等待数据库确认保存。
      await setDesktopBusinessGroupExpanded(page, "批发业务", false);

      // 新建浏览器上下文不会继承 Cookie 或 localStorage，能证明状态来自账号云端偏好。
      secondContext = await browser.newContext();
      secondPage = await secondContext.newPage();
      await loginAs(secondPage, "administrator");

      await expect(
        getDesktopBusinessGroupButton(secondPage, "批发业务"),
      ).toHaveAttribute("aria-expanded", "false");

      // 再展开并刷新，证明两个方向都会形成账号级持久化结果。
      await setDesktopBusinessGroupExpanded(secondPage, "批发业务", true);
      await secondPage.reload();
      await expectWorkspaceShell(secondPage);
      await expect(
        getDesktopBusinessGroupButton(secondPage, "批发业务"),
      ).toHaveAttribute("aria-expanded", "true");

      await setDesktopBusinessGroupExpanded(secondPage, "批发业务", false);
      await secondPage.reload();
      await expectWorkspaceShell(secondPage);
      await expect(
        getDesktopBusinessGroupButton(secondPage, "批发业务"),
      ).toHaveAttribute("aria-expanded", "false");

      // 移动端继续展示完整下拉菜单，不使用桌面折叠偏好。
      await secondPage.setViewportSize({ height: 812, width: 375 });
      await secondPage.goto("/admin/home");
      const mobileHeader = secondPage.locator("header").first();
      await mobileHeader
        .getByRole("button", { exact: true, name: "首页" })
        .click();
      await expect(
        mobileHeader.getByText("批发业务", { exact: true }),
      ).toBeVisible();
      await expect(
        mobileHeader.getByText("旅游业务", { exact: true }),
      ).toHaveCount(0);
      await expectNoDocumentHorizontalOverflow(secondPage);
    } finally {
      // 管理员账号被多个回归文件共用，成功或失败都尽量恢复稳定默认状态。
      const cleanupPage = secondPage ?? page;

      await cleanupPage
        .setViewportSize({ height: 720, width: 1280 })
        .catch(() => undefined);
      await cleanupPage.goto("/admin/home").catch(() => undefined);
      await restoreDefaultAdminBusinessGroups(cleanupPage).catch(
        () => undefined,
      );
      await secondContext?.close();
    }
  });
});

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflowPixels).toBeLessThanOrEqual(2);
}
