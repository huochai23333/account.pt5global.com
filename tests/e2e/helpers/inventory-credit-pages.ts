import { expect, type Page } from "@playwright/test";
import { chooseSelectOption } from "./select-control";
import { expectNotForbiddenPage, loginAs } from "./auth";
import type { InventoryOrderFixture } from "../../test-support/inventory-order-fixture";
import {
  changeInventoryOrder,
  inventoryCreditCard,
  inventoryOrderRow,
  orderNumber,
} from "./inventory-order-page-receipts";

export async function applyForCreditAsClient(
  page: Page,
  fixture: InventoryOrderFixture,
) {
  await loginAs(page, "client");
  await page.goto("/client/wholesale/inventory-orders");
  await expectNotForbiddenPage(page);

  await expect(page.getByRole("button", { name: "创建库存订单" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "全额实付" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "作废" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "修改" })).toHaveCount(0);
  await expect(
    page.getByPlaceholder("订单编号、客户、业务员、币种或备注"),
  ).toHaveCount(0);
  await expect(
    page.getByPlaceholder("订单编号、客户、商品、1688链接、币种或备注"),
  ).toBeVisible();
  const orderFilters = page.getByTestId("customer-inventory-order-filters");
  await expect(orderFilters.getByLabel("客户")).toHaveCount(0);
  await expect(orderFilters.getByLabel("业务员")).toHaveCount(0);

  const number = orderNumber(fixture, "application");
  const targetRow = inventoryOrderRow(page, number);
  await targetRow.getByRole("button", { name: "申请信贷" }).click();
  const applyDialog = page.getByRole("dialog", { name: "申请订单信贷" });
  await expect(
    applyDialog.getByText("固定200美元", { exact: true }),
  ).toBeVisible();
  await applyDialog.getByLabel("安心周转额度").check();
  await applyDialog.getByLabel("备注或说明").fill("申请固定档位");
  const applied = await changeInventoryOrder(
    applyDialog.getByRole("button", { name: "提交申请" }),
    fixture,
    "application",
    "credit_applied",
    "submit_customer_inventory_credit_applications",
  );
  expect(applied.credits).toHaveLength(1);
  expect(applied.credits[0]).toMatchObject({
    tier: "fixed_200_usd",
    status: "pending",
  });

  await expect(applyDialog).toHaveCount(0);
  await expect(page.getByText("信贷申请已提交。")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "信贷管理" }).click();
  await expect(inventoryCreditCard(page, number)).toContainText("待审核");
}

export async function approveCreditAsFinance(
  page: Page,
  fixture: InventoryOrderFixture,
) {
  await loginAs(page, "finance");
  await page.goto("/finance/wholesale/inventory-orders");
  await expectNotForbiddenPage(page);
  await expect(
    page.getByRole("button", { name: "创建库存订单" }),
  ).toBeVisible();
  // 财务现在同时拥有库存订单写权限，页面默认先展示订单；
  // 审核动作位于“信贷管理”标签，先显式切换再验证待审核申请。
  await page.getByRole("button", { name: /信贷管理/ }).click();
  const number = orderNumber(fixture, "application");
  const reviewCard = page
    .getByRole("article")
    .filter({ hasText: `订单 ${number} 有` });
  await reviewCard.getByRole("button", { name: "统一审核" }).click();
  const reviewDialog = page.getByRole("dialog", {
    name: "统一审核订单信贷",
  });
  await chooseSelectOption(reviewDialog.getByLabel("审核结果"), {
    label: "批准",
  });
  await expect(reviewDialog.getByLabel("批准金额（美元）")).toBeDisabled();
  await expect(reviewDialog.getByLabel("订单剩余实付金额")).toHaveValue("150");
  const before = fixture.graph("application");
  const approved = await changeInventoryOrder(
    reviewDialog.getByRole("button", { name: "确认审核" }),
    fixture,
    "application",
    "credit_batch_reviewed",
    "review_customer_inventory_credit_batch",
  );
  expect(approved.orders[0]).toMatchObject({
    actual_payment_amount: 150,
    credit_offset_amount: 200,
    payment_status: "paid",
    remaining_amount: 0,
    revision: Number(before.orders[0].revision) + 1,
  });
  expect(approved.credits).toHaveLength(1);
  expect(approved.credits[0]).toMatchObject({
    id: before.credits[0].id,
    status: "active",
    approved_amount_usd: 200,
  });

  await expect(reviewDialog).toHaveCount(0);
  await expect(page.getByText("订单信贷已审核。")).toBeVisible();
  await expect(inventoryCreditCard(page, number)).toContainText("使用中");
  await page.reload();
  await page.getByRole("button", { name: /信贷管理/ }).click();
  await expect(inventoryCreditCard(page, number)).toContainText("使用中");
  await page.getByRole("button", { name: /^库存订单/ }).click();
  const row = inventoryOrderRow(page, number);
  await expect(row.getByRole("button", { name: "维护备注" })).toBeVisible();
  await expect(row.getByRole("button", { name: /维护商品/ })).toBeVisible();
  await expect(row).toContainText("350.00");
}

export async function requestExtensionAsClient(
  page: Page,
  fixture: InventoryOrderFixture,
) {
  await loginAs(page, "client");
  await page.goto("/client/wholesale/inventory-orders");
  await page.getByRole("button", { name: "信贷管理" }).click();
  const number = orderNumber(fixture, "application");
  const creditCard = inventoryCreditCard(page, number);
  await creditCard.getByRole("button", { name: "申请延期" }).click();

  const extensionDialog = page.getByRole("dialog", { name: "申请延期" });
  await chooseSelectOption(extensionDialog.getByLabel("延期时长"), {
    label: "2 个月",
  });
  const requested = await changeInventoryOrder(
    extensionDialog.getByRole("button", { name: "提交延期申请" }),
    fixture,
    "application",
    "extension_requested",
    "submit_customer_inventory_credit_extension",
    "credit",
  );
  expect(requested.extensions).toHaveLength(1);
  expect(requested.extensions[0]).toMatchObject({
    status: "pending",
    extension_months: 2,
    credit_application_id: requested.credits[0].id,
  });
  await expect(extensionDialog).toHaveCount(0);
  await expect(page.getByText("延期申请已提交。")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "信贷管理" }).click();
  await expect(creditCard).toContainText("延期审核中");
}

export async function reviewExtensionAndRepayAsFinance(
  page: Page,
  fixture: InventoryOrderFixture,
) {
  await loginAs(page, "finance");
  await page.goto("/finance/wholesale/inventory-orders");
  await page.getByRole("button", { name: /信贷管理/ }).click();
  // 延期审核卡只显示档位和月数。专属起点允许唯一待审延期，提交时再核对真实申请 ID。
  const extensionReview = page.getByRole("button", {
    name: "审核延期",
    exact: true,
  });
  await expect(extensionReview).toHaveCount(1);
  await extensionReview.click();

  const reviewExtensionDialog = page.getByRole("dialog", {
    name: "审核延期申请",
  });
  await expect(reviewExtensionDialog.getByLabel("审核结果")).toContainText(
    "批准",
  );
  const request = fixture.graph("application").extensions[0];
  const extended = await changeInventoryOrder(
    reviewExtensionDialog.getByRole("button", { name: "确认审核" }),
    fixture,
    "application",
    "extension_reviewed",
    "review_customer_inventory_credit_extension",
    "extension",
  );
  expect(extended.extensions).toHaveLength(1);
  expect(extended.extensions[0]).toMatchObject({
    id: request.id,
    status: "approved",
  });
  expect(typeof extended.credits[0].extended_due_on).toBe("string");
  await expect(page.getByText("延期申请已审核。")).toBeVisible();

  const number = orderNumber(fixture, "application");
  const repaidCredit = inventoryCreditCard(page, number);
  await repaidCredit.getByRole("button", { name: "登记一次还清" }).click();
  const repaymentDialog = page.getByRole("dialog", {
    name: "登记一次还清",
  });
  await expect(repaymentDialog.getByLabel("实际还款日期")).not.toHaveValue("");
  const repaid = await changeInventoryOrder(
    repaymentDialog.getByRole("button", { name: "确认还清" }),
    fixture,
    "application",
    "credit_repaid",
    "record_customer_inventory_credit_repayment",
    "credit",
  );
  expect(repaid.credits).toHaveLength(1);
  expect(repaid.credits[0]).toMatchObject({
    status: "repaid",
    id: extended.credits[0].id,
  });
  expect(repaid.repayments).toHaveLength(1);
  expect(repaid.repayments[0]).toMatchObject({
    credit_application_id: repaid.credits[0].id,
    principal_amount_usd: 200,
  });

  await expect(repaymentDialog).toHaveCount(0);
  await expect(page.getByText("信贷已一次还清。")).toBeVisible();
  await expect(repaidCredit).toContainText("已还清");
  await page.reload();
  await page.getByRole("button", { name: /信贷管理/ }).click();
  await expect(repaidCredit).toContainText("已还清");

  // 信贷筛选同时覆盖档位、状态和无结果后的恢复入口。
  await chooseSelectOption(page.getByLabel("信贷状态"), {
    label: "已还清",
  });
  await expect(page.getByText("共 1 条，当前显示 1 条")).toBeVisible();
  await chooseSelectOption(page.getByLabel("信贷档位"), {
    label: "订单助力额度",
  });
  await expect(page.getByText("没有符合筛选条件的记录")).toBeVisible();
  await page.getByRole("button", { name: "清空筛选" }).click();
  await expect(repaidCredit).toContainText("已还清");
  await expect(repaidCredit).toContainText("固定200美元");
}
