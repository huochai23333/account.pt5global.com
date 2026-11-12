import { execFileSync } from "node:child_process";
import { readDisposablePostgresTarget } from "../test-support/disposable-fixture";
import { readLocalPostgresRows, localSqlValue as quote } from "./helpers/local-postgres-query";
import { withSalesLeadConversionFixture, type ConversionLead } from "./helpers/sales-lead-conversion-fixture";
import { expect, test, type Page } from "@playwright/test";
import { loginAs, setTestLocale } from "./helpers/auth";
import { runLocalSupabaseSql } from "./helpers/local-supabase";
import { readSalesLeadCustomerProof } from "./helpers/sales-lead-conversion";
const waiting = "保存结果待确认，请刷新页面查看真实记录。";
/** 先核对真实草稿，再填提交前已经登记的客户名和备注。 */
async function fillPlannedConversion(page: Page, lead: ConversionLead) {
    await page.getByTestId("lead-customer-name").fill(lead.manifest!.customerName);
    await page.getByTestId("lead-customer-notes").fill(lead.manifest!.notes);
}
async function open(page: Page, lead: ConversionLead, fill = true) {
    await page.getByRole("button", { name: /^我的线索/ }).click();
    await page.getByLabel("搜索线索").fill(lead.name);
    await page.getByTestId(`convert-lead-${lead.id}`).click();
    await expect(page.getByRole("dialog", { name: "添加为客户", exact: true })).toBeVisible();
    await expect(page.getByTestId("submit-lead-customer")).toBeEnabled();
    if (fill)
        await fillPlannedConversion(page, lead);
}
function expectUnconverted(lead: ConversionLead) {
    expect(readSalesLeadCustomerProof(lead.id)).toMatchObject({ status: "claimed", customer_id: null, ended_at: null, fixture_name_count: 0 });
}
test.describe("lead conversion authoritative outcomes", () => {
    test.setTimeout(120000);
    test.use({ actionTimeout: 20000 });
    test.beforeEach(({ baseURL }) => {
        // 登录及故障测试只进入可重建专属实例，不在共享数据上注入错误。
        readDisposablePostgresTarget({ baseURL, supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
            mode: process.env.PT5_E2E_FIXTURE_MODE, project: process.env.PT5_E2E_DATABASE_PROJECT,
            container: process.env.PT5_E2E_DATABASE_CONTAINER }, args => execFileSync("docker", args, { encoding: "utf8", timeout: 12000, windowsHide: true }).trim());
    });
    for (const role of ["salesman", "administrator"] as const) {
        test(`${role}: saved customer, owner, reload, edit and desktop/mobile bilingual layout`, async ({ page }, testInfo) => {
            const account = await loginAs(page, role);
            await withSalesLeadConversionFixture(page, account.email, async (fixture) => {
                const lead = fixture.create();
                const path = role === "administrator" ? "/admin" : "/salesman";
                const owner = fixture.actor.name;
                const errors: string[] = [];
                page.on("pageerror", (error) => errors.push(error.message));
                page.on("console", (message) => { if (message.type() === "error" || /hydration/i.test(message.text()))
                    errors.push(message.text()); });
                await page.goto(`${path}/wholesale/leads`);
                await open(page, lead, false);
                await expect(page.getByTestId("lead-customer-name")).toHaveValue(lead.name);
                // String.raw保留正则的\s，避免重复转义后只匹配字母而漏掉多行联系方式。
                await expect(page.getByTestId("lead-customer-contacts")).toHaveValue(new RegExp(String.raw `${lead.id}@example.test[\s\S]*7000[\s\S]*homepage[\s\S]*community`));
                await expect(page.getByLabel("客户负责人", { exact: true })).toHaveValue(owner);
                for (const width of [1440, 375, 390]) {
                    await page.setViewportSize({ width, height: 900 });
                    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
                    await expect(page.getByTestId("submit-lead-customer")).toBeInViewport();
                    await page.screenshot({ path: testInfo.outputPath(`lead-conversion-${role}-zh-${width}.png`), animations: "disabled" });
                }
                await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
                expectUnconverted(lead);
                await setTestLocale(page, "en");
                await page.reload();
                await page.getByRole("button", { name: /^My Leads/ }).click();
                await page.getByLabel("Search leads").fill(lead.name);
                await page.getByRole("button", { name: "Cards", exact: true }).click();
                await page.getByTestId(`convert-lead-${lead.id}`).click();
                await expect(page.getByRole("dialog", { name: "Add as customer", exact: true })).toBeVisible();
                await expect(page.getByLabel("Customer owner", { exact: true })).toHaveValue(owner);
                await expect(page.getByTestId("submit-lead-customer")).toBeEnabled();
                await page.screenshot({ path: testInfo.outputPath(`lead-conversion-${role}-en-390.png`), animations: "disabled" });
                await fillPlannedConversion(page, lead);
                const response = page.waitForResponse((item) => item.url().includes("/rpc/convert_sales_lead_to_customer"));
                // 页面连续提交也只产生一个客户，独立查询同时核对认领结束记录。
                await page.getByTestId("submit-lead-customer").evaluate((button: HTMLElement) => { button.click(); button.click(); });
                await response;
                await expect(page.getByText("Customer saved. The lead has been converted.", { exact: true })).toBeVisible();
                const proof = fixture.confirm(lead);
                expect(proof.owner).toBe(fixture.actor.user_id);
                test.info().annotations.push({ type: "business-receipt", description: JSON.stringify(proof) });
                await page.reload();
                await page.getByRole("button", { name: /^Converted to customers/ }).click();
                await expect(page.getByRole("heading", { name: lead.name, exact: true })).toBeVisible();
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
                const editedNotes = `转换后修改并保留负责人 ${lead.id}`;
                fixture.beginNotesEdit(lead, editedNotes);
                await edit.getByLabel("备注", { exact: true }).fill(editedNotes);
                await edit.getByRole("button", { name: "保存修改", exact: true }).click();
                await expect(edit).toHaveCount(0);
                fixture.confirmNotesEdit(lead);
                await page.reload();
                await page.getByLabel("搜索客户").fill(proof.customer_name);
                await page.getByRole("button", { name: proof.customer_name, exact: true }).filter({ visible: true }).click();
                await expect(page.getByText(editedNotes, { exact: true })).toBeVisible();
                fixture.confirm(lead);
                expect(errors).toEqual([]);
                await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(0);
            });
        });
    }
    test("required fields and duplicate customer name leave the lead active", async ({ page }) => {
        const account = await loginAs(page, "salesman");
        await withSalesLeadConversionFixture(page, account.email, async (fixture) => {
            const lead = fixture.create();
            await page.goto("/salesman/wholesale/leads");
            await open(page, lead);
            await page.getByTestId("lead-customer-name").fill("");
            await expect(page.getByTestId("submit-lead-customer")).toBeDisabled();
            const existing = readLocalPostgresRows("select c.*,c.xmin::text as row_version from public.wholesale_customers c where unique_name='Wholesale Alpha'");
            expect(existing).toHaveLength(1);
            await page.getByTestId("lead-customer-name").fill("Wholesale Alpha");
            await page.getByTestId("lead-customer-contacts").fill("");
            await expect(page.getByTestId("submit-lead-customer")).toBeDisabled();
            await page.getByTestId("lead-customer-contacts").fill("contact@example.test");
            await page.getByTestId("submit-lead-customer").click();
            await expect(page.getByText("这个客户名称已经存在，请核对后调整名称。", { exact: true })).toBeVisible();
            expectUnconverted(lead);
            await expect(page.getByTestId("lead-customer-contacts")).toHaveValue("contact@example.test");
            expect(readLocalPostgresRows("select c.*,c.xmin::text as row_version from public.wholesale_customers c where unique_name='Wholesale Alpha'")).toEqual(existing);
            await page.getByTestId("lead-customer-name").fill(lead.manifest!.customerName);
            await page.getByTestId("submit-lead-customer").click();
            await expect(page.getByText("客户已保存，线索已成为客户。", { exact: true })).toBeVisible();
            fixture.confirm(lead);
        });
    });
    test("expired and reassigned dialogs cannot create customers", async ({ page }) => {
        const account = await loginAs(page, "salesman");
        await withSalesLeadConversionFixture(page, account.email, async (fixture) => {
            const lead = fixture.create();
            await page.goto("/salesman/wholesale/leads");
            await open(page, lead);
            expect(runLocalSupabaseSql(`update public.sales_leads set expires_at=now()-interval '1 second',hard_deadline_at=now()-interval '1 second' where id=${quote(lead.id)} and primary_source_lead_id=${quote(`PT5-LEARNING-${lead.id}`)} returning id;`)).toBe(lead.id);
            expect(readLocalPostgresRows(`select id,expires_at<now() and hard_deadline_at<now() as expired from public.sales_leads where id=${quote(lead.id)}`)).toEqual([{ id: lead.id, expired: true }]);
            await page.getByTestId("submit-lead-customer").click();
            await expect(page.getByText("这条线索已过期或不再由当前账号处理。", { exact: true })).toBeVisible();
            expectUnconverted(lead);
            await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
            const second = fixture.create();
            await open(page, second);
            const newOwner = fixture.otherSalesman();
            runLocalSupabaseSql(`begin;set local request.jwt.claim.sub=${quote(fixture.administrator())};set local role authenticated;
      select public.assign_sales_lead(${quote(second.id)},${quote(newOwner)},'旧弹窗验证');commit;`);
            await page.getByTestId("submit-lead-customer").click();
            await expect(page.getByText("只能将自己当前认领的线索添加为客户。", { exact: true })).toBeVisible();
            expectUnconverted(second);
            expect(readSalesLeadCustomerProof(second.id).lead_owner).toBe(newOwner);
        });
    });
    test("HTTP success with partial_failed and disconnect never display success", async ({ page }) => {
        const account = await loginAs(page, "salesman");
        await withSalesLeadConversionFixture(page, account.email, async (fixture) => {
            const lead = fixture.create();
            await page.goto("/salesman/wholesale/leads");
            await open(page, lead);
            await page.route("**/rpc/convert_sales_lead_to_customer", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "partial_failed" }) }));
            await page.getByTestId("submit-lead-customer").click();
            await expect(page.getByRole("dialog").getByText(waiting, { exact: true })).toBeVisible();
            expectUnconverted(lead);
            await page.unroute("**/rpc/convert_sales_lead_to_customer");
            await page.route("**/rpc/convert_sales_lead_to_customer", (route) => route.abort("internetdisconnected"));
            await page.getByTestId("submit-lead-customer").click();
            await expect(page.getByRole("dialog").getByText(waiting, { exact: true })).toBeVisible();
            await expect(page.getByText("客户已保存，线索已成为客户。", { exact: true })).toHaveCount(0);
            expectUnconverted(lead);
            await page.unroute("**/rpc/convert_sales_lead_to_customer");
            await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
            const second = fixture.create();
            await open(page, second);
            await page.route("**/rpc/convert_sales_lead_to_customer", async (route) => {
                // 在数据库实际提交后断网，模拟业务员收不到回执，也无法立即查询确认的情况。
                const response = await route.fetch();
                expect(response.ok()).toBe(true);
                await page.context().setOffline(true);
                await route.abort("internetdisconnected");
            });
            await page.getByTestId("submit-lead-customer").click();
            await expect(page.getByRole("dialog").getByText(waiting, { exact: true })).toBeVisible();
            fixture.confirm(second);
            await page.context().setOffline(false);
            await page.unroute("**/rpc/convert_sales_lead_to_customer");
            await page.reload();
            await page.getByRole("button", { name: /^已成为客户/ }).click();
            await expect(page.getByRole("heading", { name: second.name, exact: true })).toBeVisible();
        });
    });
    test("wrong authoritative owner is detected, recovery is idempotent, and timeout stays unconfirmed", async ({ page }) => {
        const account = await loginAs(page, "salesman");
        await withSalesLeadConversionFixture(page, account.email, async (fixture) => {
            const lead = fixture.create();
            await page.goto("/salesman/wholesale/leads");
            await open(page, lead);
            await page.route("**/rpc/convert_sales_lead_to_customer", async (route) => {
                const response = await route.fetch();
                fixture.confirm(lead);
                fixture.replaceOwner(lead, fixture.actor.user_id, fixture.otherSalesman());
                await route.fulfill({ response });
            });
            await page.getByTestId("submit-lead-customer").click();
            await expect(page.getByRole("dialog").getByText(waiting, { exact: true })).toBeVisible();
            // 红：真实客户负责人错误时，最终凭证断言必须失败。绿：恢复后同一页面重试仍只有一个客户。
            expect(() => fixture.confirm(lead)).toThrow();
            const first = readSalesLeadCustomerProof(lead.id);
            fixture.replaceOwner(lead, fixture.otherSalesman(), fixture.actor.user_id);
            await page.unroute("**/rpc/convert_sales_lead_to_customer");
            await page.getByTestId("submit-lead-customer").click();
            await expect(page.getByText("客户已保存，线索已成为客户。", { exact: true })).toBeVisible();
            expect(fixture.confirm(lead).customer_id).toBe(first.customer_id);
            const second = fixture.create();
            await open(page, second);
            await page.route("**/wholesale_customers?*", async (route) => {
                // 只拖延保存后的独立确认；数据库写入已完成，页面仍不得据此提前宣告成功。
                await new Promise((resolve) => setTimeout(resolve, 11000));
                await route.continue();
            });
            await page.getByTestId("submit-lead-customer").click();
            await expect(page.getByRole("dialog").getByText(waiting, { exact: true })).toBeVisible({ timeout: 15000 });
            fixture.confirm(second);
            // 等待已进入延迟处理器的请求结束，再移除拦截；否则刷新会提前接管同一个请求。
            await page.unrouteAll({ behavior: "wait" });
            await page.reload();
            await page.getByRole("button", { name: /^已成为客户/ }).click();
            await expect(page.getByRole("heading", { name: second.name, exact: true })).toBeVisible();
        });
    });
});
