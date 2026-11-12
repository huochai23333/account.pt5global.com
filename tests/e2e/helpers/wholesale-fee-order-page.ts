import { expect, type Page } from "@playwright/test";
import { chooseSelectOption } from "./select-control";
import { fillDateControl } from "./date-control";
import { runWholesaleFeeSql, feeSqlValue } from "./wholesale-fee-database";
import {
  createFeeOrderFixture,
  confirmFeeOrder,
  registerFeeOrderRequest,
  type FeeOrderFixture,
  type FeeSavedOrder,
} from "./wholesale-fee-order-fixture";
import {
  beginFeeSettlement,
  beginFeeCostEdit,
} from "./wholesale-fee-order-transitions";
import { withFeePageRoute, forwardFeeWrite } from "./wholesale-fee-page-route";

export type FeeCustomerChoice = {
  id: string;
  name: string;
  cohort: "new" | "existing";
};
export type FeePageOrder = FeeSavedOrder & { fixture: FeeOrderFixture };
export type FeePageRole = "admin" | "salesman" | "finance";
const actors = {
  admin: "11111111-1111-4111-8111-111111111111",
  salesman: "55555555-5555-4555-8555-555555555555",
  finance: "66666666-6666-4666-8666-666666666666",
};

export function collectFeePageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}
/** 先登记唯一清单，正常页面请求原样转发；成功后和刷新后都独立核对同一完整订单图。 */
export async function createFeeOrderPage(
  page: Page,
  options: {
    prefix: string;
    customer: FeeCustomerChoice;
    kind: string;
    role: FeePageRole;
    orders: FeeOrderFixture[];
    outputPath: (name: string) => string;
  },
): Promise<FeePageOrder> {
  const { prefix, customer, kind, role, orders, outputPath } = options;
  const state = createFeeOrderFixture(
    prefix,
    kind,
    customer.id,
    actors[role],
    customer.cohort,
  );
  orders.push(state);
  await page.goto(`/${role}/wholesale/orders`);
  await page.getByRole("button", { name: "新建订单" }).click();
  const dialog = page.getByRole("dialog", { name: "新建批发订单" });
  if (kind === "new") {
    await dialog.getByRole("button", { name: "保存订单" }).click();
    await expect(dialog).toBeVisible();
    expect(
      Number(
        runWholesaleFeeSql(
          `select count(*) from public.wholesale_orders where customer_id=${feeSqlValue(customer.id)};`,
        ),
      ),
    ).toBe(0);
  }
  await chooseSelectOption(dialog.getByLabel("客户名", { exact: true }), {
    value: customer.id,
  });
  await chooseSelectOption(dialog.getByLabel("关联业务员"), {
    value: actors.salesman,
  });
  await dialog.getByLabel("小单数量").fill("100");
  await dialog.getByLabel(/^产品采购金额/).fill("8500");
  await dialog.getByLabel(/^国际运费/).fill("1200");
  await expect(dialog.getByTestId("order-fee-serviceFee")).toHaveValue(
    "500.00",
  );
  await expect(dialog.getByTestId("order-fee-cnTaxFee")).toHaveValue("300.00");
  await expect(
    dialog.getByTestId("order-fee-paymentProcessingFee"),
  ).toHaveValue("108.00");
  await expect(dialog.getByTestId("order-fee-serviceFee")).toHaveAttribute(
    "readonly",
    "",
  );
  await dialog.getByLabel("其他费用（人民币）", { exact: true }).fill("200");
  await dialog.getByLabel("推荐佣金费用").fill("100");
  await chooseSelectOption(dialog.getByLabel("客户支付币种"), { value: "CNY" });
  await dialog.getByLabel(/^客户支付金额/).fill("12300");
  await fillDateControl(
    dialog.getByLabel("订单计入月份"),
    state.month.slice(0, 7),
  );
  await dialog.getByLabel("备注", { exact: true }).fill(state.note);
  if (role === "finance") {
    await dialog.getByTestId("order-fee-serviceFee").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: outputPath("wholesale-fees-mobile-form.png"),
      fullPage: false,
    });
  }
  if (kind === "new") {
    await dialog.getByLabel("客户名", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: outputPath("wholesale-fees-desktop-form.png"),
      fullPage: false,
    });
  }
  return withFeePageRoute(
    page,
    "**/rest/v1/rpc/create_wholesale_order",
    (route) =>
      forwardFeeWrite(route, state, (value) =>
        registerFeeOrderRequest(state, value),
      ),
    async () => {
      await dialog.getByRole("button", { name: "保存订单" }).click();
      await expect(dialog).not.toBeVisible();
      const data = confirmFeeOrder(state);
      await page.reload();
      confirmFeeOrder(state);
      return { ...data, fixture: state };
    },
  );
}
export async function showFeeOrder(
  page: Page,
  number: string,
  role: FeePageRole = "admin",
) {
  await page.goto(`/${role}/wholesale/orders`);
  await page.getByLabel("搜索订单", { exact: true }).fill(number);
  const expand = page.getByRole("button", { name: "查看全部字段" });
  if (await expand.isVisible()) await expand.click();
  await expect(
    page.getByTestId(/^wholesale-order-row-/).filter({ hasText: number }),
  ).toBeVisible();
}
export async function settleFeeOrderPage(
  page: Page,
  order: FeePageOrder,
  amount: string,
  role: FeePageRole = "admin",
) {
  await showFeeOrder(page, order.order_number, role);
  await page.getByTestId(`wholesale-order-settle-${order.id}`).click();
  const dialog = page.getByRole("dialog", { name: "确认结汇" });
  await dialog.getByLabel("本次结汇金额").fill(amount);
  const operation = beginFeeSettlement(order.fixture, Number(amount));
  await withFeePageRoute(
    page,
    "**/rest/v1/rpc/add_wholesale_order_settlement",
    (route) => forwardFeeWrite(route, order.fixture, operation.register),
    async () => {
      await dialog.getByRole("button", { name: "保存结汇记录" }).click();
      await expect(dialog).not.toBeVisible();
      operation.confirm();
      await page.reload();
      confirmFeeOrder(order.fixture);
    },
  );
}
export async function editFeeCostPage(page: Page, order: FeePageOrder) {
  await showFeeOrder(page, order.order_number);
  await page.getByTestId(`wholesale-order-edit-${order.id}`).click();
  const dialog = page.getByRole("dialog", { name: "修改批发订单" });
  await dialog.getByLabel(/^产品采购金额/).fill("11000");
  await expect(dialog.getByTestId("order-fee-serviceFee")).toHaveValue(
    "625.00",
  );
  const operation = beginFeeCostEdit(order.fixture);
  await withFeePageRoute(
    page,
    "**/rest/v1/rpc/update_wholesale_order",
    (route) => forwardFeeWrite(route, order.fixture, operation.register),
    async () => {
      await dialog.getByRole("button", { name: "保存修改" }).click();
      await expect(dialog).not.toBeVisible();
      operation.confirm();
    },
  );
}
