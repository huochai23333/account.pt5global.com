import { expect, type Locator, type Page } from "@playwright/test";
import { widgetCard, expectTouchTarget } from "./home-widget-assertions";

// 编辑态动效、边缘提示与键盘入口；真实预览拖动另在 home-resize-preview 中。
export async function verifyKeyboardAdjustDialog(page: Page) {
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

export async function expectEditWiggle(page: Page) {
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

export async function expectAllWidgetsWiggleState(
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

export async function expectResizeHint(
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
