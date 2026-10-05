import { expect, type Page } from "@playwright/test";

async function readRenderedLayout(page: Page) {
  // 稳定组件 ID 加宽高/网格位置一起核对；只看卡片数量不能证明保存了同一份布局。
  return page.getByTestId("home-widget-card").evaluateAll((elements) => elements.map((element) => ({
    id: element.getAttribute("data-home-widget-id"),
    width: element.getAttribute("data-home-widget-width"),
    height: element.getAttribute("data-home-widget-height"),
    column: (element as HTMLElement).style.getPropertyValue("--home-widget-grid-column"),
    row: (element as HTMLElement).style.getPropertyValue("--home-widget-grid-row"),
  })));
}

async function expectLayoutAfterReload(page: Page) {
  // 保存提示只是等待点；真正的页面断言发生在整页刷新、重新读取布局之后。
  // 这里不替代独立数据库凭证；受限读入口未准入前，不宣称写链路完整通过。
  await expect(page.getByTestId("home-layout-save-feedback")).toHaveAttribute("data-save-status", "saved");
  const expected = await readRenderedLayout(page);
  expect(expected).toHaveLength(5);
  expect(new Set(expected.map((item) => item.id)).size).toBe(5);
  for (const item of expected) {
    expect(item.id).toBeTruthy();
    expect(item.column).toMatch(/^\d+ \/ span \d+$/);
    expect(item.row).toMatch(/^\d+ \/ span \d+$/);
  }
  await page.reload();
  await expect(page.getByTestId("home-widget-card")).toHaveCount(5);
  await expect.poll(() => readRenderedLayout(page)).toEqual(expected);
  await expect(page.getByRole("heading", { name: "PT5 系统", exact: true })).toBeVisible();
  await expect(page.locator("nextjs-portal [data-nextjs-dialog], nextjs-portal [data-nextjs-dialog-overlay]")).toHaveCount(0);
}

export async function verifyResizedAndDraggedLayoutPersistence(page: Page) {
  // 原缩放流程把待办从 3×3 放大为 4×3；先证明尺寸刷新后仍在，再开始移动。
  const card = page.locator('[data-testid="home-widget-card"][data-home-widget-type="todos"]');
  await expect(card).toHaveAttribute("data-home-widget-width", "4");
  await expect(card).toHaveAttribute("data-home-widget-height", "3");
  await expectLayoutAfterReload(page);
  await expect(card).toHaveAttribute("data-home-widget-width", "4");
  await page.getByTestId("home-edit-button").click();
  const label = card.getByTestId("home-widget-editor-label");
  await label.scrollIntoViewIfNeeded();
  const start = await label.boundingBox();
  if (!start) throw new Error("home drag label has no visible geometry");
  const stride = await page.getByTestId("home-widget-grid").evaluate((element) => {
    const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
    return (element.getBoundingClientRect().width - gap * 4) / 5 + gap;
  });
  // 在非交互标题上按真实鼠标操作向右移动一列，不直接调用产品状态更新函数。
  const before = await readRenderedLayout(page);
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + stride, start.y + start.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => readRenderedLayout(page)).not.toEqual(before);
  await expect(card).toHaveCSS("grid-column-start", "2");
  await expectLayoutAfterReload(page);
  await expect(card).toHaveAttribute("data-home-widget-width", "4");
  await expect(card).toHaveAttribute("data-home-widget-height", "3");
  await expect(card).toHaveCSS("grid-column-start", "2");
}
