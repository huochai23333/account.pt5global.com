import { expect, test, type Page } from "@playwright/test";

import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import { fillDateControl } from "./helpers/date-control";
import {
  chooseSelectOption,
  expectSelectValue,
  getSelectOptionValueAt,
  getSelectValue,
} from "./helpers/select-control";

const FORCED_ERROR_MESSAGE = "操作没有成功，请检查内容和权限后再试。";
const FIRST_ORDER_ID = "c2000000-0000-4000-8000-000000000001";

test.describe("批发写入失败保留表单", () => {
  test("订单创建、修改、结汇和附件失败时保留输入", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    await failJsonRequest(page, "**/rest/v1/rpc/create_wholesale_order");
    await page.getByRole("button", { name: "新建订单" }).click();
    const createDialog = page.getByRole("dialog", { name: "新建批发订单" });
    const createNote = "失败后仍要保留的订单备注";
    await fillOrderCreateForm(createDialog, createNote);
    await createDialog.getByRole("button", { name: "保存订单" }).click();
    await expectFailureNotice(page);
    await expect(createDialog).toBeVisible();
    await expect(createDialog.getByLabel("备注")).toHaveValue(createNote);
    await expectResponsiveLayout(page);
    await page.keyboard.press("Escape");
    await page.getByText("这笔订单还没有保存，确定要放弃当前填写的内容吗？").first().waitFor();
    await page.getByRole("button", { name: "暂不操作" }).click();
    await expect(createDialog.getByLabel("备注")).toHaveValue(createNote);
    await page.keyboard.press("Escape");
    await page.getByText("这笔订单还没有保存，确定要放弃当前填写的内容吗？").first().waitFor();
    await page.getByRole("button", { name: "确认操作" }).click();

    await failJsonRequest(page, "**/rest/v1/rpc/update_wholesale_order");
    await page
      .getByLabel("搜索订单")
      .fill(`WH-LOCAL-${currentShanghaiMonth().replace("-", "")}-001`);
    // 固定夹具可能位于当前月份较早日期，精确找单应走产品已有的全历史入口。
    await page.getByRole("button", { name: "跨日期查此单号" }).click();
    const orderRow = page.getByTestId(`wholesale-order-row-${FIRST_ORDER_ID}`);
    await expect(orderRow).toBeVisible();
    await orderRow.getByRole("button", { name: "修改订单" }).click();
    const editDialog = page.getByRole("dialog", { name: "修改批发订单" });
    const editNote = "失败后仍要保留的修改备注";
    await editDialog.getByLabel("备注").fill(editNote);
    await editDialog.getByRole("button", { name: "保存修改" }).click();
    await expectFailureNotice(page);
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByLabel("备注")).toHaveValue(editNote);
    await page.keyboard.press("Escape");
    await page.getByText("还有没保存的修改。确定放弃并关闭吗？").first().waitFor();
    await page.getByRole("button", { name: "暂不操作" }).click();
    await expect(editDialog.getByLabel("备注")).toHaveValue(editNote);
    await page.keyboard.press("Escape");
    await page.getByText("还有没保存的修改。确定放弃并关闭吗？").first().waitFor();
    await page.getByRole("button", { name: "确认操作" }).click();

    await failJsonRequest(
      page,
      "**/rest/v1/rpc/add_wholesale_order_settlement",
    );
    await orderRow.getByRole("button", { name: "登记结汇" }).click();
    const settlementDialog = page.getByRole("dialog", { name: "确认结汇" });
    await settlementDialog.getByLabel("本次结汇金额").fill("12.34");
    await settlementDialog.getByRole("button", { name: "保存结汇记录" }).click();
    await expectFailureNotice(page);
    await expect(settlementDialog).toBeVisible();
    await expect(settlementDialog.getByLabel("本次结汇金额")).toHaveValue(
      "12.34",
    );
    await page.keyboard.press("Escape");

    await failJsonRequest(
      page,
      "**/storage/v1/object/wholesale-order-lists/**",
      "POST",
    );
    await orderRow.getByRole("button", { name: "查看详情" }).click();
    await page.getByRole("dialog", { name: /订单 WH-/ }).getByRole("button", { name: "管理附件" }).click();
    const attachmentDialog = page.getByRole("dialog", {
      name: /Order List/,
    });
    await attachmentDialog.locator('input[type="file"]').setInputFiles({
      buffer: Buffer.from("订单编号,商品\nTEST-1,旅行用品"),
      mimeType: "text/csv",
      name: "失败后保留.csv",
    });
    await attachmentDialog.getByRole("button", { name: "上传" }).click();
    await expectFailureNotice(page);
    await expect(attachmentDialog).toBeVisible();
    await expect(attachmentDialog.getByText(/已选择 1 个表格/)).toBeVisible();
  });

  test("客户别名和账号合并失败时保留当前选择", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/customers");
    await openWholesaleAlpha(page);

    const detailsDialog = page.getByRole("dialog", { name: "Wholesale Alpha" });
    await failJsonRequest(page, "**/rest/v1/wholesale_customers*", "PATCH");
    await detailsDialog.getByRole("button", { name: "新增名称" }).click();
    const aliasInput = detailsDialog.getByLabel("新增其他名称");
    await aliasInput.fill("失败后保留的客户别名");
    await detailsDialog.getByRole("button", { name: "保存名称" }).click();
    await expectFailureNotice(page);
    await expect(detailsDialog).toBeVisible();
    await expect(aliasInput).toHaveValue("失败后保留的客户别名");

    await failJsonRequest(
      page,
      "**/rest/v1/rpc/link_wholesale_customer_registered_user",
    );
    const accountSelect = detailsDialog.getByLabel("选择客户注册账号");
    const accountValue = await firstNonEmptyOptionValue(accountSelect);
    await chooseSelectOption(accountSelect, { value: accountValue });
    await detailsDialog.getByRole("button", { name: "合并账号" }).click();
    await expectFailureNotice(page);
    await expect(detailsDialog).toBeVisible();
    await expectSelectValue(accountSelect, accountValue);
    await expectResponsiveLayout(page);
  });

  test("1688 导入和归属失败时保留文件及选择", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/order-claims");

    await failJsonRequest(
      page,
      "**/rest/v1/wholesale_1688_import_batches*",
      "POST",
    );
    await page.getByRole("button", { name: "上传 1688 文件" }).click();
    const uploadDialog = page.getByRole("dialog", { name: "上传 1688 订单" });
    await uploadDialog.locator('input[type="file"]').setInputFiles({
      buffer: Buffer.from(
        "订单编号,卖家公司名,收货人姓名\n1688-FAIL-001,测试店铺,Wholesale Alpha",
      ),
      mimeType: "text/csv",
      name: "失败后保留的1688订单.csv",
    });
    await expect(uploadDialog.getByText(/已读取 1 条采购订单/)).toBeVisible();
    await uploadDialog.getByRole("button", { name: "接收采购订单" }).click();
    await expectFailureNotice(page);
    await expect(uploadDialog).toBeVisible();
    await expect(uploadDialog.getByText("失败后保留的1688订单.csv")).toBeVisible();
    await page.keyboard.press("Escape");

    await failJsonRequest(
      page,
      "**/rest/v1/rpc/create_wholesale_1688_claim_group",
    );
    const assistedRow = page.getByRole("row").filter({
      hasText: "1688-LOCAL-003",
    });
    await assistedRow.getByRole("button", { name: "认领" }).click();
    const claimDialog = page.getByRole("dialog", { name: "认领采购订单" });
    const customerSelect = claimDialog.getByLabel("客户");
    // 种子里的辅助匹配客户订单已结汇，主动切换到仍有可认领订单的客户。
    await chooseSelectOption(customerSelect, { label: "Wholesale Alpha" });
    const orderCheckbox = claimDialog.getByRole("checkbox").first();
    await orderCheckbox.check();
    const customerValue = await getSelectValue(customerSelect);
    expect(customerValue).not.toBe("");
    await claimDialog.getByRole("button", { name: "确认认领" }).click();
    await expectFailureNotice(page);
    await expect(claimDialog).toBeVisible();
    await expectSelectValue(customerSelect, customerValue);
    await expect(orderCheckbox).toBeChecked();

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /认领大厅/ }).click();
    await failJsonRequest(
      page,
      "**/rest/v1/rpc/create_wholesale_1688_claim_group",
    );
    const hallCheckbox = page.getByRole("checkbox", {
      name: "选择采购订单 1688-LOCAL-004",
    });
    await hallCheckbox.check();
    await page.getByRole("button", { name: "批量认领" }).click();

    const bulkDialog = page.getByRole("dialog", { name: "认领采购订单" });
    const bulkCustomerSelect = bulkDialog.getByLabel("客户");
    await chooseSelectOption(bulkCustomerSelect, {
      label: "Wholesale Alpha",
    });
    const bulkOrderCheckbox = bulkDialog.getByRole("checkbox").first();
    await bulkOrderCheckbox.check();
    const bulkCustomerValue = await getSelectValue(bulkCustomerSelect);
    await bulkDialog.getByRole("button", { name: "确认认领" }).click();
    await expectFailureNotice(page);
    await expect(bulkDialog).toBeVisible();
    await expectSelectValue(bulkCustomerSelect, bulkCustomerValue);
    await expect(bulkOrderCheckbox).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(hallCheckbox).toBeChecked();
    await expectResponsiveLayout(page);
  });

  test("店铺归属和推荐关系失败时不清空表单", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");

    await page.goto("/admin/wholesale/logistics");
    await failJsonRequest(
      page,
      "**/rest/v1/rpc/change_wholesale_logistics_store_assignment**",
    );
    await page.getByRole("button", { name: "店铺归属设置" }).click();
    const logisticsDialog = page.getByRole("dialog", {
      name: "店铺归属设置",
    });
    await logisticsDialog
      .locator("article")
      .filter({ hasText: "Local Shop Alpha" })
      .getByRole("button", { name: "调整" })
      .click();
    const salesSelect = logisticsDialog.getByLabel("负责业务员");
    const customerSelect = logisticsDialog.getByLabel("批发客户（可选）");
    const currentSalesValue = await getSelectValue(salesSelect);
    // 第 0 项是“请选择业务员”的空值；实际可选的两名业务员从第 1 项开始。
    const firstSalesValue = await getSelectOptionValueAt(salesSelect, 1);
    const secondSalesValue = await getSelectOptionValueAt(salesSelect, 2);
    // 前面的物流回归可能已经调整过当前负责人；始终选择与当前值不同的业务员，
    // 确保“保存归属”一定发出真实请求，路由拦截才能验证失败后保留表单。
    await chooseSelectOption(salesSelect, {
      value:
        firstSalesValue === currentSalesValue
          ? secondSalesValue
          : firstSalesValue,
    });
    await chooseSelectOption(customerSelect, { label: "Wholesale Alpha" });
    const salesValue = await getSelectValue(salesSelect);
    const customerValue = await getSelectValue(customerSelect);
    await logisticsDialog.getByRole("button", { name: "保存归属" }).click();
    await expect(logisticsDialog.getByRole("alert")).toContainText(
      "店铺归属暂时没有保存成功，请稍后重试。",
    );
    await expect(logisticsDialog).toBeVisible();
    await expectSelectValue(salesSelect, salesValue);
    await expectSelectValue(customerSelect, customerValue);
    await expectResponsiveLayout(page);
    await page.keyboard.press("Escape");

    await page.goto("/admin/wholesale/referrals");
    await failJsonRequest(page, "**/rest/v1/wholesale_referrals*", "POST");
    await page.getByRole("button", { name: "新增推荐关系" }).click();
    const referralDialog = page.getByRole("dialog", { name: "新增推荐关系" });
    const referrerSelect = referralDialog.getByRole("combobox", {
      exact: true,
      name: "推荐客户",
    });
    const referredSelect = referralDialog.getByRole("combobox", {
      exact: true,
      name: "被推荐客户",
    });
    const referrerValue = await optionValueAt(referrerSelect, 1);
    const referredValue = await optionValueAt(referredSelect, 2);
    await chooseSelectOption(referrerSelect, { value: referrerValue });
    await chooseSelectOption(referredSelect, { value: referredValue });
    await referralDialog.getByRole("button", { name: "保存关系" }).click();
    await expectFailureNotice(page);
    await expect(referralDialog).toBeVisible();
    await expectSelectValue(referrerSelect, referrerValue);
    await expectSelectValue(referredSelect, referredValue);
    await expectResponsiveLayout(page);
  });

  test("结汇发布失败时弹窗、金额和备注保持不变", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "finance");
    await page.goto("/finance/wholesale/settlement-releases");
    await failJsonRequest(
      page,
      "**/rest/v1/rpc/create_wholesale_settlement_release",
    );

    await page.getByRole("button", { name: "发布收款" }).click();
    const dialog = page.getByRole("dialog", { name: "发布结汇收款" });
    await dialog.getByLabel("客户名称").fill("失败后保留的结汇客户");
    await dialog.getByLabel("结汇金额").fill("88.66");
    await dialog.getByLabel("备注").fill("失败后保留的结汇备注");
    await dialog.getByRole("button", { name: "发布收款" }).click();
    await expectFailureNotice(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("客户名称")).toHaveValue(
      "失败后保留的结汇客户",
    );
    await expect(dialog.getByLabel("结汇金额")).toHaveValue("88.66");
    await expect(dialog.getByLabel("备注")).toHaveValue(
      "失败后保留的结汇备注",
    );
    await expectResponsiveLayout(page);
  });
});

async function fillOrderCreateForm(
  dialog: ReturnType<Page["getByRole"]>,
  note: string,
) {
  await chooseSelectOption(dialog.getByLabel("客户名"), {
    label: "Wholesale Alpha",
  });
  await dialog.getByLabel("小单数量").fill("1");
  await dialog.getByLabel("产品采购金额").fill("100");
  await dialog.getByLabel("国际运费").fill("10");
  await dialog.getByLabel("客户支付金额").fill("200");
  await fillDateControl(
    dialog.getByLabel("订单计入月份"),
    currentShanghaiMonth(),
  );
  await dialog.getByLabel("备注").fill(note);
}

async function openWholesaleAlpha(page: Page) {
  await page
    .getByText("Wholesale Alpha", { exact: true })
    .filter({ visible: true })
    .first()
    .click();
}

async function failJsonRequest(
  page: Page,
  url: string,
  method = "POST",
) {
  await page.route(url, async (route) => {
    if (route.request().method() !== method) {
      await route.continue();
      return;
    }
    await route.fulfill({
      body: JSON.stringify({
        code: "P0001",
        details: null,
        hint: null,
        message: "e2e_forced_failure",
      }),
      contentType: "application/json",
      status: 400,
    });
  });
}

async function expectFailureNotice(page: Page) {
  // Next 自带一个空的路由播报区，同样使用 alert 角色；用文案筛选才能只定位业务反馈。
  await expect(
    page.getByRole("alert").filter({ hasText: FORCED_ERROR_MESSAGE }),
  ).toBeVisible();
}

async function firstNonEmptyOptionValue(
  select: ReturnType<Page["getByLabel"]>,
) {
  return optionValueAt(select, 1);
}

async function optionValueAt(
  select: ReturnType<Page["getByLabel"]>,
  index: number,
) {
  const value = await getSelectOptionValueAt(select, index);
  expect(value).not.toBe("");
  return value;
}

async function expectResponsiveLayout(page: Page) {
  await expectNoDocumentHorizontalOverflow(page);
  await page.setViewportSize({ height: 844, width: 390 });
  await expectNoDocumentHorizontalOverflow(page);
  await page.setViewportSize({ height: 900, width: 1440 });
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflowPixels).toBeLessThanOrEqual(2);
}

function currentShanghaiMonth() {
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}`;
}
