import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";
import { expectEditorGeometry } from "./helpers/home-editor-geometry";
import { verifyResizedAndDraggedLayoutPersistence } from "./helpers/home-layout-persistence";

import { requireDisposableFixture } from "../test-support/disposable-fixture";
import { widgetCard, requiredBox, expectTouchTarget } from "./helpers/home-widget-assertions";
import { resetHomeLayout } from "./helpers/home-manager";
import { expectEditWiggle, expectResizeHint, verifyKeyboardAdjustDialog } from "./helpers/home-resize-editor";
import { verifyStableResizePreview } from "./helpers/home-resize-preview";

// 会重置固定管理员布局；声明之外仍必须提供实际可重建的完整隔离实例。
test.beforeAll(() => requireDisposableFixture({
  baseURL: process.env.PLAYWRIGHT_BASE_URL,
  supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  mode: process.env.PT5_E2E_FIXTURE_MODE,
}));

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
  // 补上真实尺寸变更和位置拖动的保存/刷新检查；原认证入口保持不变。
  await verifyResizedAndDraggedLayoutPersistence(page);
  await resetHomeLayout(page);
});
