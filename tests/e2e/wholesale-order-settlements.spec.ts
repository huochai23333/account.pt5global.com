import { expect, test, type Page } from "@playwright/test";

import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import { fillDateControl } from "./helpers/date-control";
import { chooseSelectOption } from "./helpers/select-control";
import { cleanupRateFixtures, ensureLocalUsdRate } from "./helpers/wholesale-settlement-fixtures";

test.describe("wholesale order settlements", () => {
  const createdRateIds = new Set<string>();
  test.afterEach(async () => {
    await cleanupRateFixtures([...createdRateIds]);
    createdRateIds.clear();
  });
  test("admin can record multiple settlements with a selected date", async ({
    page,
  }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    const uniqueNote = `分批结汇测试 ${Date.now()}`;
    const currentMonth = getShanghaiDateInputValue().slice(0, 7);
    const settlementDate = getShanghaiDateInputValue();
    // 测试汇率只针对本次日期创建，并在用例结束清理；不依赖昨日种子报价。
    const rateId = await ensureLocalUsdRate(settlementDate, 7.18);
    if (rateId) createdRateIds.add(rateId);
    // 汇率在页面服务端首读时加载；夹具创建后刷新，才能用新日期结汇。
    await page.reload();

    await page.getByRole("button", { name: "新建订单" }).click();

    const createDialog = page.getByRole("dialog", { name: "新建批发订单" });
    await chooseSelectOption(createDialog.getByLabel("客户名"), {
      label: "Wholesale Alpha",
    });
    await createDialog.getByLabel("小单数量").fill("1");
    await createDialog.getByLabel("产品采购金额").fill("10");
    await createDialog.getByLabel("国际运费").fill("1");
    await createDialog.getByLabel("其他费用").fill("0");
    await createDialog.getByLabel("推荐佣金费用").fill("0");
    await createDialog.getByLabel("快递公司").fill("DHL");
    await chooseSelectOption(createDialog.getByLabel("客户支付币种"), {
      value: "USD",
    });
    await createDialog.getByLabel("客户支付金额").fill("300");
    await chooseSelectOption(createDialog.getByLabel("收款平台"), {
      label: "Wise",
    });
    await fillDateControl(
      createDialog.getByLabel("订单计入月份"),
      currentMonth,
    );
    await createDialog.getByLabel("备注").fill(uniqueNote);
    await createDialog.getByRole("button", { name: "保存订单" }).click();

    await expect(page.getByText("批发订单已保存。")).toBeVisible();
    await page.getByLabel("搜索订单").fill(uniqueNote);
    await page.getByRole("button", { name: "查看全部字段" }).click();

    // 用唯一备注查单后，通过列表结果定位；常用列不直接展示备注。
    const orderRows = page.locator('[data-testid^="wholesale-order-row-"]');
    await expect(orderRows).toHaveCount(1);
    const orderRow = orderRows.first();
    await expect(orderRow).toBeVisible();
    await expect(orderRow).toContainText("未结汇");

    await recordSettlement(page, orderRow, "100", settlementDate);
    await expect(page.getByText("结汇记录已保存。")).toBeVisible();
    await expect(orderRow).toContainText("已结 US$100.00");
    await expect(orderRow).toContainText("剩余 US$200.00");
    await expect(orderRow).toContainText("7.18");

    await recordSettlement(page, orderRow, "200", settlementDate);
    await expect(page.getByText("结汇记录已保存。")).toBeVisible();
    await expect(orderRow).toContainText("已结 US$300.00");
    await expect(orderRow).toContainText("剩余 US$0.00");
  });

  test("wholesale order settlement page keeps desktop and mobile layout usable", async ({
    page,
  }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
    await expect(page.getByRole("heading", { name: "批发订单" })).toBeVisible();
    await expectLocalSeededWholesaleOrders(page);
    await expectCompactSettlementOrderControls(page);
    await expectNoSettlementStatusInOrderNumberCell(page);
    await expectCompactLocalSeededOrderRows(page);
    await page.getByLabel("搜索订单").fill("1688-LOCAL-001");
    await page.getByRole("button", { name: "跨日期查此单号" }).click();
    await expect(
      page.locator('[data-testid^="wholesale-order-row-"]').filter({
        // 本地夹具按运行当天的上海月份生成订单号，测试不能固定旧月份。
        hasText: `WH-LOCAL-${getShanghaiDateInputValue().slice(0, 7).replace("-", "")}-001`,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "查看全部字段" }).click();
    await expectLinkedPurchaseOrderDetailsDialog(page);
    await expectNoDocumentHorizontalOverflow(page);

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/admin/wholesale/orders");
    await expect(page.getByRole("heading", { name: "批发订单" })).toBeVisible();
    await page
      .locator('[data-testid^="wholesale-order-card-"]')
      .filter({ hasText: "未结汇" })
      .first()
      .click();
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "登记结汇" }),
    ).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
  });
});

async function recordSettlement(
  page: Page,
  orderRow: ReturnType<Page["getByRole"]>,
  amount: string,
  settlementDate: string,
) {
  await orderRow.getByRole("button", { name: "登记结汇" }).click();

  const settlementDialog = page.getByRole("dialog", { name: "确认结汇" });
  await expect(settlementDialog).toBeVisible();
  await settlementDialog.getByLabel("本次结汇金额").fill(amount);
  await fillDateControl(
    settlementDialog.getByLabel("结汇日期"),
    settlementDate,
  );
  await expect(settlementDialog.getByText("7.18", { exact: true }).first()).toBeVisible();
  await settlementDialog.getByRole("button", { name: "保存结汇记录" }).click();
}

async function expectCompactSettlementOrderControls(page: Page) {
  const controlHeight = await page
    .getByRole("button", { name: "登记结汇" })
    .first()
    .locator("xpath=ancestor::td[1]/*[1]")
    .evaluate((element) => element.getBoundingClientRect().height);

  expect(controlHeight).toBeLessThanOrEqual(120);
}

async function expectNoSettlementStatusInOrderNumberCell(page: Page) {
  const orderNumberCellText = await page
    .locator('[data-testid^="wholesale-order-row-"]')
    .first()
    .locator("td")
    .first()
    .innerText();

  expect(orderNumberCellText).not.toMatch(/未结汇|部分结汇|已结汇/);
}

async function expectCompactLocalSeededOrderRows(page: Page) {
  const rowHeights = await page
    .locator('[data-testid^="wholesale-order-row-"]')
    .filter({ hasText: "WH-LOCAL-" })
    .evaluateAll((rows) =>
      rows.map((row) => row.getBoundingClientRect().height),
    );

  expect(Math.max(...rowHeights)).toBeLessThanOrEqual(150);
}

async function expectLinkedPurchaseOrderDetailsDialog(page: Page) {
  await page.getByRole("button", { name: "1688-LOCAL-001" }).first().click();

  const purchaseDialog = page.getByRole("dialog", { name: "1688 订单详情" });
  await expect(purchaseDialog).toBeVisible();
  await expect(purchaseDialog.getByText("Yiwu Sample Supplier")).toBeVisible();
  await expect(purchaseDialog.getByText("Travel accessories batch A")).toBeVisible();
  await expect(purchaseDialog.getByText("1688-LOCAL-001")).toBeVisible();
  await purchaseDialog
    .getByRole("button", { name: /关闭弹窗|Close dialog/ })
    .click();
  await expect(purchaseDialog).toHaveCount(0);
}

async function expectLocalSeededWholesaleOrders(page: Page) {
  await expect(page.locator('[data-testid^="wholesale-order-row-"]')).toHaveCount(20);
  await expect(
    page
      .locator('[data-testid^="wholesale-order-row-"]')
      .filter({ hasText: "WH-LOCAL-" }),
  ).not.toHaveCount(0);
}

function getShanghaiDateInputValue() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflowPixels).toBeLessThanOrEqual(2);
}
