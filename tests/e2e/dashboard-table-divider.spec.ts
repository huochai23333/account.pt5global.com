import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";

test("客户列表使用低强调分隔线并在移动端切换为卡片", async ({ page }) => {
  await loginAs(page, "administrator");

  await page.setViewportSize({ height: 900, width: 1440 });
  // 使用当前启用且确实渲染桌面表格/移动卡片的批发客户列表。
  await page.goto("/admin/wholesale/customers");
  await expectWorkspaceShell(page);
  await expectNotForbiddenPage(page);

  const tableRows = page.locator("table tbody tr");
  await expect(tableRows.nth(1)).toBeVisible();
  // 批发共享表格把分隔线画在单元格底部，读取行本身只会得到全局默认边框色。
  const dividerColors = await readDividerColors(
    tableRows.nth(1).locator("td").first(),
  );

  // 分隔线必须跟随低强调边界令牌，不能再次借用高权重的图表品牌色。
  expect(dividerColors.actual).toBe(dividerColors.subtle);
  expect(dividerColors.actual).not.toBe(dividerColors.chart);

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/admin/wholesale/customers");
  await expect(page.locator("table:visible")).toHaveCount(0);
  await expect(
    page
      .locator('main [data-slot="interactive-button"]')
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expectDocumentToFitViewport(page);
});

async function readDividerColors(row: Locator) {
  return row.evaluate((element) => {
    const probe = document.createElement("div");
    probe.style.borderColor = "var(--border-subtle)";
    probe.style.color = "var(--chart-1)";
    document.body.append(probe);

    const cellStyle = window.getComputedStyle(element);
    const probeStyle = window.getComputedStyle(probe);
    const colors = {
      actual: cellStyle.borderBottomColor,
      chart: probeStyle.color,
      subtle: probeStyle.borderTopColor,
    };

    probe.remove();
    return colors;
  });
}

async function expectDocumentToFitViewport(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflowPixels).toBeLessThanOrEqual(2);
}
