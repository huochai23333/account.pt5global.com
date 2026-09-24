import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import { fillDateControl } from "./helpers/date-control";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";
import {
  chooseSelectOption,
  expectSelectValue,
  getSelectValue,
} from "./helpers/select-control";
import {
  cleanupRateFixtures,
  cleanupSettlementReleaseFixtures,
  ensureLocalUsdRate,
  getActiveAllocationTotal,
} from "./helpers/wholesale-settlement-fixtures";

test.describe("wholesale settlement releases", () => {
  const createdReleaseNotes = new Set<string>();
  const createdRateIds = new Set<string>();

  test.afterEach(async () => {
    // 结汇会真实生成收款、分配和订单结算记录。每次用例结束后只按本次唯一备注
    // 删除对应记录，避免前一次运行改变后一次“最早订单优先”的业务结果。
    await cleanupSettlementReleaseFixtures([...createdReleaseNotes]);
    createdReleaseNotes.clear();
    await cleanupRateFixtures([...createdRateIds]);
    createdRateIds.clear();
  });

  test("一笔收款可部分分配到多笔订单并整组调整", async ({
    browser,
  }, testInfo) => {
    testInfo.setTimeout(180_000);
    const uniqueSuffix = Date.now();
    const allocationNote = `多订单结汇分配 ${uniqueSuffix}`;
    const temporaryCustomerName = `待确认客户 ${uniqueSuffix}`;
    const temporaryAllocationNote = `手填客户后分配 ${uniqueSuffix}`;
    const cancelledCustomerName = `取消收款 ${uniqueSuffix}`;
    const cancelledNote = `取消验证 ${uniqueSuffix}`;
    createdReleaseNotes.add(allocationNote);
    createdReleaseNotes.add(temporaryAllocationNote);
    createdReleaseNotes.add(cancelledNote);
    const receivedDate = getShanghaiDateInputValue();
    const createdRateId = await ensureLocalUsdRate(receivedDate);
    if (createdRateId) createdRateIds.add(createdRateId);

    const financePage = await browser.newPage();
    await financePage.setViewportSize({ height: 900, width: 1440 });
    await loginAs(financePage, "finance");
    await financePage.goto("/finance/wholesale/settlement-releases");
    await expectWorkspaceShell(financePage);
    await expectNotForbiddenPage(financePage);
    await expect(
      financePage.getByRole("heading", { name: "结汇发布" }),
    ).toBeVisible();

    await publishRelease(financePage, {
      amount: "3000",
      customerLabel: "Wholesale Alpha",
      currency: "USD",
      note: allocationNote,
      receivedDate,
    });
    await expect(financePage.getByText("结汇收款已发布。")).toBeVisible();

    await publishRelease(financePage, {
      amount: "500",
      customerName: temporaryCustomerName,
      currency: "USD",
      note: temporaryAllocationNote,
      receivedDate,
    });
    await expect(financePage.getByText("结汇收款已发布。")).toBeVisible();

    await publishRelease(financePage, {
      amount: "88.66",
      customerName: cancelledCustomerName,
      currency: "USD",
      note: cancelledNote,
      receivedDate,
    });
    await financePage.getByLabel("搜索收款").fill(cancelledCustomerName);
    const cancelledRow = financePage.getByRole("row").filter({
      hasText: cancelledCustomerName,
    });
    await cancelledRow.getByRole("button", { name: "取消" }).click();
    await expect(financePage.getByText("这条结汇收款已取消。")).toBeVisible();
    await expect(cancelledRow).toContainText("已取消");
    await financePage.close();

    const salesmanPage = await browser.newPage();
    await salesmanPage.setViewportSize({ height: 900, width: 1440 });
    await loginAs(salesmanPage, "salesman");
    await salesmanPage.goto("/salesman/wholesale/settlement-releases");
    await expectWorkspaceShell(salesmanPage);
    await expectNotForbiddenPage(salesmanPage);
    await expect(
      salesmanPage.getByRole("button", { name: "发布收款" }),
    ).toHaveCount(0);
    const monthlyCard = salesmanPage.locator('[data-slot="metric-card"]').filter({
      hasText: "本月已分配金额",
    });
    await expect(monthlyCard).toContainText("US$0.00");

    await salesmanPage.getByLabel("搜索收款").fill(allocationNote);
    const allocationRow = salesmanPage.getByRole("row").filter({
      hasText: allocationNote,
    });
    await expect(allocationRow).toBeVisible();
    await allocationRow.getByRole("button", { name: "开始分配" }).click();

    const allocationDialog = salesmanPage.getByRole("dialog", {
      name: "分配收款",
    });
    await expect(allocationDialog).toBeVisible();
    const fixedCustomerSelect = allocationDialog.getByLabel("归属客户");
    await expect(fixedCustomerSelect).toBeDisabled();
    expect(await getSelectValue(fixedCustomerSelect)).not.toBe("");

    // 预期只从数据库订单日期与已结汇余额计算，不能用页面建议反过来证明建议正确。
    const expectedAllocations = await getExpectedInitialAllocations("Wholesale Alpha", 3000);
    expect(expectedAllocations).toHaveLength(2);
    const [firstSuggestion, secondSuggestion] = expectedAllocations;
    const firstOrderNumber = firstSuggestion.orderNumber;
    const secondOrderNumber = secondSuggestion.orderNumber;
    const firstOrderInput = getAllocationInput(allocationDialog, firstOrderNumber);
    const secondOrderInput = getAllocationInput(
      allocationDialog,
      secondOrderNumber,
    );
    await expect(firstOrderInput).toHaveValue(firstSuggestion.amount);
    await expect(secondOrderInput).toHaveValue(secondSuggestion.amount);

    await firstOrderInput.fill("1000");
    await secondOrderInput.fill("500");
    await expect(allocationDialog.getByText("US$1,500.00")).toHaveCount(2);
    await expectNoDocumentHorizontalOverflow(salesmanPage);
    await expectNoCompressedText(salesmanPage);

    // 真正提交前切到手机宽度，验证金额卡片、按钮和长订单号不会把页面撑宽或挤成竖排。
    await salesmanPage.setViewportSize({ height: 844, width: 390 });
    await expectNoDocumentHorizontalOverflow(salesmanPage);
    await expectNoCompressedText(salesmanPage);
    await expectTouchTargets(allocationDialog);
    await salesmanPage.setViewportSize({ height: 900, width: 1440 });
    await allocationDialog.getByRole("button", { name: "保存全部分配" }).click();

    await expect(salesmanPage.getByText("结汇收款分配已保存。")).toBeVisible();
    await expect(allocationRow).toContainText("部分分配");
    await expect(allocationRow).toContainText(firstOrderNumber);
    await expect(allocationRow).toContainText(secondOrderNumber);
    await expect(allocationRow).toContainText("US$1,500.00");
    await expect.poll(() => getActiveAllocationTotal(allocationNote)).toBe(1500);
    await expect(monthlyCard).toContainText("US$1,500.00");
    await salesmanPage.reload();
    await expect(monthlyCard).toContainText("US$1,500.00");

    await allocationRow.getByRole("button", { name: "继续分配" }).click();
    const continueDialog = salesmanPage.getByRole("dialog", {
      name: "继续分配收款",
    });
    await expect(
      getAllocationInput(continueDialog, firstOrderNumber),
    ).toHaveValue("1000.00");
    await expect(
      getAllocationInput(continueDialog, secondOrderNumber),
    ).toHaveValue("500.00");
    await continueDialog
      .getByRole("button", { name: "按最早订单重新分配" })
      .click();
    await expect(
      getAllocationInput(continueDialog, firstOrderNumber),
    ).toHaveValue(firstSuggestion.amount);
    await expect(
      getAllocationInput(continueDialog, secondOrderNumber),
    ).toHaveValue(secondSuggestion.amount);
    await continueDialog
      .getByRole("button", { name: "保存全部分配" })
      .click();

    await expect(salesmanPage.getByText("结汇收款分配已保存。")).toBeVisible();
    await expect(allocationRow).toContainText("已分配");
    await expect.poll(() => getActiveAllocationTotal(allocationNote)).toBe(3000);
    await expect(monthlyCard).toContainText("US$3,000.00");
    await allocationRow.getByRole("button", { name: "调整分配" }).click();
    const adjustDialog = salesmanPage.getByRole("dialog", {
      name: "调整收款分配",
    });
    await adjustDialog
      .getByRole("button", { name: "清空当前分配" })
      .click();
    await expect(adjustDialog.getByText("确认清空这笔收款的全部分配？"))
      .toBeVisible();
    await adjustDialog.getByRole("button", { name: "确认清空" }).click();
    await expect.poll(() => getActiveAllocationTotal(allocationNote)).toBe(0);
    await expect(monthlyCard).toContainText("US$0.00");

    // 手填名称的收款必须先归到正式客户；保存失败后客户和逐笔金额都应保留。
    await salesmanPage.getByLabel("搜索收款").fill(temporaryAllocationNote);
    const temporaryRow = salesmanPage.getByRole("row").filter({
      hasText: temporaryAllocationNote,
    });
    await temporaryRow.getByRole("button", { name: "开始分配" }).click();
    const temporaryDialog = salesmanPage.getByRole("dialog", {
      name: "分配收款",
    });
    const temporaryCustomerSelect = temporaryDialog.getByLabel("归属客户");
    await expect(temporaryCustomerSelect).toBeEnabled();
    await chooseSelectOption(temporaryCustomerSelect, {
      label: "Wholesale Alpha",
    });
    const temporaryFirstInput = temporaryDialog
      .locator('input[type="number"]')
      .first();
    await expect(temporaryFirstInput).not.toHaveValue("");
    const savedCustomerValue = await getSelectValue(temporaryCustomerSelect);
    const savedFirstAmount = await temporaryFirstInput.inputValue();

    const replaceRequestPattern =
      "**/rest/v1/rpc/replace_wholesale_settlement_release_allocations";
    await salesmanPage.route(replaceRequestPattern, async (route) => {
      await route.fulfill({
        body: JSON.stringify({ message: "forced_failure" }),
        contentType: "application/json",
        status: 500,
      });
    });
    await temporaryDialog
      .getByRole("button", { name: "保存全部分配" })
      .click();
    await expect(
      salesmanPage.getByText("操作没有成功，请检查内容和权限后再试。"),
    ).toBeVisible();
    await expect(temporaryDialog).toBeVisible();
    await expectSelectValue(temporaryCustomerSelect, savedCustomerValue);
    await expect(temporaryFirstInput).toHaveValue(savedFirstAmount);

    await salesmanPage.unroute(replaceRequestPattern);
    await temporaryDialog
      .getByRole("button", { name: "保存全部分配" })
      .click();
    await expect(salesmanPage.getByText("结汇收款分配已保存。")).toBeVisible();
    await expect(temporaryRow).toContainText("已分配");

    await expectNoDocumentHorizontalOverflow(salesmanPage);
    await salesmanPage.setViewportSize({ height: 844, width: 390 });
    await salesmanPage.goto("/salesman/wholesale/settlement-releases");
    await expect(
      salesmanPage.getByRole("heading", { name: "结汇发布" }),
    ).toBeVisible();
    await expectNoDocumentHorizontalOverflow(salesmanPage);
    await expectNoCompressedText(salesmanPage);
    await salesmanPage.setViewportSize({ height: 844, width: 320 });
    await expectNoDocumentHorizontalOverflow(salesmanPage);
    await expectNoCompressedText(salesmanPage);
    await salesmanPage.close();
  });
});

async function publishRelease(
  page: Page,
  options: {
    amount: string;
    currency: string;
    note: string;
    receivedDate: string;
    customerLabel?: string;
    customerName?: string;
  },
) {
  await page.getByRole("button", { name: "发布收款" }).click();

  const dialog = page.getByRole("dialog", { name: "发布结汇收款" });
  await expect(dialog).toBeVisible();

  if (options.customerLabel) {
    await chooseSelectOption(dialog.getByRole("combobox", { name: "选择客户" }), {
      label: options.customerLabel,
    });
  } else {
    await dialog.getByLabel("客户名称").fill(options.customerName ?? "");
  }

  await dialog.getByLabel("结汇金额").fill(options.amount);
  await chooseSelectOption(dialog.getByLabel("币种"), {
    value: options.currency,
  });
  await fillDateControl(dialog.getByLabel("收款日期"), options.receivedDate);
  await dialog.getByLabel("备注").fill(options.note);
  await dialog.getByRole("button", { name: "发布收款" }).click();
}

function getAllocationInput(dialog: Locator, orderNumber: string) {
  return dialog.getByRole("spinbutton", {
    exact: true,
    name: `订单 ${orderNumber} 的分配金额`,
  });
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

async function expectNoCompressedText(page: Page) {
  const compressedText = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(
      'button, label, option, [data-slot="metric-card"] p',
    ))
      .filter((element) => {
        const text = element.innerText.trim();
        const rect = element.getBoundingClientRect();
        return (
          text &&
          rect.width > 0 &&
          rect.width < 24 &&
          rect.height > 48 &&
          rect.height > rect.width * 2.5
        );
      })
      .map((element) => element.innerText.trim())
      .slice(0, 5),
  );

  expect(compressedText).toEqual([]);
}

async function expectTouchTargets(scope: Locator) {
  const tooSmallTargets = await scope.locator("button, input").evaluateAll(
    (elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          // Base UI 会为下拉框生成 1px 的隐藏表单输入；它不参与点击和键盘导航，不属于触控目标。
          return (
            (element as HTMLElement).tabIndex >= 0 &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.height < 43.5
          );
        })
        .map((element) => ({
          height: element.getBoundingClientRect().height,
          text: (element as HTMLElement).innerText || element.getAttribute("aria-label"),
        }))
        .slice(0, 5),
  );

  expect(tooSmallTargets).toEqual([]);
}

async function getExpectedInitialAllocations(customerName: string, releaseAmount: number) {
  const admin = getLocalSupabaseAdminClient();
  if (!admin) throw new Error("结汇建议回归需要本地数据库连接。");
  const { data: customer, error: customerError } = await admin.from("wholesale_customers")
    .select("id").eq("unique_name", customerName).single();
  if (customerError || !customer) throw customerError ?? new Error("测试客户不存在。");
  const { data: orders, error: orderError } = await admin.from("wholesale_orders")
    .select("id,order_number,ordered_at,customer_payment_amount")
    .eq("customer_id", customer.id).eq("customer_payment_currency", "USD");
  if (orderError || !orders) throw orderError ?? new Error("无法读取客户订单。");
  const { data: settlements, error: settlementError } = await admin.from("wholesale_order_settlements")
    .select("order_id,settlement_amount").in("order_id", orders.map((order) => order.id));
  if (settlementError) throw settlementError;
  const paidByOrderId = new Map<string, number>();
  for (const settlement of settlements ?? []) {
    paidByOrderId.set(settlement.order_id,
      (paidByOrderId.get(settlement.order_id) ?? 0) + Number(settlement.settlement_amount));
  }
  let unallocated = releaseAmount;
  const expected: Array<{ orderNumber: string; amount: string }> = [];
  // 按原始订单事实独立算出最早订单与逐笔可用余额，避免测试与页面共用同一计算结果。
  for (const order of [...orders].sort((left, right) =>
    Date.parse(left.ordered_at) - Date.parse(right.ordered_at) || left.order_number.localeCompare(right.order_number))) {
    const available = Math.max(Number(order.customer_payment_amount) - (paidByOrderId.get(order.id) ?? 0), 0);
    const amount = Math.min(available, unallocated);
    if (amount <= 0) continue;
    expected.push({ orderNumber: order.order_number, amount: amount.toFixed(2) });
    unallocated = Math.round((unallocated - amount) * 100) / 100;
    if (unallocated <= 0) break;
  }
  expect(unallocated).toBe(0);
  return expected;
}
