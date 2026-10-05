import { expect, test, type Locator, type Page } from "@playwright/test";

import { loginAs, type RegressionRole } from "./helpers/auth";

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

    // 重复组件移动到原组件前方后会成为“当前时间 1”，这同时证明顺序已经持久化。
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

for (const role of ["administrator", "salesman", "client"] as const satisfies readonly RegressionRole[]) {
  test(`${role} 的邀请码操作在 390px 下保持可用`, async ({ page }) => {
    const account = await loginAs(page, role);

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto(`${account.workspacePath}/home`);

    const inviteCard = widgetCard(page, "invite");

    await expect(inviteCard).toBeVisible();
    await expectNoHorizontalOverflow(page);
    for (const button of await inviteCard.getByRole("button").all()) {
      if (await button.isVisible()) {
        await expectTouchTarget(button, 44);
      }
    }

    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto(`${account.workspacePath}/home`);

    const desktopInviteCard = widgetCard(page, "invite");

    expect(
      Number(await desktopInviteCard.getAttribute("data-home-widget-width")),
    ).toBeGreaterThanOrEqual(2);
    expect(
      Number(await desktopInviteCard.getAttribute("data-home-widget-height")),
    ).toBeGreaterThanOrEqual(2);
    for (const button of await desktopInviteCard.getByRole("button").all()) {
      await expect(button).toBeVisible();
      await expectTouchTarget(button, 44);
    }
    await expectNoClippedHomeWidgets(page);
  });
}

async function openHomeManager(page: Page) {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.getByTestId("home-manage-button").click();
  await expect(page.getByRole("dialog", { name: "管理首页" })).toBeVisible();
}

async function resetHomeLayout(page: Page, path: string) {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(path);
  await openHomeManager(page);
  await resetHomeLayoutFromOpenDialog(page);
}

async function resetHomeLayoutFromOpenDialog(page: Page) {
  const manager = page.getByRole("dialog", { name: "管理首页" });

  await manager.getByTestId("home-manager-reset").click();
  /*
   * 如果页面本来就是默认布局，不会产生重复保存请求；如果布局发生变化，
   * 这里覆盖保存防抖与本地请求所需时间，再关闭弹窗，避免刷新读到旧顺序。
   */
  await page.waitForTimeout(900);
  await expect(
    manager.getByText("首页调整还没有保存，请检查网络后重试。"),
  ).toHaveCount(0);
  await manager.getByTestId("home-manager-done").click();
}

function widgetCard(page: Page, type: string) {
  return page.locator(
    `[data-testid="home-widget-card"][data-home-widget-type="${type}"]`,
  );
}

async function expectTouchTarget(locator: Locator, minimum: number) {
  const box = await requiredBox(locator);

  // 浏览器缩放矩阵偶尔会产生 43.9999px 一类浮点结果，0.1px 仅用于消除计算误差。
  expect(box.height).toBeGreaterThanOrEqual(minimum - 0.1);
  expect(box.width).toBeGreaterThanOrEqual(minimum - 0.1);
}

async function expectNoClippedHomeWidgets(page: Page) {
  const clippedWidgets = await page
    .getByTestId("home-widget-card")
    .evaluateAll((cards) =>
      cards
        .map((card) => ({
          overflow: card.scrollHeight - card.clientHeight,
          type: card.getAttribute("data-home-widget-type"),
        }))
        .filter((item) => item.overflow > 2),
    );

  expect(clippedWidgets).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflow).toBeLessThanOrEqual(2);
}

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();

  expect(box).not.toBeNull();
  return box!;
}
