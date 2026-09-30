import { expect, test } from "@playwright/test";

import { loginAs, setTestLocale } from "./helpers/auth";

test.describe("全系统动效回归", () => {
  test("认证页带有统一首屏动效和动效令牌", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await setTestLocale(page, "zh");
    await page.goto("/login");

    const pageMotion = page.locator('[data-motion-page="true"]');
    await expect(pageMotion).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();

    const pageDuration = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--motion-duration-page")
        .trim(),
    );
    expect(["320ms", ".32s"]).toContain(pageDuration);
  });

  test("减少动态效果时取消明显位移和长动画", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setTestLocale(page, "zh");
    await page.goto("/login");

    await expect(page.locator('[data-motion-page="true"]')).toBeVisible();

    const longRunningAnimations = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => {
          const duration = Number(animation.effect?.getTiming().duration ?? 0);
          return animation.playState === "running" && duration > 1;
        })
        .length,
    );

    expect(longRunningAnimations).toBe(0);
  });

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
      await expect(page.locator('[data-motion-list="true"]').first()).toBeAttached();
      await expect(
        todoItems.first().locator('xpath=ancestor::*[@data-motion-list-item="true"][1]'),
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
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });
});
