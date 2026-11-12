import {
  createFeeOrderPage,
  showFeeOrder as showOrder,
  settleFeeOrderPage as settle,
  editFeeCostPage,
  collectFeePageErrors as collectPageErrors,
  type FeeCustomerChoice,
  type FeePageRole,
} from "./helpers/wholesale-fee-order-page";
import {
  cleanupFeeOrder,
  confirmFeeOrder,
  type FeeOrderFixture,
} from "./helpers/wholesale-fee-order-fixture";
import { withFeeCommissionFault } from "./helpers/wholesale-fee-commission-fault";
import { verifyFeeParameterPage } from "./helpers/wholesale-fee-parameter-page";
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readDisposablePostgresTarget } from "../test-support/disposable-fixture";
import { cleanupFixtureResources } from "../test-support/fixture-cleanup-sequence";
import {
  captureFeeParameterFixture,
  restoreFeeParameterFixture,
  type FeeParameterFixture,
} from "./helpers/wholesale-fee-parameter-fixture";
import {
  createFeeCustomerFixture,
  createFeeHistoricalCustomerFixture,
  prepareFeeCustomer,
  cleanupFeeCustomer,
} from "./helpers/wholesale-fee-customer-fixture";
import { loginAs, expectForbiddenPage } from "./helpers/auth";

import {
  runWholesaleFeeSql,
  feeSqlValue,
  readFeeCustomer,
  readWholesaleFeeOrder as readOrder,
  readWholesaleFeeCommission as readCommission,
} from "./helpers/wholesale-fee-database";

// 单次交互限时，错误字段立即给出定位信息，避免把定位失败误认为服务迟缓。
test.use({ actionTimeout: 15_000, video: "off" });

const prefix = `fees-e2e-${randomUUID()}`;
const customerFixture = createFeeCustomerFixture(prefix);
const historicalCustomerFixture = createFeeHistoricalCustomerFixture(prefix);
const newCustomer: FeeCustomerChoice = {
  id: customerFixture.id,
  name: customerFixture.name,
  cohort: "new",
};
const existingCustomer: FeeCustomerChoice = {
  id: historicalCustomerFixture.id,
  name: historicalCustomerFixture.name,
  cohort: "existing",
};
let clientCustomer: FeeCustomerChoice;
const orderFixtures: FeeOrderFixture[] = [];
let parameterFixture: FeeParameterFixture | null = null;

// 只创建和清理本文件自己的客户/订单，不重置共享种子或现有参数版本。
test.beforeAll(async ({ baseURL }) => {
  readDisposablePostgresTarget(
    {
      baseURL,
      supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      mode: process.env.PT5_E2E_FIXTURE_MODE,
      project: process.env.PT5_E2E_DATABASE_PROJECT,
      container: process.env.PT5_E2E_DATABASE_CONTAINER,
    },
    (args) =>
      execFileSync("docker", args, {
        encoding: "utf8",
        timeout: 12000,
        windowsHide: true,
      }).trim(),
  );
  const data = prepareFeeCustomer(customerFixture);
  expect(data.salesman_commission_cohort).toBe("new");
  expect(
    prepareFeeCustomer(historicalCustomerFixture).salesman_commission_cohort,
  ).toBe("existing");
  const client = readFeeCustomer("c1000000-0000-4000-8000-000000000002");
  if (!client) throw Error("fee_client_customer_missing");
  expect(client.registered_user_id).toBe(
    "77777777-7777-4777-8777-777777777777",
  );
  expect(["new", "existing"]).toContain(client.salesman_commission_cohort);
  expect(typeof client.unique_name).toBe("string");
  clientCustomer = {
    id: String(client.id),
    name: String(client.unique_name),
    cohort: client.salesman_commission_cohort as "new" | "existing",
  };
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  // 浏览器离开未保存草稿的提醒由测试明确处理，避免关闭页面时挂起。
  page.on("dialog", (dialog) => void dialog.accept());
});

test.afterEach(async ({ page }) => {
  await cleanupFixtureResources(
    () => page.unrouteAll({ behavior: "wait" }),
    () => page.close(),
  );
});

test.afterAll(async () => {
  // 每份订单独立逆序核对，再处理两位自有客户和参数；任何失败均保留并继续后续资源。
  await cleanupFixtureResources(
    ...orderFixtures
      .slice()
      .reverse()
      .map((state) => async () => cleanupFeeOrder(state)),
    async () => cleanupFeeCustomer(historicalCustomerFixture),
    async () => cleanupFeeCustomer(customerFixture),
    async () => {
      if (parameterFixture) restoreFeeParameterFixture(parameterFixture);
    },
  );
});

test("新客户从页面创建、分次收款、改成本，数据库提成和刷新一致", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = collectPageErrors(page);
  await loginAs(page, "administrator");
  const order = await createOrder(page, newCustomer, "new");
  expect(order.service_fee).toBe(500);
  expect(order.cn_tax_fee).toBe(300);
  expect(order.payment_processing_fee).toBe(108);
  expect(order.customer_payment_amount).toBe(12300);
  expect(order.commission_basis).toBe("service_fee");
  expect((await readCommission(order.id)).commission_amount_rmb).toBe(0);
  await settle(page, order, "3000");
  expect((await readOrder(order.id)).status).toBe("partial_settled");
  expect((await readCommission(order.id)).commission_amount_rmb).toBe(0);
  await settle(page, order, "9300");
  let stored = await readOrder(order.id);
  expect(stored.gross_profit).toBe(2000);
  expect((await readCommission(order.id)).commission_amount_rmb).toBe(50);
  // 红/绿核对：只篡改本次夹具的权威金额，错误结果必须被独立断言识别，然后恢复。
  await withFeeCommissionFault(order.fixture, (wrong) => {
    expect(() => expect(wrong.commission_amount_rmb).toBe(50)).toThrow();
  });
  await editFeeCostPage(page, order);
  stored = await readOrder(order.id);
  expect(stored.gross_profit).toBe(-500);
  expect(stored.customer_payment_amount).toBe(12300);
  expect((await readCommission(order.id)).commission_amount_rmb).toBe(62.5);
  await page.reload();
  await showOrder(page, order.order_number);
  await expect(
    page.getByTestId(`wholesale-order-row-${order.id}`),
  ).toContainText("625.00");
  await expect(page.getByText("单位毛利", { exact: true })).toHaveCount(0);
  await page.goto("/admin/wholesale/commission");
  const commissionRow = page
    .getByRole("row")
    .filter({ hasText: order.order_number });
  await expect(commissionRow).toContainText("服务费提成基数");
  await expect(commissionRow).toContainText("62.50");
  await page.reload();
  await expect(commissionRow).toContainText("62.50");
  expect(errors).toEqual([]);
});

test("业务员新建老客户订单按毛利12%，无订单金额分档", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAs(page, "salesman");
  const order = await createOrder(
    page,
    existingCustomer,
    "existing",
    "salesman",
  );
  expect(order.commission_rate).toBe(0.12);
  expect(order.commission_basis).toBe("gross_profit");
  await settle(page, order, "12300", "salesman");
  expect((await readOrder(order.id)).gross_profit).toBe(2000);
  expect((await readCommission(order.id)).commission_amount_rmb).toBe(240);
  await page.reload();
  await showOrder(page, order.order_number, "salesman");
  await expect(
    page.getByTestId(`wholesale-order-row-${order.id}`),
  ).toContainText("2,000.00");
});

test("375px表单预览及手机订单详情不溢出，财务能保存订单", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 375, height: 812 });
  const errors = collectPageErrors(page);
  await loginAs(page, "finance");
  const order = await createOrder(page, newCustomer, "mobile", "finance");
  await page.reload();
  await page
    .getByRole("button")
    .filter({ hasText: order.order_number })
    .click();
  const details = page.getByRole("dialog", {
    name: `订单 ${order.order_number}`,
  });
  await expect(details.getByText("服务费", { exact: true })).toBeVisible();
  await expect(details.getByText("CN税费", { exact: true })).toBeVisible();
  await expect(details.getByText("付款手续费", { exact: true })).toBeVisible();
  await expect(details.getByText("单位毛利", { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await details.getByText("服务费", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: test.info().outputPath("wholesale-fees-mobile.png"),
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page
    .getByRole("button")
    .filter({ hasText: order.order_number })
    .click();
  await expect(details.getByText("服务费", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  confirmFeeOrder(order.fixture);
  expect(errors).toEqual([]);
});

test("客户页面及原始响应均不包含内部费用，不能创建订单", async ({ page }) => {
  test.setTimeout(180_000);
  // 为只读客户场景从管理员页面建立专属可见订单，避免依赖共享种子恰好存在订单。
  await loginAs(page, "administrator");
  const visibleOrder = await createOrder(page, clientCustomer, "client-view");
  await page.context().clearCookies();
  await loginAs(page, "client");
  await page.goto("/client/wholesale/orders");
  const response = page.waitForResponse(
    (r) =>
      r.url().includes("rpc/get_wholesale_order_page") &&
      r.request().method() === "POST" &&
      Boolean(r.request().postData()?.includes(visibleOrder.order_number)),
  );
  await page
    .getByLabel("搜索订单", { exact: true })
    .fill(visibleOrder.order_number);
  const payload = await (await response).json();
  expect(payload.orders.length).toBeGreaterThan(0);
  expect(payload.orders).toHaveLength(1);
  expect(payload.orders[0].id).toBe(visibleOrder.id);
  for (const order of payload.orders) {
    for (const key of [
      "commission_calculation_snapshot",
      "service_fee",
      "cn_tax_fee",
      "payment_processing_fee",
      "commission_basis",
      "commission_basis_amount_rmb",
    ])
      expect(order).not.toHaveProperty(key);
  }
  for (const key of [
    "serviceFeeAmount",
    "cnTaxFeeAmount",
    "paymentProcessingFeeAmount",
  ])
    expect(payload.summary).not.toHaveProperty(key);
  await expect(page.getByRole("button", { name: "新建订单" })).toHaveCount(0);
  await expect(page.getByText("服务费", { exact: true })).toHaveCount(0);
  await expect(page.getByText("CN税费", { exact: true })).toHaveCount(0);
  await page.reload();
  await page
    .getByLabel("搜索订单", { exact: true })
    .fill(visibleOrder.order_number);
  await expect(
    page.getByTestId(`wholesale-order-row-${visibleOrder.id}`),
  ).toBeVisible();
  confirmFeeOrder(visibleOrder.fixture);
});

test("目标订单已删除时保存失败，保留草稿且没有成功提示", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAs(page, "administrator");
  const order = await createOrder(page, newCustomer, "zero-row");
  await showOrder(page, order.order_number);
  await page.getByTestId(`wholesale-order-edit-${order.id}`).click();
  const dialog = page.getByRole("dialog", { name: "修改批发订单" });
  expect(cleanupFeeOrder(order.fixture).deleted).toBe(1);
  await dialog.getByLabel(/^产品采购金额/).fill("9000");
  await dialog.getByRole("button", { name: "保存修改" }).click();
  await expect(dialog).toBeVisible();
  await expect(page.getByText("批发订单已保存。", { exact: true })).toHaveCount(
    0,
  );
  const count = Number(
    runWholesaleFeeSql(
      `select count(*) from public.wholesale_orders where id=${feeSqlValue(order.id)};`,
    ),
  );
  expect(count).toBe(0);
});

test("管理员从页面发布两个客户比例并核对版本，业务员没有修改入口", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loginAs(page, "administrator");
  parameterFixture = captureFeeParameterFixture(prefix + "-参数发布");
  await verifyFeeParameterPage(page, parameterFixture, prefix, (name) =>
    test.info().outputPath(name),
  );
  await page.context().clearCookies();
  await loginAs(page, "salesman");
  await page.goto("/salesman/wholesale/settings");
  await expectForbiddenPage(page);
});

async function createOrder(
  page: Page,
  customer: FeeCustomerChoice,
  kind: string,
  role: FeePageRole = "admin",
) {
  return createFeeOrderPage(page, {
    prefix,
    customer,
    kind,
    role,
    orders: orderFixtures,
    outputPath: (name) => test.info().outputPath(name),
  });
}
