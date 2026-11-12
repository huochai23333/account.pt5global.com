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
import { localSqlValue, readLocalPostgresRows } from "./helpers/local-postgres-query";
import { expandOrderFilters } from "./helpers/order-filter-visibility";

test("filters wholesale orders by included month across pagination and responsive layouts", async ({
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(120_000);
  // 固定种子只用于可重建专属实例；独立查询另核对实际API/DB映射，不读取原认证环境。
  expect(baseURL).toBe(process.env.PLAYWRIGHT_BASE_URL);
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const defaultRange = getDefaultOrderDateRange();
  const dateBounds = getShanghaiOrderDateBounds(defaultRange);
  const [fixture] = readLocalPostgresRows<{ order_month: string }>(
    "select order_month from public.wholesale_orders where id = 'c2000000-0000-4000-8000-000000000001'",
  );
  expect(fixture).toBeDefined();
  const currentMonth = fixture.order_month.slice(0, 7);
  const currentMonthDate = `${currentMonth}-01`;

  // 页面查询之外再走一次服务端数据库读取，先取得当前日期范围内的权威数量。
  // 后续页面断言必须与这个数量一致，不能只凭列表出现或请求成功判断筛选正确。
  const [{ count: currentMonthCount }] = readLocalPostgresRows<{ count: number }>(`
    select count(*) from public.wholesale_orders
    where order_month = ${localSqlValue(currentMonthDate)}
      and ordered_at >= ${localSqlValue(dateBounds.fromInclusive)}
      and ordered_at < ${localSqlValue(dateBounds.toExclusive)}
  `);
  expect(currentMonthCount).toBeGreaterThan(20);

  await page.setViewportSize({ height: 900, width: 1440 });
  await loginAs(page, "administrator");
  await page.goto("/admin/wholesale/orders");
  await expectWorkspaceShell(page);
  await expectNotForbiddenPage(page);

  await applyIncludedMonth(page, currentMonth);
  await expect(
    page.getByText(`第 1-20 条，共 ${currentMonthCount} 条`, { exact: true }),
  ).toBeVisible();
  await expectOrderSummaryCount(page, currentMonthCount);

  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.locator('[data-testid^="wholesale-order-row-"]')).toHaveCount(
    Math.min(20, currentMonthCount - 20),
  );

  // 1900 年月份由独立查询确认没有记录，用它验证真实空状态而不是依赖固定夹具猜测。
  const [{ count: emptyCount }] = readLocalPostgresRows<{ count: number }>(`
    select count(*) from public.wholesale_orders where order_month = '1900-01-01'
      and ordered_at >= ${localSqlValue(dateBounds.fromInclusive)}
      and ordered_at < ${localSqlValue(dateBounds.toExclusive)}
  `);
  expect(emptyCount).toBe(0);

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
    // 手动创建的上下文不继承测试page的baseURL；相对登录和跳转都需同一本地入口。
    baseURL,
    viewport: { height: 844, width: 390 },
  });
  try {
    // 页面创建或监听注册失败时，也要由同一个finally回收已创建的上下文。
    const clientPage = await clientContext.newPage();
    const clientBrowserErrors: string[] = [];
    clientPage.on("console", (message) => {
      if (message.type() === "error") clientBrowserErrors.push(message.text());
    });
    clientPage.on("pageerror", (error) => clientBrowserErrors.push(error.message));
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
  await expandOrderFilters(page);
  const monthInput = page.getByLabel("计入月份");
  await monthInput.fill(month);
  await monthInput.press("Enter");
}

async function expectNoFrameworkError(page: Page) {
  await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
}

async function expectOrderSummaryCount(page: Page, count: number) {
  expect(Number.isSafeInteger(count) && count >= 0).toBe(true);
  const orderMetric = page
    .locator('[data-slot="metric-card"]')
    .filter({ has: page.getByText("订单", { exact: true }) })
    .filter({ visible: true });
  // 桌面/手机会保留隐藏副本，须唯一定位当前可见卡片，并完整比较数字而非子串。
  await expect(orderMetric).toHaveCount(1);
  await expect(orderMetric).toHaveText(new RegExp(`^订单\\s*${count}$`));
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
