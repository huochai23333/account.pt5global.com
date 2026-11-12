import { expect, type Locator, type Page } from "@playwright/test";

// 统一卡片定位、几何与裁切判断；不读取账号、不写入布局，误差仅用于浏览器浮点采样。
export function widgetCard(page: Page, type: string) {
  return page.locator(
    `[data-testid="home-widget-card"][data-home-widget-type="${type}"]`,
  );
}

export async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();

  expect(box).not.toBeNull();
  return box!;
}

export async function expectTouchTarget(locator: Locator, minimum: number) {
  const box = await requiredBox(locator);

  // 浏览器缩放矩阵偶尔会产生 43.9999px 一类浮点结果，0.1px 仅用于消除计算误差。
  expect(box.height).toBeGreaterThanOrEqual(minimum - 0.1);
  expect(box.width).toBeGreaterThanOrEqual(minimum - 0.1);
}

export async function expectNoClippedHomeWidgets(page: Page) {
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

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflow).toBeLessThanOrEqual(2);
}

export function expectBoxToStayStill(
  current: { height: number; width: number; x: number; y: number },
  initial: { height: number; width: number; x: number; y: number },
) {
  expect(Math.abs(current.x - initial.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(current.y - initial.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(current.width - initial.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(current.height - initial.height)).toBeLessThanOrEqual(1);
}
