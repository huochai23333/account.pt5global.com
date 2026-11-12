import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const clearPath = "**/rpc/clear_wholesale_settlement_release_allocations";

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  const text = (locale === "zh" ? zh : en).UiText;
  const copy = text.components_dashboard_wholesale_wholesale_settlement_release_allocation_dialog;
  const table = text.components_dashboard_wholesale_wholesale_settlement_release_table;
  const section = text.components_dashboard_wholesale_wholesale_settlement_release_section;
  test(`清空结汇分配后以原冲销记录确认终态 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    const releaseId = randomUUID();
    const customerId = randomUUID();
    const firstOrderId = randomUUID();
    const secondOrderId = randomUUID();
    const owner = learningUser.id;
    const name = `Learning settlement ${releaseId}`;
    const read = () => JSON.parse(executeLearningSql(`select json_build_object(
      'release',(select json_build_object('id',id,'status',status,'revision',allocation_revision,
        'customer_id',allocation_customer_id,'amount',release_amount) from public.wholesale_settlement_releases where id='${releaseId}'),
      'allocations',(select coalesce(json_agg(a order by allocation_amount desc),'[]') from
        (select id,order_id,settlement_id,allocation_amount,status,reversed_by_user_id,reversed_at
         from public.wholesale_settlement_release_allocations where release_id='${releaseId}') a),
      'settlements',(select coalesce(json_agg(s order by settlement_amount desc),'[]') from
        (select id,order_id,settlement_amount,settlement_exchange_rate,settlement_rmb_amount
         from public.wholesale_order_settlements where source_settlement_release_id='${releaseId}') s));`));
    // 用人民币夹具验证实际收款与冲销，整条链路无需访问汇率供应商。
    executeLearningSql(`begin;
      insert into public.wholesale_customers(id,unique_name,created_by_user_id,salesman_commission_cohort)
        values ('${customerId}','${name}','${owner}','new');
      insert into public.wholesale_orders(id,order_number,customer_id,created_by_user_id,order_month,ordered_at,customer_payment_amount,customer_payment_currency)
        values ('${firstOrderId}','${name}-1','${customerId}','${owner}',date_trunc('month',now())::date,now()-interval '2 days',60,'CNY'),
          ('${secondOrderId}','${name}-2','${customerId}','${owner}',date_trunc('month',now())::date,now()-interval '1 day',80,'CNY');
      insert into public.wholesale_settlement_releases(id,customer_id,customer_name,release_amount,release_currency,received_on,published_by_user_id)
        values ('${releaseId}','${customerId}','${name}',100,'CNY',(now() at time zone 'Asia/Shanghai')::date,'${owner}');
      commit;`);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let attempts = 0;
    let repairRequests = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/rpc/clear_wholesale_settlement_release_allocations")) attempts += 1;
      if (request.url().endsWith("/rpc/request_settlement_exchange_rate_repair")) repairRequests += 1;
    });
    try {
      await page.route("**/rpc/request_settlement_exchange_rate_repair", (route) => route.abort());
      await page.setViewportSize({ width, height: 900 });
      await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
        await page.keyboard.press("Escape");
      });
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      await page.goto("/admin/wholesale/settlement-releases");
      const search = page.getByRole("textbox", { name: section.attribute006, exact: true });
      await search.fill(name);
      const row = page.getByTestId(`wholesale-settlement-release-row-${releaseId}`);
      const start = row.getByRole("button", { name: table.text010.trim(), exact: true });
      await start.click();
      const allocation = page.getByRole("dialog", { name: copy.startTitle });
      await allocation.getByRole("button", { name: copy.saveAllocations, exact: true }).click();
      await expect(allocation).toBeHidden();
      const before = read();
      expect(before.release).toMatchObject({ id: releaseId, status: "allocated", customer_id: customerId, amount: 100 });
      expect(before.allocations).toHaveLength(2);
      expect(before.settlements).toEqual([
        { id: before.allocations[0].settlement_id, order_id: firstOrderId, settlement_amount: 60, settlement_exchange_rate: 1, settlement_rmb_amount: 60 },
        { id: before.allocations[1].settlement_id, order_id: secondOrderId, settlement_amount: 40, settlement_exchange_rate: 1, settlement_rmb_amount: 40 },
      ]);
      await row.getByRole("button", { name: table.text014.trim(), exact: true }).click();
      const dialog = page.getByRole("dialog", { name: copy.adjustTitle });
      await dialog.getByRole("button", { name: copy.clearAllocations, exact: true }).click();
      const confirm = dialog.getByRole("button", { name: copy.confirmClear, exact: true });
      if (locale === "en") {
        // 先拒绝真正的过期版本，再拦下尚未发送的请求。两次均须保留原业务记录。
        await page.route(clearPath, async (route) => {
          const input = route.request().postDataJSON();
          const result = await route.fetch({ postData: { ...input, p_expected_revision: before.release.revision - 1 } });
          expect((await result.json()).message).toBe("wholesale_settlement_release_revision_conflict");
          await route.fulfill({ response: result });
        }, { times: 1 });
        await confirm.click();
        await expect(dialog.getByRole("alert")).toHaveText(copy.clearRevisionChanged);
        expect(read()).toEqual(before);
        await page.route(clearPath, (route) => route.abort("connectionreset"), { times: 1 });
        await confirm.click();
        await expect(dialog.getByRole("alert")).toHaveText(copy.clearUnconfirmed);
        expect(read()).toEqual(before);
      }
      await page.route(clearPath, async (route) => {
        // 真实事务提交后丢掉响应，用同一个收款及原分配的证据确认结果。
        const result = await route.fetch({ maxRetries: 0 });
        expect(result.ok()).toBe(true);
        expect(read().release.revision).toBe(before.release.revision + 1);
        await route.abort("connectionreset");
      }, { times: 1 });
      await confirm.evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
      });
      await expect.poll(() => read().release.status).toBe("pending");
      await expect(dialog).toBeHidden();
      const after = read();
      expect(after.release).toEqual({ ...before.release, status: "pending", revision: before.release.revision + 1, customer_id: null });
      expect(after.allocations).toEqual(before.allocations.map((item: Record<string, unknown>) => ({
        ...item, settlement_id: null, status: "reversed", reversed_by_user_id: owner, reversed_at: expect.any(String),
      })));
      expect(after.settlements).toEqual([]);
      expect(attempts).toBe(locale === "en" ? 3 : 1);
      expect(repairRequests).toBe(0);
      await page.reload();
      await search.fill(name);
      await expect(start).toBeVisible();
      await expect(row.getByText(table.notAllocated, { exact: true })).toBeVisible();
      await expect(row.getByText(table.status.pending, { exact: true })).toBeVisible();
      await page.getByRole("combobox", { name: section.attribute008, exact: true }).click();
      await page.getByRole("option", { name: table.status.pending, exact: true }).click();
      await expect(row).toBeVisible();
      expect(read()).toEqual(after);
      expect(errors).toEqual([]);
      await row.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("settlement-clear.png"), animations: "disabled" });
      await writeFile(testInfo.outputPath("settlement-clear-receipts.json"), JSON.stringify({ before, after, attempts }, null, 2));
    } finally {
      executeLearningSql(`begin;
        delete from public.wholesale_settlement_release_allocations where release_id='${releaseId}';
        delete from public.wholesale_order_settlements where source_settlement_release_id='${releaseId}' and created_by_user_id='${owner}';
        delete from public.wholesale_settlement_releases where id='${releaseId}' and published_by_user_id='${owner}';
        delete from public.wholesale_orders where id in ('${firstOrderId}','${secondOrderId}') and created_by_user_id='${owner}';
        delete from public.wholesale_customers where id='${customerId}' and created_by_user_id='${owner}';
        commit;`);
      expect(read()).toEqual({ release: null, allocations: [], settlements: [] });
      const remaining = executeLearningSql(`select (select count(*) from public.wholesale_orders where id in ('${firstOrderId}','${secondOrderId}'))+
        (select count(*) from public.wholesale_customers where id='${customerId}');`);
      expect(remaining).toBe("0");
      await writeFile(testInfo.outputPath("settlement-clear-cleanup.json"), JSON.stringify({ releases: 0, allocations: 0, settlements: 0, ordersAndCustomers: 0 }));
    }
  });
}
