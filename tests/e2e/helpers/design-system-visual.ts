import { expect, type Page } from "@playwright/test";

// 截图准备与视口边界。这里不登录、不保存业务记录；截图阈值保持原约定。
export async function stabilizeVisualPage(page: Page) {
  // 服务端先生成日期，浏览器预先改写 Date 会让两侧首屏不一致并触发水合错误。
  // 只请求减少动效；截图时另行冻结动画与光标，不改动业务日期。
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .addStyleTag({
      content: `
        *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }
        nextjs-portal { display: none !important; }
      `,
    })
    .catch(() => undefined);
}

export async function capture(page: Page, name: string) {
  // 每次导航后重新注入样式，因为整页请求会创建新的 document。
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}nextjs-portal{display:none!important}",
  });
  await expect(page).toHaveScreenshot(name, {
    animations: "disabled",
    // Playwright 默认截图会临时给输入框写入 caret-color，撞上 React 水合时会产生假告警。
    caret: "initial",
    maxDiffPixelRatio: 0.015,
  });
}

export async function expectDocumentInsideViewport(page: Page) {
  const overflowPixels = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflowPixels).toBeLessThanOrEqual(2);
}

/**
 * 日期、月份和日期时间都使用锚定浮层。这里检查浏览器最终布局而不是 Tailwind 类名，
 * 可以同时发现 390px、768px 和桌面宽度下的碰撞翻转、横向越界与弹层过高问题。
 */
export async function expectAnchoredPopupInsideViewport(page: Page) {
  // 从日期切到月份时，关闭动画可能短暂保留上一层弹窗；最后挂载的是当前弹窗。
  const popup = page.locator('[data-slot="date-picker-popup"]:not([data-closed])').last();
  await expect(popup).toBeVisible();
  const box = await popup.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;

  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  await expectDocumentInsideViewport(page);
}

export function routeToName(route: string) {
  if (route === "/missing-visual-page") return "not-found";
  return route.replace(/^\//, "").replaceAll("/", "-");
}
