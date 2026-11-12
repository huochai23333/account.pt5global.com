import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/** 工作台只保留菜单层叠、待办动画和移动宽度；页面步骤与原断言保持。 */
test.describe("全系统动效回归", () => {
  test("工作台菜单关闭后不会留下透明遮罩拦截操作", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");

    const trigger = page.getByTestId("workspace-account-menu-trigger");
    await trigger.click();

    const menu = page.getByTestId("workspace-account-menu");
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(menu).toHaveCSS(
      "background-color",
      "rgba(255, 255, 255, 0.7)",
    );
    await expect(menu).toHaveCSS("backdrop-filter", /blur\(40px\)/);

    const portalLayer = menu.locator("xpath=..");
    await expect(portalLayer).toHaveCSS("z-index", "65");
    expect(
      await menu.evaluate(
        (element) => element.closest('[data-slot="workspace-header"]') === null,
      ),
    ).toBe(true);
    expect(
      await menu.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const checkpoints = [
          [bounds.left + 12, bounds.top + 52],
          [bounds.left + bounds.width / 2, bounds.top + bounds.height / 2],
          [bounds.right - 12, bounds.bottom - 30],
        ];

        // elementFromPoint 返回该坐标真正位于最上面的节点。
        // 三个位置都必须命中菜单自身或其子元素，避免吸顶表格再次盖住菜单。
        return checkpoints.every(([x, y]) => {
          const topElement = document.elementFromPoint(x, y);
          return topElement !== null && element.contains(topElement);
        });
      }),
    ).toBe(true);

    await trigger.click();
    await expect(menu).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // 菜单退出后再次点击必须立即生效，用来拦截残留透明浮层的问题。
    await trigger.click();
    await expect(page.getByTestId("workspace-account-menu")).toBeVisible();
  });

  test("待办筛选与列表状态使用共享重排动画", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");
    await page.goto("/admin/home");

    await expect(page.getByTestId("home-todos-section")).toBeVisible();
    await page.getByTestId("home-todo-filter-all").click();

    await expect(
      page
        .getByTestId("home-todos-section")
        .locator('[data-motion-presence-swap="true"]'),
    ).toBeAttached();

    const todoItems = page.getByTestId("home-todo-item");
    if ((await todoItems.count()) > 0) {
      await expect(
        page.locator('[data-motion-list="true"]').first(),
      ).toBeAttached();
      await expect(
        todoItems
          .first()
          .locator('xpath=ancestor::*[@data-motion-list-item="true"][1]'),
      ).toBeAttached();
    }
  });

  test("移动端密集表格保持页面宽度稳定", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");

    await expect(page.locator('[data-motion-page="true"]')).toBeVisible();
    await expect(page.locator("main")).toBeVisible();

    const horizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });
});
