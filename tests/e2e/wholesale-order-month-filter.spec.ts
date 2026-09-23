import { expect, test, type Page } from "@playwright/test";

import {
  getDefaultOrderDateRange,
  getShanghaiOrderDateBounds,
} from "../../lib/order-date-range";
import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";

test("filters wholesale orders by included month across pagination and responsive layouts", async ({
  browser,
  page,
}) => {
  test.setTimeout(120_000);
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const admin = getLocalSupabaseAdminClient();
  test.skip(!admin, "需要本地 Supabase 管理客户端独立核对筛选结果。");
  if (!admin) return;

  const defaultRange = getDefaultOrderDateRange();
  const dateBounds = getShanghaiOrderDateBounds(defaultRange);
  const currentMonth = defaultRange.toDate.slice(0, 7);
  const currentMonthDate = `${currentMonth}-01`;

  // 页面查询之外再走一次服务端数据库读取，先取得当前日期范围内的权威数量。
  // 后续页面断言必须与这个数量一致，不能只凭列表出现或请求成功判断筛选正确。
  const currentMonthResult = await admin
    .from("wholesale_orders")
    .select("id", { count: "exact" })
    .eq("order_month", currentMonthDate)
    .gte("ordered_at", dateBounds.fromInclusive)
    .lt("ordered_at", dateBounds.toExclusive);
  expect(currentMonthResult.error).toBeNull();
  expect(currentMonthResult.count).not.toBeNull();
  const currentMonthCount = currentMonthResult.count ?? 0;
  expect(currentMonthCount).toBeGreaterThan(20);

  await page.setViewportSize({ height: 900, width: 1440 });
  await loginAs(page, "administrator");
  await page.goto("/admin/wholesale/orders");
  await expectWorkspaceShell(page);
  await expectNotForbiddenPage(page);

  await applyIncludedMonth(page, currentMonth);
  await expect(
    page.getByText(`已显示 20 / ${currentMonthCount} 笔订单`, { exact: true }),
  ).toBeVisible();
  await expectOrderSummaryCount(page, currentMonthCount);

  await page.getByRole("button", { name: "继续加载" }).click();
  await expect(page.locator('[data-testid^="wholesale-order-row-"]')).toHaveCount(
    Math.min(40, currentMonthCount),
  );

  // 1900 年月份由独立查询确认没有记录，用它验证真实空状态而不是依赖固定夹具猜测。
  const emptyMonthResult = await admin
    .from("wholesale_orders")
    .select("id", { count: "exact", head: true })
    .eq("order_month", "1900-01-01")
    .gte("ordered_at", dateBounds.fromInclusive)
    .lt("ordered_at", dateBounds.toExclusive);
  expect(emptyMonthResult.error).toBeNull();
  expect(emptyMonthResult.count).toBe(0);

  await applyIncludedMonth(page, "1900-01");
  await expect(page.getByText("没有匹配的批发订单。可以调整筛选条件，或新建一笔订单。"))
    .toBeVisible();
  await expectOrderSummaryCount(page, 0);

  await page.getByRole("button", { name: "恢复默认范围" }).click();
  await expect(page.getByLabel("计入月份")).toHaveValue("");
  await expect(page.locator('[data-testid^="wholesale-order-row-"]')).toHaveCount(20);

  // 筛选状态不写入地址；整页刷新后重新选择同一月份，结果仍须与数据库数量一致。
  await page.reload();
  await expect(page.getByLabel("计入月份")).toHaveValue("");
  await applyIncludedMonth(page, currentMonth);
  await expectOrderSummaryCount(page, currentMonthCount);

  await page.setViewportSize({ height: 844, width: 390 });
  await expect(page.locator('[data-testid^="wholesale-order-card-"]').first())
    .toBeVisible();
  await page.getByRole("button", { name: /更多筛选条件/ }).click();
  await expect(page.getByLabel("计入月份")).toBeVisible();
  await expectNoLayoutRegression(page);
  await expectNoFrameworkError(page);
  expect(browserErrors).toEqual([]);

  const clientContext = await browser.newContext({
    viewport: { height: 844, width: 390 },
  });
  const clientPage = await clientContext.newPage();
  const clientBrowserErrors: string[] = [];
  clientPage.on("console", (message) => {
    if (message.type() === "error") clientBrowserErrors.push(message.text());
  });
  clientPage.on("pageerror", (error) => clientBrowserErrors.push(error.message));
  try {
    await loginAs(clientPage, "client");
    await clientPage.goto("/client/wholesale/orders");
    await clientPage.getByRole("button", { name: /更多筛选条件/ }).click();
    await expect(clientPage.getByLabel("计入月份")).toHaveCount(0);
    await expectNoLayoutRegression(clientPage);
    await expectNoFrameworkError(clientPage);
    expect(clientBrowserErrors).toEqual([]);
  } finally {
    await clientContext.close();
  }
});

async function applyIncludedMonth(page: Page, month: string) {
  const monthInput = page.getByLabel("计入月份");
  await monthInput.fill(month);
  await monthInput.press("Enter");
}

async function expectNoFrameworkError(page: Page) {
  await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
}

async function expectOrderSummaryCount(page: Page, count: number) {
  const orderMetric = page
    .locator('[data-slot="metric-card"]')
    .filter({ hasText: "订单" })
    .first();
  await expect(orderMetric).toContainText(String(count));
}

async function expectNoLayoutRegression(page: Page) {
  const layout = await page.evaluate(() => {
    const visibleElements = [...document.querySelectorAll("main *")].filter(
      (element) => {
        const htmlElement = element as HTMLElement;
        return Boolean(htmlElement.offsetWidth || htmlElement.offsetHeight);
      },
    );
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      verticalTextCount: visibleElements.filter(
        (element) => window.getComputedStyle(element).writingMode !== "horizontal-tb",
      ).length,
    };
  });

  expect(layout.overflow).toBeLessThanOrEqual(2);
  expect(layout.verticalTextCount).toBe(0);
}
