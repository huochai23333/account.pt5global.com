import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { cleanupFixtureResources } from "../test-support/fixture-cleanup-sequence";
import { shanghaiDate as getShanghaiDateInputValue } from "../test-support/shanghai-calendar";
import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import { fillDateControl } from "./helpers/date-control";
import { chooseSelectOption } from "./helpers/select-control";
import {
  cleanupQuoteFixture,
  createQuoteFixture,
  prepareQuoteFixture,
} from "./helpers/current-exchange-rate-fixture";
import {
  cleanupFeeCustomer,
  createFeeCustomerFixture,
  prepareFeeCustomer,
} from "./helpers/wholesale-fee-customer-fixture";
import {
  cleanupFeeOrder,
  confirmFeeOrder,
  createFeeOrderFixture,
  registerFeeOrderRequest,
} from "./helpers/wholesale-fee-order-fixture";
import {
  withFeePageRoute,
  forwardFeeWrite,
} from "./helpers/wholesale-fee-page-route";
import { readLocalPostgresRows } from "./helpers/local-postgres-query";
import { runWholesaleFeeSql } from "./helpers/wholesale-fee-database";
import {
  beginDirectUsdSettlement,
  directUsdCompanyRate,
} from "./helpers/wholesale-direct-usd-settlement";

const FIRST_ORDER_ID = "c2000000-0000-4000-8000-000000000001";
function readFirstSeedOrderNumber() {
  const [row] = readLocalPostgresRows<{ order_number: string }>(
    `select order_number from public.wholesale_orders where id='${FIRST_ORDER_ID}'`,
  );
  expect(row?.order_number).toBeTruthy();
  return row.order_number;
}

test.describe("wholesale order settlements", () => {
  test("admin can record multiple settlements with a selected date", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    runWholesaleFeeSql("select 1;");
    const prefix = "fees-e2e-" + randomUUID(),
      customer = createFeeCustomerFixture(prefix);
    const settlementDate = getShanghaiDateInputValue();
    const quote = createQuoteFixture(settlementDate, false, 7.18);
    const order = createFeeOrderFixture(
      prefix,
      "split-settlement",
      customer.id,
      "11111111-1111-4111-8111-111111111111",
      "new",
      "split-settlement",
    );
    let active: ReturnType<typeof beginDirectUsdSettlement> | undefined;
    await cleanupFixtureResources(
      async () => {
        // 所有拥有权清单均先登记，准备失败也按本次编号和版本收尾，不扫删共享种子。
        const persistedQuote = prepareQuoteFixture(quote);
        prepareFeeCustomer(customer);
        const expectedCompanyRate = String(
          directUsdCompanyRate(Number(persistedQuote.daily_exchange_rate)),
        );
        await loginAs(page, "administrator");
        await page.goto("/admin/wholesale/orders");
        await expectWorkspaceShell(page);
        await expectNotForbiddenPage(page);
        await withFeePageRoute(
          page,
          "**/rest/v1/rpc/{create_wholesale_order,add_wholesale_order_settlement}",
          async (route) => {
            if (
              new URL(route.request().url()).pathname.endsWith(
                "/create_wholesale_order",
              )
            ) {
              await forwardFeeWrite(route, order, (value) =>
                registerFeeOrderRequest(order, value),
              );
            } else {
              if (!active) throw Error("direct_settlement_not_started");
              await forwardFeeWrite(route, order, active.register);
            }
          },
          async () => {
            await page.getByRole("button", { name: "新建订单" }).click();
            const createDialog = page.getByRole("dialog", {
              name: "新建批发订单",
            });
            await fillSplitOrderForm(
              createDialog,
              customer.id,
              order.note,
              settlementDate.slice(0, 7),
            );
            await createDialog
              .getByRole("button", { name: "保存订单" })
              .click();
            await expect(page.getByText("批发订单已保存。")).toBeVisible();
            const saved = confirmFeeOrder(order);
            await page.reload();
            await page.getByLabel("搜索订单").fill(order.note);
            await page.getByRole("button", { name: "查看全部字段" }).click();
            const orderRows = page.locator(
              '[data-testid^="wholesale-order-row-"]',
            );
            await expect(orderRows).toHaveCount(1);
            const orderRow = page.getByTestId(
              `wholesale-order-row-${saved.id}`,
            );
            await expect(orderRow).toBeVisible();
            await expect(orderRow).toContainText("未结汇");
            confirmFeeOrder(order);
            active = beginDirectUsdSettlement(
              order,
              quote,
              100,
              settlementDate,
            );
            await recordSettlement(
              page,
              orderRow,
              "100",
              settlementDate,
              expectedCompanyRate,
              saved.id,
            );
            await expect(page.getByText("结汇记录已保存。")).toBeVisible();
            active.confirm();
            await expect(orderRow).toContainText("已结 US$100.00");
            await expect(orderRow).toContainText("剩余 US$200.00");
            // 报价预览是逐笔成交价，订单列是按已入账人民币分计算的加权价，先独立校验再与页面比。
            await expect(orderRow).toContainText(
              String(order.proof!.order!.settlement_exchange_rate),
            );
            active = beginDirectUsdSettlement(
              order,
              quote,
              200,
              settlementDate,
            );
            await recordSettlement(
              page,
              orderRow,
              "200",
              settlementDate,
              expectedCompanyRate,
              saved.id,
            );
            await expect(page.getByText("结汇记录已保存。")).toBeVisible();
            active.confirm();
            await expect(orderRow).toContainText("已结 US$300.00");
            await expect(orderRow).toContainText("剩余 US$0.00");
            // 每次保存从页面连续触发两次，最终仍只有两个独立请求编号/明细；刷新后核对同一终态。
            expect(order.proof!.settlements).toHaveLength(2);
            expect(
              new Set(
                order.proof!.settlements.map(
                  (row) => row.settlement_request_id,
                ),
              ).size,
            ).toBe(2);
            await page.reload();
            await page.getByLabel("搜索订单").fill(order.note);
            await expect(orderRow).toContainText("已结 US$300.00");
            confirmFeeOrder(order);
          },
        );
      },
      () => page.unrouteAll({ behavior: "wait" }),
      () => page.close(),
      async () => {
        cleanupFeeOrder(order);
      },
      async () => {
        cleanupFeeCustomer(customer);
      },
      async () => {
        cleanupQuoteFixture(quote);
      },
    );
  });

  test("wholesale order settlement page keeps desktop and mobile layout usable", async ({
    page,
  }) => {
    const orderNumber = readFirstSeedOrderNumber();
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
    await expect(page.getByRole("heading", { name: "批发订单" })).toBeVisible();
    await expectLocalSeededWholesaleOrders(page);
    await expectCompactSettlementOrderControls(page);
    await expectNoSettlementStatusInOrderNumberCell(page);
    await expectCompactLocalSeededOrderRows(page);
    await page.getByLabel("搜索订单").fill(orderNumber);
    await page.getByRole("button", { name: "跨日期查此单号" }).click();
    await expect(
      page
        .locator('[data-testid^="wholesale-order-row-"]')
        .filter({ hasText: orderNumber }),
    ).toBeVisible();
    await page.getByRole("button", { name: "查看全部字段" }).click();
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

/** 保留原1单、采购10、运费1、300USD/Wise/DHL样本；客户和业务员按稳定编号选择。 */
async function fillSplitOrderForm(
  dialog: ReturnType<Page["getByRole"]>,
  customerId: string,
  note: string,
  month: string,
) {
  await chooseSelectOption(dialog.getByLabel("客户名"), { value: customerId });
  await chooseSelectOption(dialog.getByLabel("关联业务员"), {
    value: "55555555-5555-4555-8555-555555555555",
  });
  await dialog.getByLabel("小单数量").fill("1");
  await dialog.getByLabel("产品采购金额").fill("10");
  await dialog.getByLabel("国际运费").fill("1");
  await dialog.getByLabel("其他费用").fill("0");
  await dialog.getByLabel("推荐佣金费用").fill("0");
  await dialog.getByLabel("快递公司").fill("DHL");
  await chooseSelectOption(dialog.getByLabel("客户支付币种"), { value: "USD" });
  await dialog.getByLabel("客户支付金额").fill("300");
  await chooseSelectOption(dialog.getByLabel("收款平台"), { label: "Wise" });
  await fillDateControl(dialog.getByLabel("订单计入月份"), month);
  await dialog.getByLabel("备注").fill(note);
}

async function recordSettlement(
  page: Page,
  orderRow: ReturnType<Page["getByRole"]>,
  amount: string,
  settlementDate: string,
  expectedCompanyRate: string,
  orderId: string,
) {
  await orderRow.getByRole("button", { name: "登记结汇" }).click();

  const settlementDialog = page.getByRole("dialog", { name: "确认结汇" });
  await expect(settlementDialog).toBeVisible();
  await settlementDialog.getByLabel("本次结汇金额").fill(amount);
  await fillDateControl(
    settlementDialog.getByLabel("结汇日期"),
    settlementDate,
  );
  await expect(
    settlementDialog.getByText(expectedCompanyRate, { exact: true }).first(),
  ).toBeVisible();
  // 上一笔成功提示可能仍在；必须等本笔响应完成，随后再由独立数据库凭证判定成功。
  await Promise.all([
    page
      .waitForResponse((response) => {
        const request = response.request();
        if (
          request.method() !== "POST" ||
          new URL(response.url()).pathname !==
            "/rest/v1/rpc/add_wholesale_order_settlement"
        )
          return false;
        const input = request.postDataJSON();
        return (
          input.p_order_id === orderId &&
          input.p_settlement_amount === Number(amount) &&
          input.p_settlement_date === settlementDate
        );
      })
      .then((response) => expect(response.ok()).toBe(true)),
    settlementDialog
      .getByRole("button", { name: "保存结汇记录" })
      .evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
      }),
  ]);
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

async function expectLocalSeededWholesaleOrders(page: Page) {
  await expect(
    page.locator('[data-testid^="wholesale-order-row-"]'),
  ).toHaveCount(20);
  // 真实写入回归会产生更新的订单；明确筛选种子，不能假定它仍在最新一页。
  await page.getByLabel("搜索订单").fill("WH-LOCAL-");
  await expect(
    page
      .locator('[data-testid^="wholesale-order-row-"]')
      .filter({ hasText: "WH-LOCAL-" }),
  ).not.toHaveCount(0);
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflowPixels).toBeLessThanOrEqual(2);
}
