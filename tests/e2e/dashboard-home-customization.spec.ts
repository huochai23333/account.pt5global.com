import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

import { requireDisposableFixture } from "../test-support/disposable-fixture";
import { widgetCard, requiredBox, expectNoClippedHomeWidgets, expectNoHorizontalOverflow } from "./helpers/home-widget-assertions";
import { resetHomeLayout, openHomeManager, resetHomeLayoutFromOpenDialog } from "./helpers/home-manager";

// 会重置固定管理员布局；声明之外仍必须提供实际可重建的完整隔离实例。
test.beforeAll(() => requireDisposableFixture({
  baseURL: process.env.PLAYWRIGHT_BASE_URL,
  supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  mode: process.env.PT5_E2E_FIXTURE_MODE,
}));

test.describe.configure({ mode: "serial" });

test.describe("首页组件管理与紧凑布局", () => {
  test("390px 与 768px 首页紧凑显示且不裁切", async ({ page }) => {
    await loginAs(page, "administrator");
    await resetHomeLayout(page, "/admin/home");

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/admin/home");

    const todoCard = widgetCard(page, "todos");
    const announcementCard = widgetCard(page, "announcements");
    const inviteCard = widgetCard(page, "invite");
    const titleInput = page.getByTestId("home-todo-title-input");
    const dueDate = page.getByLabel("截止日期");

    await expect(page.getByTestId("home-manage-button")).toBeVisible();
    await expect(announcementCard).toBeInViewport();
    // 首页数据和布局会并行恢复；先确认所有待测节点已经真实显示，
    // 再读取 boundingBox，避免把尚未挂载完成误判为组件被裁切。
    await expect(todoCard).toBeVisible();
    await expect(inviteCard).toBeVisible();
    await expect(titleInput).toBeVisible();
    await expect(dueDate).toBeVisible();
    expect((await requiredBox(todoCard)).height).toBeLessThanOrEqual(340);
    expect((await requiredBox(inviteCard)).height).toBeLessThanOrEqual(220);
    expect((await requiredBox(titleInput)).y).toBeLessThan(
      (await requiredBox(dueDate)).y,
    );
    await expect(page.getByTestId("home-clock-seconds")).toHaveCount(0);
    await expect(page.getByTestId("home-clock-face")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectNoClippedHomeWidgets(page);

    await page.setViewportSize({ height: 900, width: 768 });
    await page.goto("/admin/home");

    const tabletTitleBox = await requiredBox(
      page.getByTestId("home-todo-title-input"),
    );
    const tabletDateBox = await requiredBox(page.getByLabel("截止日期"));

    expect(Math.abs(tabletTitleBox.y - tabletDateBox.y)).toBeLessThan(2);
    await expect(page.getByTestId("home-manage-button")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoClippedHomeWidgets(page);
  });

  test("窄屏可添加重复组件、排序、删除并恢复默认", async ({ page }) => {
    await loginAs(page, "administrator");
    await resetHomeLayout(page, "/admin/home");
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/admin/home");

    await openHomeManager(page);
    const manager = page.getByRole("dialog", { name: "管理首页" });

    await manager
      .locator('[data-home-manager-add-type="clock"]')
      .click();
    const duplicateClock = manager
      .getByTestId("home-manager-widget")
      .filter({ hasText: "当前时间 2" });

    await expect(duplicateClock).toBeVisible();
    const duplicateId = await duplicateClock.getAttribute(
      "data-home-manager-widget-id",
    );

    await duplicateClock
      .getByTestId("home-manager-move-earlier")
      .click();
    await expect(manager.getByText("首页调整已保存。")).toBeVisible();
    await manager.getByTestId("home-manager-done").click();
    await page.reload();

    await openHomeManager(page);
    const persistedDuplicate = page
      .getByRole("dialog", { name: "管理首页" })
      .locator(`[data-home-manager-widget-id="${duplicateId}"]`);

    // 重复组件移到原组件前方后会成为“当前时间 1”；刷新后的页面顺序仍需另配独立数据库凭证。
    await expect(persistedDuplicate).toContainText("当前时间 1");
    await persistedDuplicate.getByTestId("home-manager-remove").click();
    await expect(
      page
        .getByRole("dialog", { name: "管理首页" })
        .getByTestId("home-manager-widget"),
    ).toHaveCount(5);
    await expect(
      page.getByRole("dialog", { name: "管理首页" }).getByText("首页调整已保存。"),
    ).toBeVisible();

    const announcement = page
      .getByRole("dialog", { name: "管理首页" })
      .getByTestId("home-manager-widget")
      .filter({ hasText: "公告栏" });

    await announcement.getByTestId("home-manager-remove").click();
    await expect(
      page
        .getByRole("dialog", { name: "管理首页" })
        .getByTestId("home-manager-widget"),
    ).toHaveCount(4);
    await expect(
      page.getByRole("dialog", { name: "管理首页" }).getByText("首页调整已保存。"),
    ).toBeVisible();
    await page.getByTestId("home-manager-done").click();
    await page.reload();
    await expect(widgetCard(page, "announcements")).toHaveCount(0);

    await resetHomeLayout(page, "/admin/home");
    await page.reload();
    await expect(page.getByTestId("home-widget-card")).toHaveCount(5);
    await expect(widgetCard(page, "announcements")).toHaveCount(1);
  });

  test("保存失败会保留当前布局并可重新保存", async ({ page }) => {
    await loginAs(page, "administrator");
    await resetHomeLayout(page, "/admin/home");

    let shouldFail = true;
    let forcedFailures = 0;
    await page.route(
      "**/rest/v1/rpc/save_user_home_widget_layout",
      async (route) => {
        if (shouldFail) {
          shouldFail = false;
          forcedFailures += 1;
          await route.fulfill({
            body: JSON.stringify({ message: "temporary_failure" }),
            contentType: "application/json",
            status: 500,
          });
          return;
        }

        await route.continue();
      },
    );

    await openHomeManager(page);
    const manager = page.getByRole("dialog", { name: "管理首页" });

    await manager
      .locator('[data-home-manager-add-type="clock"]')
      .click();
    await expect(
      manager.getByText("首页调整还没有保存，请检查网络后重试。"),
    ).toBeVisible();
    await expect(manager.getByTestId("home-manager-widget")).toHaveCount(6);
    expect(forcedFailures).toBe(1);
    const unsavedIds = await manager.getByTestId("home-manager-widget").evaluateAll(
      (widgets) => widgets.map((widget) => widget.getAttribute("data-home-manager-widget-id")),
    );
    expect(new Set(unsavedIds).size).toBe(6);

    await manager.getByTestId("home-layout-retry-save").click();
    await expect(manager.getByText("首页调整已保存。")).toBeVisible();
    await manager.getByTestId("home-manager-done").click();
    await page.reload();
    await openHomeManager(page);
    const persistedIds = await manager.getByTestId("home-manager-widget").evaluateAll(
      (widgets) => widgets.map((widget) => widget.getAttribute("data-home-manager-widget-id")),
    );
    expect(persistedIds).toEqual(unsavedIds);
    await resetHomeLayoutFromOpenDialog(page);
  });

});
