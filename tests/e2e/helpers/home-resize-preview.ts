import { expect, type Locator, type Page } from "@playwright/test";
import { widgetCard, requiredBox, expectBoxToStayStill } from "./home-widget-assertions";
import { expectAllWidgetsWiggleState } from "./home-resize-editor";

// 只负责一次鼠标缩放的预览与松手提交；不改产品状态，也不代替后续独立持久化验证。
export async function verifyStableResizePreview(page: Page, todoCard: Locator) {
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
