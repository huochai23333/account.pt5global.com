import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  const text = (locale === "zh" ? zh : en).UiText;
  const records = text.components_dashboard_wholesale_wholesale_commission_records;
  const filters = text.components_dashboard_wholesale_wholesale_commission_section;
  const feedback = (locale === "zh" ? zh : en).WholesaleBusiness.commissionBoards;
  test(`批发提成重复提交与结算回执 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    const id = randomUUID();
    const orderId = randomUUID();
    const customerId = randomUUID();
    const name = `Learning commission ${orderId.slice(0, 8)}`;
    const owner = learningUser.id;
    const read = () => JSON.parse(executeLearningSql(`select coalesce((select row_to_json(r) from (
      select id, order_id, status, settled_at, settled_by_user_id, commission_amount_rmb, xmin::text as version
      from public.wholesale_commissions where id='${id}'
    ) r), 'null'::json);`));
    const target = new RegExp(`/wholesale_commissions\\?.*id=eq\\.${id}`);
    const errors: string[] = [];
    let writes = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (target.test(request.url()) && request.method() === "PATCH") writes += 1;
    });
    try {
      // 夹具模拟数据库已经计算的提成。实际结算只能从浏览器点击。
      executeLearningSql(`begin;
        insert into public.wholesale_customers(id,unique_name,created_by_user_id,salesman_commission_cohort)
          values ('${customerId}','${name}','${owner}','new');
        insert into public.wholesale_orders(id,order_number,customer_id,created_by_user_id,order_month,ordered_at,customer_payment_amount,customer_payment_currency)
          values ('${orderId}','${name}','${customerId}','${owner}',date_trunc('month',now())::date,now(),100,'CNY');
        insert into public.wholesale_commissions(id,order_id,customer_id,beneficiary_user_id,status,commission_amount_rmb,parameter_version_id)
          select '${id}',id,'${customerId}','${owner}','pending',10,salesman_commission_parameter_version_id
          from public.wholesale_orders where id='${orderId}'
          on conflict (order_id) do update set id=excluded.id,beneficiary_user_id=excluded.beneficiary_user_id,
            customer_id=excluded.customer_id,status=excluded.status,commission_amount_rmb=excluded.commission_amount_rmb;
        commit;`);
      const before = read();
      expect(before).toMatchObject({ id, order_id: orderId, status: "pending", settled_at: null, commission_amount_rmb: 10 });
      await page.setViewportSize({ width, height: 900 });
      await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
        await page.keyboard.press("Escape");
      });
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      await page.goto("/admin/wholesale/commission?board=salesman");
      const board = page.locator('[data-commission-board="salesman"]');
      const search = board.getByPlaceholder(filters.attribute005);
      await search.fill(name);
      const row = board.locator("tr:visible, article:visible").filter({ hasText: name });
      const settle = row.getByRole("button", { name: records.text013.trim(), exact: true });
      await expect(settle).toBeEnabled();
      await page.route(target, async (route) => {
        if (route.request().method() === "GET" && locale === "zh") {
          await route.abort("connectionreset");
          return;
        }
        if (route.request().method() === "PATCH" && writes === 1) {
          const response = await route.fetch({ maxRetries: 0 });
          expect(response.ok()).toBe(true);
          expect(read().status).toBe("settled");
          await route.abort("connectionreset");
          return;
        }
        await route.continue();
      });
      await settle.evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
      });
      await expect.poll(() => read().status).toBe("settled");
      const committed = read();
      expect(committed.version).not.toBe(before.version);
      expect(committed).toMatchObject({ id, order_id: orderId, commission_amount_rmb: 10, settled_at: expect.any(String) });
      expect(writes).toBe(1);
      if (locale === "zh") {
        await expect(page.getByText(feedback.settlementUnconfirmed, { exact: true })).toBeVisible({ timeout: 25_000 });
        await expect(settle).toBeEnabled();
        await page.unroute(target);
        const retry = page.waitForResponse((response) => target.test(response.url()) && response.request().method() === "PATCH");
        await settle.click();
        await retry;
        expect(read(), "重试不能改写已结算时间或版本").toEqual(committed);
        await expect(page.getByText(feedback.settlementChanged, { exact: true })).toBeVisible();
        await expect(page.getByText(feedback.settlementSaved, { exact: true })).toHaveCount(0);
      } else {
        await expect(page.getByText(feedback.settlementSaved, { exact: true })).toBeVisible();
        await expect(settle).toBeDisabled();
      }
      await page.reload();
      await search.fill(name);
      await expect(settle).toBeDisabled();
      await expect(row.getByText(filters.text005.trim(), { exact: true })).toBeVisible();
      expect(read()).toEqual(committed);
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await row.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("commission.png"), animations: "disabled" });
      await writeFile(testInfo.outputPath("commission-receipt.json"), JSON.stringify({ before, committed, writes }, null, 2));
    } finally {
      executeLearningSql(`begin;
        delete from public.wholesale_orders where id='${orderId}' and created_by_user_id='${owner}';
        delete from public.wholesale_customers where id='${customerId}' and created_by_user_id='${owner}';
        commit;`);
      expect(read()).toBeNull();
      expect(executeLearningSql(`select (select count(*) from public.wholesale_orders where id='${orderId}')+
        (select count(*) from public.wholesale_customers where id='${customerId}');`)).toBe("0");
      await writeFile(testInfo.outputPath("commission-cleanup.json"), JSON.stringify({ commissions: 0, orders: 0, customers: 0 }));
    }
  });
}

test.describe("客户提成权限", () => {
  test.use({ learningRole: "client" });
  test("业务员提成标签不会向客户挂载，刷新后保持推荐佣金范围", async ({ page, learningUser }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
      await page.keyboard.press("Escape");
    });
    await loginLearningUser(page, learningUser);
    for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
      const messages = locale === "zh" ? zh : en;
      const records = messages.UiText.components_dashboard_wholesale_wholesale_commission_records;
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      await page.setViewportSize({ width, height: 900 });
      // 刻意在地址中要求内部标签，权限仍应以服务端允许范围为准。
      await page.goto("/client/wholesale/commission?board=salesman");
      const expectReferralOnly = async () => {
        await expect(page.locator('[data-commission-board="referrals"]')).toBeVisible();
        await expect(page.locator('[data-commission-board="salesman"]')).toHaveCount(0);
        await expect(page.getByRole("button", { name: records.text013.trim(), exact: true })).toHaveCount(0);
      };
      await expectReferralOnly();
      await page.reload();
      await expectReferralOnly();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
});
