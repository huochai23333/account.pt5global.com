import { expect, test, type Page } from "@playwright/test";
import { readLocalEnvValue } from "./helpers/local-supabase-admin";
import { loginAs, expectForbiddenPage } from "./helpers/auth";
import { chooseSelectOption } from "./helpers/select-control";
import { fillDateControl } from "./helpers/date-control";

import { runWholesaleFeeSql, feeSqlValue, readWholesaleFeeOrder as readOrder, readWholesaleFeeCommission as readCommission } from "./helpers/wholesale-fee-database";

// 单次交互限时，错误字段立即给出定位信息，避免把定位失败误认为服务迟缓。
test.use({ actionTimeout: 15_000, video: "off" });

const prefix = `fees-e2e-${Date.now()}`;
let prepared = false;
let newCustomerId: string;
let newCustomerName: string;
let existingCustomerName: string;
const createdOrders: string[] = [];
let parameterRevisionBefore: number | null = null;

// 只创建和清理本文件自己的客户/订单，不重置共享种子或现有参数版本。
test.beforeAll(async ({ baseURL }) => {
  expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
  if (!readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL")?.includes("54321")) throw new Error("本用例仅允许连接本地Docker测试库。");
  existingCustomerName = runWholesaleFeeSql("select unique_name from public.wholesale_customers where id='c1000000-0000-4000-8000-000000000001';");
  newCustomerName = `${prefix}-新客户`;
  const data = JSON.parse(runWholesaleFeeSql(`insert into public.wholesale_customers(unique_name,customer_kind,assigned_sales_user_id,created_by_user_id)
    values(${feeSqlValue(newCustomerName)},'sales_created','55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111')
    returning jsonb_build_object('id',id,'salesman_commission_cohort',salesman_commission_cohort);`));
  newCustomerId = data.id;
  prepared = true;
  expect(data.salesman_commission_cohort).toBe("new");
});

test.beforeEach(async ({ page }) => {
  // 浏览器离开未保存草稿的提醒由测试明确处理，避免关闭页面时挂起。
  page.on("dialog", (dialog) => void dialog.accept());
});

test.afterAll(async () => {
  if (!prepared) return;
  // 按本次订单编号和客户编号清理，绝不重置共享数据。
  if (createdOrders.length) runWholesaleFeeSql(`delete from public.wholesale_orders where id in (${createdOrders.map(feeSqlValue).join(",")});`);
  if (newCustomerId) runWholesaleFeeSql(`delete from public.wholesale_customers where id=${feeSqlValue(newCustomerId)};`);
  if (parameterRevisionBefore !== null) {
    // 只清理本用例发布的版本；修订号必须仍等于预期，避免覆盖别人的并发修改。
    runWholesaleFeeSql(`begin;
      update public.business_parameter_definitions set current_revision=${parameterRevisionBefore}
        where parameter_code='wholesale_salesman_customer_commission' and current_revision=${parameterRevisionBefore + 1};
      delete from public.business_parameter_versions where parameter_code='wholesale_salesman_customer_commission' and change_reason=${feeSqlValue(prefix + '-参数发布')};
      commit;`);
  }
});

test("新客户从页面创建、分次收款、改成本，数据库提成和刷新一致", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = collectPageErrors(page);
  await loginAs(page, "administrator");
  const order = await createOrder(page, newCustomerName, "new");
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
  runWholesaleFeeSql(`update public.wholesale_commissions set commission_amount_rmb=51 where order_id=${feeSqlValue(order.id)};`);
  const wrong = await readCommission(order.id);
  expect(() => expect(wrong.commission_amount_rmb).toBe(50)).toThrow();
  runWholesaleFeeSql(`update public.wholesale_commissions set commission_amount_rmb=50 where order_id=${feeSqlValue(order.id)};`);
  await showOrder(page, order.order_number);
  await page.getByTestId(`wholesale-order-edit-${order.id}`).click();
  const dialog = page.getByRole("dialog", { name: "修改批发订单" });
  await dialog.getByLabel(/^产品采购金额/).fill("11000");
  await expect(dialog.getByTestId("order-fee-serviceFee")).toHaveValue("625.00");
  await dialog.getByRole("button", { name: "保存修改" }).click();
  await expect(dialog).not.toBeVisible();
  stored = await readOrder(order.id);
  expect(stored.gross_profit).toBe(-500);
  expect(stored.customer_payment_amount).toBe(12300);
  expect((await readCommission(order.id)).commission_amount_rmb).toBe(62.5);
  await page.reload();
  await showOrder(page, order.order_number);
  await expect(page.getByTestId(`wholesale-order-row-${order.id}`)).toContainText("625.00");
  await expect(page.getByText("单位毛利", { exact: true })).toHaveCount(0);
  await page.goto("/admin/wholesale/incentives");
  const commissionRow = page.getByRole("row").filter({ hasText: order.order_number });
  await expect(commissionRow).toContainText("服务费提成基数");
  await expect(commissionRow).toContainText("62.50");
  await page.reload();
  await expect(commissionRow).toContainText("62.50");
  expect(errors).toEqual([]);
});

test("业务员新建老客户订单按毛利12%，无订单金额分档", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAs(page, "salesman");
  const order = await createOrder(page, existingCustomerName, "existing", "salesman");
  expect(order.commission_rate).toBe(0.12);
  expect(order.commission_basis).toBe("gross_profit");
  await settle(page, order, "12300", "salesman");
  expect((await readOrder(order.id)).gross_profit).toBe(2000);
  expect((await readCommission(order.id)).commission_amount_rmb).toBe(240);
  await page.reload();
  await showOrder(page, order.order_number, "salesman");
  await expect(page.getByTestId(`wholesale-order-row-${order.id}`)).toContainText("2,000.00");
});

test("375px表单预览及手机订单详情不溢出，财务能保存订单", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 375, height: 812 });
  const errors = collectPageErrors(page);
  await loginAs(page, "finance");
  const order = await createOrder(page, newCustomerName, "mobile", "finance");
  await page.reload();
  await page.getByRole("button").filter({ hasText: order.order_number }).click();
  const details = page.getByRole("dialog", { name: `订单 ${order.order_number}` });
  await expect(details.getByText("服务费", { exact: true })).toBeVisible();
  await expect(details.getByText("CN税费", { exact: true })).toBeVisible();
  await expect(details.getByText("付款手续费", { exact: true })).toBeVisible();
  await expect(details.getByText("单位毛利", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await details.getByText("服务费", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "output/wholesale-fees-mobile.png", fullPage: false });
  expect(errors).toEqual([]);
});

test("客户页面及原始响应均不包含内部费用，不能创建订单", async ({ page }) => {
  await loginAs(page, "client");
  const response = page.waitForResponse((r) => r.url().includes("rpc/get_wholesale_order_page") && r.request().method() === "POST");
  await page.goto("/client/wholesale/orders");
  await page.getByLabel("搜索订单", { exact: true }).fill("WH");
  const payload = await (await response).json();
  expect(payload.orders.length).toBeGreaterThan(0);
  for (const order of payload.orders) {
    for (const key of ["commission_calculation_snapshot", "service_fee", "cn_tax_fee", "payment_processing_fee", "commission_basis", "commission_basis_amount_rmb"]) expect(order).not.toHaveProperty(key);
  }
  for (const key of ["serviceFeeAmount", "cnTaxFeeAmount", "paymentProcessingFeeAmount"]) expect(payload.summary).not.toHaveProperty(key);
  await expect(page.getByRole("button", { name: "新建订单" })).toHaveCount(0);
  await expect(page.getByText("服务费", { exact: true })).toHaveCount(0);
  await expect(page.getByText("CN税费", { exact: true })).toHaveCount(0);
});

test("目标订单已删除时保存失败，保留草稿且没有成功提示", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAs(page, "administrator");
  const order = await createOrder(page, newCustomerName, "zero-row");
  await showOrder(page, order.order_number);
  await page.getByTestId(`wholesale-order-edit-${order.id}`).click();
  const dialog = page.getByRole("dialog", { name: "修改批发订单" });
  runWholesaleFeeSql(`delete from public.wholesale_orders where id=${feeSqlValue(order.id)};`);
  await dialog.getByLabel(/^产品采购金额/).fill("9000");
  await dialog.getByRole("button", { name: "保存修改" }).click();
  await expect(dialog).toBeVisible();
  await expect(page.getByText("批发订单已保存。", { exact: true })).toHaveCount(0);
  const count = Number(runWholesaleFeeSql(`select count(*) from public.wholesale_orders where id=${feeSqlValue(order.id)};`));
  expect(count).toBe(0);
});

test("管理员从页面发布两个客户比例并核对版本，业务员没有修改入口", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAs(page, "administrator");
  parameterRevisionBefore = Number(runWholesaleFeeSql("select current_revision from public.business_parameter_definitions where parameter_code='wholesale_salesman_customer_commission';"));
  await page.goto("/admin/wholesale/settings");
  const row = page.getByTestId("business-parameter-row-wholesale_salesman_customer_commission");
  await row.getByRole("button", { name: "修改" }).click();
  const dialog = page.getByRole("dialog", { name: /修改批发订单业务员佣金/ });
  await expect(dialog.getByTestId("business-parameter-input-existing_customer_rate")).toBeVisible();
  await expect(dialog.getByTestId("business-parameter-input-new_customer_service_fee_rate")).toBeVisible();
  await expect(dialog.getByTestId("business-parameter-input-tier_1_limit_rmb")).toHaveCount(0);
  await page.screenshot({ path: "output/wholesale-fees-settings.png", fullPage: true });
  await dialog.getByTestId("business-parameter-change-reason").fill(prefix + "-参数发布");
  const endpoint = "**/rest/v1/rpc/publish_business_parameter_version";
  // 返回成功响应但没有真实版本时，页面必须依靠独立回读识别失败。
  await page.route(endpoint, async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      version_id: crypto.randomUUID(), parameter_code: body.p_parameter_code,
      version_number: parameterRevisionBefore! + 1, config: body.p_config,
      effective_from: new Date().toISOString(), published_at: new Date().toISOString(),
      published_by: "11111111-1111-4111-8111-111111111111",
      change_reason: body.p_change_reason, current_revision: parameterRevisionBefore! + 1,
    }) });
  });
  await confirmParameterPublish(page, dialog);
  await expect(page.getByText(/最终核对没有通过/)).toBeVisible();
  await expect(page.getByText(/已发布第/)).toHaveCount(0);
  expect(Number(runWholesaleFeeSql(`select count(*) from public.business_parameter_versions where change_reason=${feeSqlValue(prefix + '-参数发布')};`))).toBe(0);
  await page.unroute(endpoint);
  // 超过实际30秒请求上限；未写入时保留草稿，不能显示发布成功。
  await page.route(endpoint, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 35_000));
    await route.abort("timedout").catch(() => {});
  });
  await confirmParameterPublish(page, dialog);
  await expect(page.getByText(/等待结果超时/)).toBeVisible({ timeout: 40_000 });
  await expect(dialog).toBeVisible();
  expect(Number(runWholesaleFeeSql(`select count(*) from public.business_parameter_versions where change_reason=${feeSqlValue(prefix + '-参数发布')};`))).toBe(0);
  await page.unroute(endpoint);
  // 先让真实数据库提交，再断开响应；使用保留的请求编号重试，只能得到原版本。
  await page.route(endpoint, async (route) => {
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    await route.abort("timedout");
  });
  await confirmParameterPublish(page, dialog);
  await expect(page.getByText("这次修改没有完成，请稍后再试。", { exact: true })).toBeVisible();
  const committedId = runWholesaleFeeSql(`select id from public.business_parameter_versions where change_reason=${feeSqlValue(prefix + '-参数发布')};`);
  expect(committedId).toMatch(/^[0-9a-f-]{36}$/);
  await page.unroute(endpoint);
  await confirmParameterPublish(page, dialog);
  await expect(dialog).not.toBeVisible();
  const versions = JSON.parse(runWholesaleFeeSql(`select coalesce(jsonb_agg(v),'[]'::jsonb) from public.business_parameter_versions v
    where change_reason=${feeSqlValue(prefix + '-参数发布')};`));
  expect(versions).toHaveLength(1);
  expect(versions[0].id).toBe(committedId);
  expect(versions[0].config).toEqual({ existing_customer_rate: 0.12, new_customer_service_fee_rate: 0.10 });
  expect(versions[0].version_number).toBe(parameterRevisionBefore + 1);
  await expect(page.getByText(new RegExp(`版本凭证：${versions[0].id}`))).toBeVisible();
  await page.reload();
  await expect(row).toContainText(`第 ${versions[0].version_number} 版`);
  expect(Number(runWholesaleFeeSql(`select count(*) from public.business_parameter_versions where change_reason=${feeSqlValue(prefix + '-参数发布')};`))).toBe(1);
  console.log("[费用与提成版本凭证]", JSON.stringify({ versionId: versions[0].id, versionNumber: versions[0].version_number, affectedRows: 1 }));
  // 清除管理员会话后以真实业务员登录，不能仅用管理员访问别人的路由。
  await page.context().clearCookies();
  await loginAs(page, "salesman");
  await page.goto("/salesman/wholesale/settings");
  await expectForbiddenPage(page);
});

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
}

async function createOrder(page: Page, customer: string, kind: string, role = "admin") {
  await page.goto(`/${role}/wholesale/orders`);
  await page.getByRole("button", { name: "新建订单" }).click();
  const dialog = page.getByRole("dialog", { name: "新建批发订单" });
  if (kind === "new") {
    // 必填资料缺失时停在表单，权威数据库不能出现订单。
    await dialog.getByRole("button", { name: "保存订单" }).click();
    await expect(dialog).toBeVisible();
    expect(Number(runWholesaleFeeSql(`select count(*) from public.wholesale_orders where customer_id=${feeSqlValue(newCustomerId)};`))).toBe(0);
  }
  await chooseSelectOption(dialog.getByLabel("客户名", { exact: true }), { label: customer });
  await chooseSelectOption(dialog.getByLabel("关联业务员"), { label: "本地业务员" });
  await dialog.getByLabel("小单数量").fill("100");
  await dialog.getByLabel(/^产品采购金额/).fill("8500");
  await dialog.getByLabel(/^国际运费/).fill("1200");
  await expect(dialog.getByTestId("order-fee-serviceFee")).toHaveValue("500.00");
  await expect(dialog.getByTestId("order-fee-cnTaxFee")).toHaveValue("300.00");
  await expect(dialog.getByTestId("order-fee-paymentProcessingFee")).toHaveValue("108.00");
  await expect(dialog.getByTestId("order-fee-serviceFee")).toHaveAttribute("readonly", "");
  await dialog.getByLabel("其他费用（人民币）", { exact: true }).fill("200");
  await dialog.getByLabel("推荐佣金费用").fill("100");
  await chooseSelectOption(dialog.getByLabel("客户支付币种"), { value: "CNY" });
  await dialog.getByLabel(/^客户支付金额/).fill("12300");
  // 按上海时区拆出年和月，不能依赖不同 Windows 语言环境的日期排序。
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const month = `${parts.find((part) => part.type === "year")!.value}-${parts.find((part) => part.type === "month")!.value}`;
  await fillDateControl(dialog.getByLabel("订单计入月份"), month);
  const note = `${prefix}-${kind}`;
  await dialog.getByLabel("备注", { exact: true }).fill(note);
  if (role === "finance") {
    await dialog.getByTestId("order-fee-serviceFee").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "output/wholesale-fees-mobile-form.png", fullPage: false });
  }
  if (kind === "new") {
    await dialog.getByLabel("客户名", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "output/wholesale-fees-desktop-form.png", fullPage: false });
  }
  await dialog.getByRole("button", { name: "保存订单" }).click();
  await expect(dialog).not.toBeVisible();
  const data = JSON.parse(runWholesaleFeeSql(`select to_jsonb(o) from public.wholesale_orders o where notes=${feeSqlValue(note)};`));
  createdOrders.push(data.id);
  // 同一次保存只允许一张订单，刷新不能再创建。
  await page.reload();
  const count = Number(runWholesaleFeeSql(`select count(*) from public.wholesale_orders where notes=${feeSqlValue(note)};`));
  expect(count).toBe(1);
  return data;
}

async function showOrder(page: Page, number: string, role = "admin") {
  await page.goto(`/${role}/wholesale/orders`);
  await page.getByLabel("搜索订单", { exact: true }).fill(number);
  const expand = page.getByRole("button", { name: "查看全部字段" });
  if (await expand.isVisible()) await expand.click();
  await expect(page.getByTestId(/^wholesale-order-row-/).filter({ hasText: number })).toBeVisible();
}

async function settle(page: Page, order: { id: string; order_number: string }, amount: string, role = "admin") {
  await showOrder(page, order.order_number, role);
  await page.getByTestId(`wholesale-order-settle-${order.id}`).click();
  const dialog = page.getByRole("dialog", { name: "确认结汇" });
  await dialog.getByLabel("本次结汇金额").fill(amount);
  await dialog.getByRole("button", { name: "保存结汇记录" }).click();
  await expect(dialog).not.toBeVisible();
  const matches = Number(runWholesaleFeeSql(`select count(*) from public.wholesale_order_settlements where order_id=${feeSqlValue(order.id)} and settlement_amount=${feeSqlValue(amount)}::numeric;`));
  expect(matches).toBe(1);
}

/** 每次都从真实审核弹窗确认，故障注入不绕过用户提交路径。 */
async function confirmParameterPublish(page: Page, dialog: ReturnType<Page["getByRole"]>) {
  await dialog.getByTestId("business-parameter-review-publish").click();
  await page.getByRole("dialog", { name: "确认发布这次修改？" }).getByRole("button", { name: "确认发布", exact: true }).click();
}
