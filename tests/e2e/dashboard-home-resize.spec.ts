import { expect, test, type Locator, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

test("桌面首页缩放稳定且保留键盘调整方式", async ({ page }) => {
  await loginAs(page, "administrator");
  await resetHomeLayout(page);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/admin/home");
  await page.getByTestId("home-edit-button").click();

  await expect(page.getByTestId("home-widget-editor-compact")).toHaveCount(1);
  await expectEditorGeometry(page);
  await expectEditWiggle(page);

  const todoCard = widgetCard(page, "todos");
  const todoCardBox = await requiredBox(todoCard);

  await page.mouse.move(
    todoCardBox.x + 12,
    todoCardBox.y + todoCardBox.height / 2,
  );
  await expectResizeHint(
    todoCard,
    "left",
    "左右拖动调整宽度",
    "我的待办",
  );
  await expect(todoCard).toHaveAttribute("data-home-widget-wiggling", "false");
  await expect(widgetCard(page, "announcements")).toHaveAttribute(
    "data-home-widget-wiggling",
    "true",
  );

  await page.mouse.move(
    todoCardBox.x + todoCardBox.width / 2,
    todoCardBox.y + 12,
  );
  await expectResizeHint(todoCard, "top", "上下拖动调整高度", "我的待办");

  await page.mouse.move(todoCardBox.x + 12, todoCardBox.y + 12);
  await expectResizeHint(
    todoCard,
    "top-left",
    "斜向拖动调整大小",
    "我的待办",
  );
  await expect(todoCard).toHaveScreenshot("desktop-home-resize-hint.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });

  const clockCard = widgetCard(page, "clock");
  // 常用工作区增加后时钟可能落在首屏下方；先滚入视口再按真实位置悬停。
  await clockCard.scrollIntoViewIfNeeded();
  const clockCardBox = await requiredBox(clockCard);

  await page.mouse.move(
    clockCardBox.x + 12,
    clockCardBox.y + clockCardBox.height / 2,
  );
  await expectResizeHint(
    clockCard,
    "left",
    "左右拖动调整宽度",
    "当前时间",
  );

  // 离开边缘后提示应及时消失，避免一直遮住编辑内容。
  await todoCard.scrollIntoViewIfNeeded();
  const todoCardAfterScroll = await requiredBox(todoCard);
  await page.mouse.move(
    todoCardAfterScroll.x + todoCardAfterScroll.width / 2,
    todoCardAfterScroll.y + todoCardAfterScroll.height / 2,
  );
  await expect(page.getByTestId("home-widget-resize-handle-active")).toHaveCount(
    0,
  );
  await expect
    .poll(() => todoCard.getAttribute("data-home-widget-wiggling"))
    .toBe("true");

  for (const button of await page
    .locator(
      '[data-testid="home-widget-adjust-button"], [data-testid="home-widget-remove-button"]',
    )
    .all()) {
    await expectTouchTarget(button, 44);
  }

  await verifyKeyboardAdjustDialog(page);
  await verifyStableResizePreview(page, todoCard);
  await resetHomeLayout(page);
});

async function verifyKeyboardAdjustDialog(page: Page) {
  const adjustTrigger = widgetCard(page, "greeting").getByTestId(
    "home-widget-adjust-button",
  );

  await adjustTrigger.focus();
  await adjustTrigger.press("Enter");
  const adjustDialog = page.getByRole("dialog", { name: /调整组件/ });

  await expect(adjustDialog).toBeVisible();
  await expectAllWidgetsWiggleState(page, "false");
  await expect(
    adjustDialog.getByTestId("home-adjust-move-left"),
  ).toBeDisabled();
  await expect(
    adjustDialog.getByTestId("home-adjust-move-right"),
  ).toBeDisabled();

  // 等弹窗的短进入动画结束后再测量，避免缩放中的临时尺寸被当成最终触控尺寸。
  await page.waitForTimeout(250);
  for (const button of await adjustDialog
    .locator('[data-testid^="home-adjust-"]')
    .all()) {
    await expectTouchTarget(button, 44);
  }

  await page.keyboard.press("Escape");
  await expect(adjustDialog).toBeHidden();
  await expect(adjustTrigger).toBeFocused();
  await expect
    .poll(() =>
      widgetCard(page, "greeting").getAttribute(
        "data-home-widget-wiggling",
      ),
    )
    .toBe("true");
}

async function verifyStableResizePreview(page: Page, todoCard: Locator) {
  /*
   * 缩放过程中只更新预览框，真实卡片和相邻卡片都应保持原位。
   * 松开鼠标后再一次性更新网格，避免连续重排产生抖动和残影。
   */
  const announcementCard = widgetCard(page, "announcements");
  const todoBeforeResize = await requiredBox(todoCard);
  const announcementBeforeResize = await requiredBox(announcementCard);
  const grid = page.getByTestId("home-widget-grid");
  const gridStride = await grid.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;

    return (rect.width - gap * 4) / 5 + gap;
  });

  await page.mouse.move(
    todoBeforeResize.x + todoBeforeResize.width - 12,
    todoBeforeResize.y + todoBeforeResize.height / 2,
  );
  const rightResizeHandle = todoCard.getByTestId(
    "home-widget-resize-handle-active",
  );

  await expect(rightResizeHandle).toHaveAttribute(
    "data-resize-direction",
    "right",
  );
  const rightHandleBox = await requiredBox(rightResizeHandle);

  // 待办已经处于 3×3 最小尺寸，向内拖动时预览和真实卡片都不能继续缩小。
  await page.mouse.move(
    rightHandleBox.x + rightHandleBox.width / 2,
    rightHandleBox.y + rightHandleBox.height / 2,
  );
  await page.mouse.down();
  await expectAllWidgetsWiggleState(page, "false");
  await page.mouse.move(
    rightHandleBox.x + rightHandleBox.width / 2 - gridStride * 2,
    rightHandleBox.y + rightHandleBox.height / 2,
    { steps: 8 },
  );
  const minimumPreview = page.getByTestId("home-widget-resize-preview");

  await expect(minimumPreview).toContainText("3 × 3");
  expectBoxToStayStill(await requiredBox(todoCard), todoBeforeResize);
  await page.mouse.up();
  await expect(minimumPreview).toHaveCount(0);
  await expect(todoCard).toHaveAttribute("data-home-widget-width", "3");

  // 重新抓住右侧把手向外拖动，验证允许范围内仍能正常放大。
  await page.mouse.move(
    todoBeforeResize.x + todoBeforeResize.width - 12,
    todoBeforeResize.y + todoBeforeResize.height / 2,
  );
  const expandHandle = todoCard.getByTestId(
    "home-widget-resize-handle-active",
  );
  const expandHandleBox = await requiredBox(expandHandle);

  await page.mouse.move(
    expandHandleBox.x + expandHandleBox.width / 2,
    expandHandleBox.y + expandHandleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    expandHandleBox.x + expandHandleBox.width / 2 + gridStride,
    expandHandleBox.y + expandHandleBox.height / 2,
    { steps: 8 },
  );

  const resizePreview = page.getByTestId("home-widget-resize-preview");

  await expect(resizePreview).toBeVisible();
  await expect(resizePreview).toContainText("4 × 3");
  expectBoxToStayStill(await requiredBox(todoCard), todoBeforeResize);
  expectBoxToStayStill(
    await requiredBox(announcementCard),
    announcementBeforeResize,
  );
  await expect(resizePreview).toHaveScreenshot(
    "desktop-home-resize-preview.png",
    {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    },
  );

  await page.mouse.up();
  await expect(resizePreview).toHaveCount(0);
  await expect
    .poll(async () => (await requiredBox(todoCard)).width)
    .toBeGreaterThan(todoBeforeResize.width + 100);
  await expect
    .poll(() => todoCard.getAttribute("data-home-widget-wiggling"))
    .toBe("true");
}

async function expectEditWiggle(page: Page) {
  await expectAllWidgetsWiggleState(page, "true");
  await expect
    .poll(() =>
      widgetCard(page, "greeting").locator("article").evaluate(
        (element) => getComputedStyle(element).animationName,
      ),
    )
    .toContain("dashboard-home-wiggle");

  /*
   * 系统要求减少动态效果时，卡片仍保持清楚的编辑边框，
   * 但浏览器不能继续播放循环摇晃。
   */
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      widgetCard(page, "greeting").locator("article").evaluate(
        (element) => getComputedStyle(element).animationName,
      ),
    )
    .toBe("none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
}

async function expectAllWidgetsWiggleState(
  page: Page,
  expected: "false" | "true",
) {
  const cards = page.getByTestId("home-widget-card");
  const expectedStates = Array(await cards.count()).fill(expected);

  await expect
    .poll(() =>
      cards.evaluateAll((elements) =>
        elements.map((card) =>
          card.getAttribute("data-home-widget-wiggling"),
        ),
      ),
    )
    .toEqual(expectedStates);
}

async function expectEditorGeometry(page: Page) {
  const collisions = await page
    .getByTestId("home-widget-card")
    .evaluateAll((cards) =>
      cards.flatMap((card) => {
        const toolbar = card.querySelector(
          '[data-testid="home-widget-editor-toolbar"]',
        );
        const preview = card.querySelector(
          '[data-testid="home-widget-editor-preview"]',
        );

        if (!toolbar || !preview) {
          return [];
        }

        const toolbarBox = toolbar.getBoundingClientRect();
        const previewBox = preview.getBoundingClientRect();

        return toolbarBox.bottom > previewBox.top + 1
          ? [card.getAttribute("data-home-widget-type")]
          : [];
      }),
    );

  expect(collisions).toEqual([]);
}

async function expectResizeHint(
  card: Locator,
  direction: string,
  label: string,
  widgetTitle: string,
) {
  const handle = card.getByTestId("home-widget-resize-handle-active");
  const guide = card.getByTestId("home-widget-resize-guide");
  const marker = card.getByTestId("home-widget-resize-marker");
  const editorLabel = card.getByTestId("home-widget-editor-label");

  await expect(handle).toHaveAttribute("data-resize-direction", direction);
  await expect(handle).toHaveAccessibleName(label);
  await expect(guide).toHaveAttribute("data-resize-direction", direction);
  await expect(marker).toHaveAttribute(
    "data-resize-marker-direction",
    direction,
  );
  await expect(editorLabel).toHaveText(widgetTitle);
  await expectTouchTarget(handle, 44);
}

async function resetHomeLayout(page: Page) {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/admin/home");
  await page.getByTestId("home-manage-button").click();
  const manager = page.getByRole("dialog", { name: "管理首页" });

  await expect(manager).toBeVisible();
  await manager.getByTestId("home-manager-reset").click();
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

function expectBoxToStayStill(
  current: { height: number; width: number; x: number; y: number },
  initial: { height: number; width: number; x: number; y: number },
) {
  expect(Math.abs(current.x - initial.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(current.y - initial.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(current.width - initial.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(current.height - initial.height)).toBeLessThanOrEqual(1);
}

async function expectTouchTarget(locator: Locator, minimum: number) {
  const box = await requiredBox(locator);

  // 浏览器缩放矩阵偶尔会产生 43.9999px 一类浮点结果，0.1px 仅用于消除计算误差。
  expect(box.height).toBeGreaterThanOrEqual(minimum - 0.1);
  expect(box.width).toBeGreaterThanOrEqual(minimum - 0.1);
}

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();

  expect(box).not.toBeNull();
  return box!;
}
