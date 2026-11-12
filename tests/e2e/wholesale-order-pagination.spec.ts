import { expect, test, type Browser, type Page } from "@playwright/test";

import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import {
  readLocalPostgresRows,
  localSqlValue,
} from "./helpers/local-postgres-query";
import { expandOrderFilters } from "./helpers/order-filter-visibility";
import { verifyAttachmentSharing } from "./helpers/wholesale-order-attachment-sharing";

let LOCAL_ORDER_NUMBER_2 = "";
const fixtureOrderNumbers = new Map<number, string>();
test.beforeAll(async () => {
  const rows = readLocalPostgresRows<{ id: string; order_number: string }>(
    "select id,order_number from public.wholesale_orders where id in ('c2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000002')",
  );
  expect(rows).toHaveLength(2);
  for (const index of [1, 2]) {
    const row = rows.find(
      (row) =>
        row.id === `c2000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );
    if (!row?.order_number) throw Error("pagination_fixture_order_missing");
    fixtureOrderNumbers.set(index, row.order_number);
  }
  // 精确读取两张夹具的实际编号，不根据第一张编号猜测另一张仍连续。
  expect(new Set(fixtureOrderNumbers.values()).size).toBe(2);
  LOCAL_ORDER_NUMBER_2 = buildCurrentLocalOrderNumber(2);
});

test.describe("wholesale order pagination", () => {
  test("loads stable batches and searches own order numbers", async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    // 列表在首次加载、筛选和刷新后都不应留下浏览器运行错误。
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
    await expandOrderFilters(page);
    await expect(page.getByLabel("客户", { exact: true })).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
    // 日常默认表格只保留常用列；详细费用和附件可按需查看。
    await expect(page.getByRole("columnheader")).toHaveCount(7);

    const rows = page.locator('[data-testid^="wholesale-order-row-"]');
    await expect(rows).toHaveCount(20);
    await expect(page.getByText(/第 1-20 条，共 \d+ 条/)).toBeVisible();

    const firstBatchIds = await readOrderRowIds(page);
    const secondResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/rpc/get_wholesale_order_page") &&
        r.request().method() === "POST" &&
        r.request().postDataJSON()?.p_page === 2,
    );
    await page.getByRole("button", { name: "下一页" }).click();
    const response = await secondResponse;
    expect(response.ok()).toBe(true);
    const payload = await response.json();
    expect(payload.orders).toHaveLength(20);
    // 不能用旧一页的20行满足新一页断言，必须等待当前编号与第二页响应逐项一致。
    await expect
      .poll(() => readOrderRowIds(page))
      .toEqual(payload.orders.map((row: { id: string }) => row.id));
    await expect(rows).toHaveCount(20);

    const loadedIds = await readOrderRowIds(page);
    expect(new Set(loadedIds).size).toBe(loadedIds.length);
    expect(loadedIds.some((id) => firstBatchIds.includes(id))).toBe(false);
    const stored = readLocalPostgresRows<{ id: string }>(
      `select id from public.wholesale_orders where id in (${loadedIds.map(localSqlValue).join(",")})`,
    );
    expect(stored).toHaveLength(20);
    expect(new Set(stored.map((row) => row.id))).toEqual(new Set(loadedIds));
    await page.getByRole("button", { name: "上一页" }).click();
    await expect.poll(() => readOrderRowIds(page)).toEqual(firstBatchIds);

    await searchWholesaleOrdersAcrossDates(
      page,
      buildCurrentLocalOrderNumber(1),
    );
    await expect(rows).toHaveCount(1);
    await expect(
      page.getByTestId(
        "wholesale-order-row-c2000000-0000-4000-8000-000000000001",
      ),
    ).toBeVisible();
    // 刷新后重新从数据库读取，确认搜索结果不依赖页面内存中的旧数据。
    await page.reload();
    await searchWholesaleOrdersAcrossDates(
      page,
      buildCurrentLocalOrderNumber(1),
    );
    await expect(rows).toHaveCount(1);
    await expect(
      page.getByTestId(
        "wholesale-order-row-c2000000-0000-4000-8000-000000000001",
      ),
    ).toBeVisible();
    await expect(
      page.locator("nextjs-portal [data-nextjs-dialog]"),
    ).toHaveCount(0);
    expect(browserErrors).toEqual([]);
  });

  test("salesman and client can use wholesale order cards on mobile", async ({
    browser,
    baseURL,
  }) => {
    await expectMobileOrderCards(
      browser,
      "salesman",
      "/salesman/wholesale/orders",
      baseURL,
    );
    await expectMobileOrderCards(
      browser,
      "client",
      "/client/wholesale/orders",
      baseURL,
    );
  });

  test("mobile shows order cards first and keeps details inside a focused dialog", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");

    await expect(page.getByLabel("搜索订单")).toBeVisible();
    await expect(page.getByText(/当前筛选概览.*（展开）/)).toBeVisible();
    await expect(
      page.locator('[data-testid^="wholesale-order-card-"]'),
    ).toHaveCount(20);
    await expect(
      page.locator('[data-testid^="wholesale-order-row-"]').first(),
    ).toBeHidden();

    await page
      .locator('[data-testid^="wholesale-order-card-"]')
      .first()
      .click();

    const detailsDialog = page.getByRole("dialog", { name: /^订单 / });
    await expect(detailsDialog).toBeVisible();
    await expect(
      detailsDialog.getByRole("heading", { name: "费用和利润" }),
    ).toBeVisible();
    await expect(
      detailsDialog.getByRole("heading", { name: "结汇记录" }),
    ).toBeVisible();
    await expect(
      detailsDialog.getByRole("heading", { name: "备注" }),
    ).toBeVisible();
    await expect(
      detailsDialog.getByRole("button", { name: "修改订单" }),
    ).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
  });

  test("finance and scoped sales staff can manage Order List attachments", async ({
    browser,
    baseURL,
  }) => {
    expect(baseURL).toBeTruthy();
    const roleCases = [
      { role: "finance" as const, url: "/finance/wholesale/orders" },
      { role: "salesman" as const, url: "/salesman/wholesale/orders" },
    ];

    for (const roleCase of roleCases) {
      const context = await browser.newContext({
        baseURL,
        viewport: { height: 900, width: 1440 },
      });
      const errors: unknown[] = [];
      try {
        const page = await context.newPage();
        await loginAs(page, roleCase.role);
        await page.goto(roleCase.url);
        await searchWholesaleOrdersAcrossDates(page, LOCAL_ORDER_NUMBER_2);
        const row = page.locator(
          '[data-testid="wholesale-order-row-c2000000-0000-4000-8000-000000000002"]',
        );
        await expect(row).toBeVisible();
        await page.getByRole("button", { name: "查看全部字段" }).click();
        await expect(
          page.getByRole("button", { name: "显示常用字段" }),
        ).toBeVisible();
        await expect(
          row.getByRole("button", { name: "管理附件" }),
        ).toBeVisible();
      } catch (error) {
        errors.push(error);
      }
      try {
        await context.close();
      } catch (error) {
        errors.push(error);
      }
      if (errors.length)
        throw new AggregateError(errors, "pagination_context_incomplete");
    }
  });

  test("shows core failures and keeps related-record failures local", async ({
    page,
  }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");

    await page.route(
      "**/rest/v1/wholesale_order_settlements**",
      async (route) => {
        await route.fulfill({
          body: JSON.stringify({ message: "test settlement failure" }),
          contentType: "application/json",
          status: 500,
        });
      },
    );
    await searchWholesaleOrdersAcrossDates(
      page,
      buildCurrentLocalOrderNumber(1),
    );
    await expect(
      page.getByText("部分结汇记录暂时没有加载成功。"),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid^="wholesale-order-row-"]'),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "查看全部字段" }).click();
    await expect(
      page.locator('[data-testid^="wholesale-order-row-"]').filter({
        hasText: buildCurrentLocalOrderNumber(1),
      }),
    ).toHaveCount(1);

    await page.unroute("**/rest/v1/wholesale_order_settlements**");
    await page.route("**/rest/v1/rpc/get_wholesale_order_page", (route) =>
      route.abort(),
    );
    await page.getByLabel("搜索订单").fill("无法加载的订单");
    await expect(
      page.getByText("批发订单暂时没有加载成功，请稍后重试。"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
  });

  test("keeps client order fields private and shares Order List attachments", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(180_000);
    await verifyAttachmentSharing(browser, baseURL);
  });
});

async function readOrderRowIds(page: Page) {
  return page
    .locator('[data-testid^="wholesale-order-row-"]')
    .evaluateAll((rows) =>
      rows.map(
        (row) =>
          row
            .getAttribute("data-testid")
            ?.replace("wholesale-order-row-", "") ?? "",
      ),
    );
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflowPixels).toBeLessThanOrEqual(2);
}

function buildCurrentLocalOrderNumber(index: number) {
  const value = fixtureOrderNumbers.get(index);
  if (!value) throw Error("pagination_fixture_number_unconfirmed");
  return value;
}

/**
 * 本地固定订单可能早于页面默认的最近 30 天范围。
 * 精确回归应使用产品已有的“跨日期查此单号”，而不是放宽真实用户的默认查询范围。
 */
async function searchWholesaleOrdersAcrossDates(
  page: Page,
  orderNumber: string,
) {
  await page.getByLabel("搜索订单").fill(orderNumber);
  await page.getByRole("button", { name: "跨日期查此单号" }).click();
}

async function expectMobileOrderCards(
  browser: Browser,
  role: "client" | "salesman",
  path: string,
  baseURL: string | undefined,
) {
  expect(baseURL).toBeTruthy();
  const context = await browser.newContext({
    baseURL,
    viewport: { height: 844, width: 390 },
  });
  const errors: unknown[] = [];
  try {
    const page = await context.newPage();
    await loginAs(page, role);
    await page.goto(path);
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
    await expect(page.getByLabel("搜索订单")).toBeVisible();
    if (role === "client") {
      await expect(page.getByLabel("客户", { exact: true })).toHaveCount(0);
    }
    await expect(
      page.locator('[data-testid^="wholesale-order-card-"]').first(),
    ).toBeVisible();
    if (role === "client") {
      // 客户从实际卡片进入详情，确认页面围绕订单履约展示而非后台结汇资料。
      await page
        .locator('[data-testid^="wholesale-order-card-"]')
        .first()
        .click();
      const dialog = page.getByRole("dialog", { name: /^订单 / });
      await expect(dialog.getByText("物流公司")).toBeVisible();
      await expect(
        dialog.getByRole("heading", { name: "结汇记录" }),
      ).toHaveCount(0);
      await dialog.getByRole("button", { name: "关闭" }).click();
    }
    await expectNoDocumentHorizontalOverflow(page);
    await expectNoVerticalText(page);
    await expectVisibleButtonsHaveTouchSize(page);
  } catch (error) {
    errors.push(error);
  }
  try {
    await context.close();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length)
    throw new AggregateError(errors, "pagination_mobile_context_incomplete");
}

async function expectNoVerticalText(page: Page) {
  const verticalElements = await page.locator("main *:visible").evaluateAll(
    (elements) =>
      elements.filter((element) => {
        const style = window.getComputedStyle(element);
        return style.writingMode !== "horizontal-tb";
      }).length,
  );
  expect(verticalElements).toBe(0);
}

async function expectVisibleButtonsHaveTouchSize(page: Page) {
  const undersizedLabels = await page
    .locator("main button:visible")
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => {
          const box = button.getBoundingClientRect();
          return box.width < 40 || box.height < 40;
        })
        .map(
          (button) =>
            button.textContent?.trim() || button.getAttribute("aria-label"),
        ),
    );
  expect(undersizedLabels).toEqual([]);
}
