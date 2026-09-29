import { expect, test, type Page } from "@playwright/test";
import { loginAs, setTestLocale } from "./helpers/auth";
import { runLocalSupabaseSql } from "./helpers/local-supabase";
import { assertSalesLeadCustomerProof, readSalesLeadCustomerProof } from "./helpers/sales-lead-conversion";

const prefix = "E2E-CONVERSION-";
const leadId = (number: number) => `a5000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const waiting = "保存结果待确认，请刷新页面查看真实记录。";

function cleanup() {
  // 只清理本文件的固定编号和来源前缀，不能重置其他模块或共享账号的业务资料。
  runLocalSupabaseSql(`begin;
    create temporary table conversion_customers as select customer_id from public.sales_leads where primary_source_lead_id like '${prefix}%';
    update public.sales_leads set status='hall',current_assignee_user_id=null,current_assignment_id=null,
      claimed_at=null,first_contact_at=null,last_contact_at=null,next_follow_up_at=null,expires_at=null,hard_deadline_at=null,
      customer_id=null,converted_at=null,converted_by_user_id=null where primary_source_lead_id like '${prefix}%';
    delete from public.wholesale_customers where id in (select customer_id from conversion_customers);
    delete from public.sales_lead_contact_notes where lead_id in (select id from public.sales_leads where primary_source_lead_id like '${prefix}%');
    delete from public.sales_lead_assignments where lead_id in (select id from public.sales_leads where primary_source_lead_id like '${prefix}%');
    delete from public.sales_leads where primary_source_lead_id like '${prefix}%'; commit;`);
}
function prepare() {
  cleanup();
  runLocalSupabaseSql(`insert into public.sales_leads(id,primary_source_lead_id,latest_source_date,name,category,country,priority,
    source_url,email,phone,whatsapp,website_url,public_contact,community_url)
    select ('a5000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${prefix}'||n,current_date,'线索转换页面测试 '||n,
      '测试','CN','A','https://example.test/conversion/'||n,'conversion-'||n||'@example.test','+44 7000 0000 01',
      '+44 7000 0000 02','https://homepage.example.test/'||n,'https://example.test/contact','https://example.test/community' from generate_series(1,8) n;
    select private.start_sales_lead_assignment(id,
      case when primary_source_lead_id='${prefix}2' then '11111111-1111-4111-8111-111111111111'::uuid else '55555555-5555-4555-8555-555555555555'::uuid end,
      '11111111-1111-4111-8111-111111111111',now()-((right(primary_source_lead_id,1)::integer+1)*interval '1 day'))
    from public.sales_leads where primary_source_lead_id like '${prefix}%';`);
}
async function open(page: Page, number = 1) {
  await page.getByRole("button", { name: /^我的线索/ }).click();
  await page.getByLabel("搜索线索").fill(`线索转换页面测试 ${number}`);
  await page.getByTestId(`convert-lead-${leadId(number)}`).click();
  await expect(page.getByRole("dialog", { name: "添加为客户", exact: true })).toBeVisible();
  await expect(page.getByTestId("submit-lead-customer")).toBeEnabled();
}
function expectUnconverted(number = 1) {
  expect(readSalesLeadCustomerProof(leadId(number))).toMatchObject({ status: "claimed", customer_id: null, ended_at: null });
}
test.describe("lead conversion authoritative outcomes", () => {
  test.setTimeout(120_000);
  test.use({ actionTimeout: 20_000 });
  test.beforeEach(prepare);
  test.afterEach(cleanup);

  for (const role of ["salesman", "administrator"] as const) {
    test(`${role}: saved customer, owner, reload, edit and desktop/mobile bilingual layout`, async ({ page }) => {
      const number = role === "administrator" ? 2 : 1;
      const path = role === "administrator" ? "/admin" : "/salesman";
      const owner = role === "administrator" ? "本地管理员" : "本地业务员";
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error" || /hydration/i.test(message.text())) errors.push(message.text()); });
      await loginAs(page, role);
      await page.goto(`${path}/wholesale/leads`);
      await open(page, number);
      await expect(page.getByTestId("lead-customer-name")).toHaveValue(`线索转换页面测试 ${number}`);
      await expect(page.getByTestId("lead-customer-contacts")).toHaveValue(new RegExp(`conversion-${number}@example.test[\\s\\S]*7000[\\s\\S]*homepage[\\s\\S]*community`));
      await expect(page.getByLabel("客户负责人", { exact: true })).toHaveValue(owner);
      for (const width of [1440, 375]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await expect(page.getByTestId("submit-lead-customer")).toBeInViewport();
        await page.screenshot({ path: `output/lead-conversion-${role}-zh-${width}.png`, animations: "disabled" });
      }
      await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
      expectUnconverted(number);
      await setTestLocale(page, "en");
      await page.reload();
      await page.getByRole("button", { name: /^My Leads/ }).click();
      await page.getByLabel("Search leads").fill(`线索转换页面测试 ${number}`);
      await page.getByRole("button", { name: "Cards", exact: true }).click();
      await page.getByTestId(`convert-lead-${leadId(number)}`).click();
      await expect(page.getByRole("dialog", { name: "Add as customer", exact: true })).toBeVisible();
      await expect(page.getByLabel("Customer owner", { exact: true })).toHaveValue(owner);
      await expect(page.getByTestId("submit-lead-customer")).toBeEnabled();
      await page.screenshot({ path: `output/lead-conversion-${role}-en-375.png`, animations: "disabled" });
      const response = page.waitForResponse((item) => item.url().includes("/rpc/convert_sales_lead_to_customer"));
      // 页面连续提交也只产生一个客户，独立查询同时核对认领结束记录。
      await page.getByTestId("submit-lead-customer").evaluate((button: HTMLElement) => { button.click(); button.click(); });
      await response;
      await expect(page.getByText("Customer saved. The lead has been converted.", { exact: true })).toBeVisible();
      const proof = assertSalesLeadCustomerProof(leadId(number));
      expect(proof.owner).toBe(role === "administrator" ? "11111111-1111-4111-8111-111111111111" : "55555555-5555-4555-8555-555555555555");
      test.info().annotations.push({ type: "business-receipt", description: JSON.stringify(proof) });
      await page.reload();
      await page.getByRole("button", { name: /^Converted to customers/ }).click();
      await expect(page.getByRole("heading", { name: proof.customer_name, exact: true })).toBeVisible();
      await setTestLocale(page, "zh");
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${path}/wholesale/customers`);
      await page.getByLabel("搜索客户").fill(proof.customer_name);
      if (role === "administrator") {
        await page.getByLabel("客户负责人", { exact: true }).click();
        await page.getByRole("option", { name: owner, exact: true }).click();
      }
      await page.getByRole("button", { name: proof.customer_name, exact: true }).filter({ visible: true }).click();
      const customerDialog = page.getByRole("dialog", { name: proof.customer_name, exact: true });
      await expect(customerDialog.getByText(owner, { exact: true })).toBeVisible();
      await expect(customerDialog.getByRole("button", { name: "删除客户", exact: true })).toBeDisabled();
      await expect(customerDialog.getByText(/需要保留客户档案/)).toBeVisible();
      await customerDialog.getByRole("button", { name: "编辑客户", exact: true }).click();
      const edit = page.getByRole("dialog", { name: "编辑批发客户", exact: true });
      await expect(edit.getByLabel("客户负责人")).toContainText(owner);
      await edit.getByLabel("备注", { exact: true }).fill("转换后修改并保留负责人");
      await edit.getByRole("button", { name: "保存修改", exact: true }).click();
      await expect(edit).toHaveCount(0);
      expect(runLocalSupabaseSql(`select notes||'|'||assigned_sales_user_id from public.wholesale_customers where id='${proof.customer_id}'`)).toBe(`转换后修改并保留负责人|${proof.owner}`);
      await page.reload();
      await page.getByLabel("搜索客户").fill(proof.customer_name);
      await page.getByRole("button", { name: proof.customer_name, exact: true }).filter({ visible: true }).click();
      await expect(page.getByText("转换后修改并保留负责人", { exact: true })).toBeVisible();
      expect(errors).toEqual([]);
      await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(0);
    });
  }

  test("required fields and duplicate customer name leave the lead active", async ({ page }) => {
    await loginAs(page, "salesman"); await page.goto("/salesman/wholesale/leads"); await open(page);
    await page.getByTestId("lead-customer-name").fill("");
    await expect(page.getByTestId("submit-lead-customer")).toBeDisabled();
    await page.getByTestId("lead-customer-name").fill("Wholesale Alpha");
    await page.getByTestId("lead-customer-contacts").fill("");
    await expect(page.getByTestId("submit-lead-customer")).toBeDisabled();
    await page.getByTestId("lead-customer-contacts").fill("contact@example.test");
    await page.getByTestId("submit-lead-customer").click();
    await expect(page.getByText("这个客户名称已经存在，请核对后调整名称。", { exact: true })).toBeVisible();
    expectUnconverted();
    await expect(page.getByTestId("lead-customer-contacts")).toHaveValue("contact@example.test");
    await page.getByTestId("lead-customer-name").fill("调整后的转换客户");
    await page.getByTestId("submit-lead-customer").click();
    await expect(page.getByText("客户已保存，线索已成为客户。", { exact: true })).toBeVisible();
    assertSalesLeadCustomerProof(leadId(1));
  });

  test("expired and reassigned dialogs cannot create customers", async ({ page }) => {
    await loginAs(page, "salesman"); await page.goto("/salesman/wholesale/leads"); await open(page);
    runLocalSupabaseSql(`update public.sales_leads set expires_at=now()-interval '1 second',hard_deadline_at=now()-interval '1 second' where id='${leadId(1)}';`);
    await page.getByTestId("submit-lead-customer").click();
    await expect(page.getByText("这条线索已过期或不再由当前账号处理。", { exact: true })).toBeVisible();
    expectUnconverted();
    await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
    await open(page, 3);
    runLocalSupabaseSql(`begin; select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
      select public.assign_sales_lead('${leadId(3)}','dddddddd-dddd-4ddd-8ddd-dddddddddddd','旧弹窗验证');commit;`);
    await page.getByTestId("submit-lead-customer").click();
    await expect(page.getByText("只能将自己当前认领的线索添加为客户。", { exact: true })).toBeVisible();
    expectUnconverted(3);
  });

  test("HTTP success with partial_failed and disconnect never display success", async ({ page }) => {
    await loginAs(page, "salesman"); await page.goto("/salesman/wholesale/leads"); await open(page);
    await page.route("**/rpc/convert_sales_lead_to_customer", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "partial_failed" }) }));
    await page.getByTestId("submit-lead-customer").click();
    await expect(page.getByRole("dialog").getByText(waiting, { exact: true })).toBeVisible();
    expectUnconverted();
    await page.unroute("**/rpc/convert_sales_lead_to_customer");
    await page.route("**/rpc/convert_sales_lead_to_customer", (route) => route.abort("internetdisconnected"));
    await page.getByTestId("submit-lead-customer").click();
    await expect(page.getByRole("dialog").getByText(waiting, { exact: true })).toBeVisible();
    await expect(page.getByText("客户已保存，线索已成为客户。", { exact: true })).toHaveCount(0);
    expectUnconverted();
    await page.unroute("**/rpc/convert_sales_lead_to_customer");
    await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
    await open(page, 3);
    await page.route("**/rpc/convert_sales_lead_to_customer", async (route) => {
      // 在数据库实际提交后断网，模拟业务员收不到回执，也无法立即查询确认的情况。
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await page.context().setOffline(true);
      await route.abort("internetdisconnected");
    });
    await page.getByTestId("submit-lead-customer").click();
    await expect(page.getByRole("dialog").getByText(waiting, { exact: true })).toBeVisible();
    assertSalesLeadCustomerProof(leadId(3));
    await page.context().setOffline(false);
    await page.unroute("**/rpc/convert_sales_lead_to_customer");
    await page.reload();
    await page.getByRole("button", { name: /^已成为客户/ }).click();
    await expect(page.getByRole("heading", { name: "线索转换页面测试 3", exact: true })).toBeVisible();
  });

  test("wrong authoritative owner is detected, recovery is idempotent, and timeout stays unconfirmed", async ({ page }) => {
    await loginAs(page, "salesman"); await page.goto("/salesman/wholesale/leads"); await open(page);
    await page.route("**/rpc/convert_sales_lead_to_customer", async (route) => {
      const response = await route.fetch();
      runLocalSupabaseSql(`begin; set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
        update public.wholesale_customers set assigned_sales_user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' where id=(select customer_id from public.sales_leads where id='${leadId(1)}'); commit;`);
      await route.fulfill({ response });
    });
    await page.getByTestId("submit-lead-customer").click();
    await expect(page.getByRole("dialog").getByText(waiting, { exact: true })).toBeVisible();
    // 红：真实客户负责人错误时，最终凭证断言必须失败。绿：恢复后同一页面重试仍只有一个客户。
    expect(() => assertSalesLeadCustomerProof(leadId(1))).toThrow();
    const first = readSalesLeadCustomerProof(leadId(1));
    runLocalSupabaseSql(`begin; set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
      update public.wholesale_customers set assigned_sales_user_id='55555555-5555-4555-8555-555555555555' where id='${first.customer_id}'; commit;`);
    await page.unroute("**/rpc/convert_sales_lead_to_customer");
    await page.getByTestId("submit-lead-customer").click();
    await expect(page.getByText("客户已保存，线索已成为客户。", { exact: true })).toBeVisible();
    expect(assertSalesLeadCustomerProof(leadId(1)).customer_id).toBe(first.customer_id);
    await open(page, 3);
    await page.route("**/wholesale_customers?*", async (route) => {
      // 只拖延保存后的独立确认；数据库写入已完成，页面仍不得据此提前宣告成功。
      await new Promise((resolve) => setTimeout(resolve, 11_000));
      await route.continue();
    });
    await page.getByTestId("submit-lead-customer").click();
    await expect(page.getByRole("dialog").getByText(waiting, { exact: true })).toBeVisible({ timeout: 15_000 });
    assertSalesLeadCustomerProof(leadId(3));
    // 等待已进入延迟处理器的请求结束，再移除拦截；否则刷新会提前接管同一个请求。
    await page.unrouteAll({ behavior: "wait" });
    await page.reload();
    await page.getByRole("button", { name: /^已成为客户/ }).click();
    await expect(page.getByRole("heading", { name: "线索转换页面测试 3", exact: true })).toBeVisible();
  });
});
