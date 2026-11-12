import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { test, expect } from "./fixtures";

for (const [locale, width, role, routeSegment] of [
  ["zh", 1440, "administrator", "admin"],
  ["en", 390, "salesman", "salesman"],
] as const) {
  test.describe(`批发 VIP ${locale}/${width}`, () => {
    test.use({ learningRole: role });
    test("核对开通、续期与中断后的实际记录", async ({ page, learningUser }, testInfo) => {
      const id = randomUUID();
      const name = `Learning VIP ${id}`;
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      if (locale === "en") {
        // 只关闭本次账号的本地公告提示。
        await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
          await page.keyboard.press("Escape");
        });
      }
      const read = () => JSON.parse(executeLearningSql(`
        select json_build_object(
          'membership',(select row_to_json(m) from (
            select id,status,started_at,expires_at,updated_at,created_by_user_id
            from public.wholesale_vip_memberships where customer_id='${id}') m),
          'records',(select coalesce(json_agg(r order by r.created_at),'[]') from (
            select id,operation_type,amount,currency,previous_expires_at,next_expires_at,
              confirmed_by_user_id,created_at,
              case when operation_type='open' then next_expires_at=created_at+interval '1 year'
                else next_expires_at=previous_expires_at+interval '1 year' end as full_year
            from public.wholesale_vip_recharges where customer_id='${id}') r),
          'commission_count',(select count(*) from public.wholesale_commissions where customer_id='${id}'));
      `));
      const initial = { membership: null, records: [], commission_count: 0 };
      executeLearningSql(`insert into public.wholesale_customers
        (id,unique_name,created_by_user_id,assigned_sales_user_id,salesman_commission_cohort)
        values ('${id}','${name}','${learningUser.id}','${learningUser.id}','new');`);
      try {
        expect(read()).toEqual(initial);
        await loginLearningUser(page, learningUser);
        await page.goto(`/${routeSegment}/wholesale/vip`);
        const search = page.getByPlaceholder(locale === "zh" ? "输入姓名、联系方式或城市" : "Name, contact, or city");
        const dialog = page.getByRole("dialog");
        const open = page.getByRole("button", { name: locale === "zh" ? "开通VIP" : "Open VIP", exact: true });
        const renew = page.getByRole("button", { name: locale === "zh" ? "续费一年" : "Renew One Year", exact: true });
        const confirmOpen = dialog.getByRole("button", { name: locale === "zh" ? "确认开通" : "Confirm Opening", exact: true });
        const confirmRenew = dialog.getByRole("button", { name: locale === "zh" ? "确认续费" : "Confirm Renewal", exact: true });
        const records = page.getByRole("button", { name: new RegExp(`${name}.*`) });
        const unconfirmed = locale === "zh" ? "VIP状态还未确认" : "VIP status has not been confirmed";
        await search.fill(id);
        await expect(records).toContainText(locale === "zh" ? "未填写联系方式" : "No contact details provided");
        await records.click();
        await expect(dialog).toContainText(locale === "zh" ? "暂无开通或续费记录" : "No opening or renewal records yet");
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);

        // 接口成功状态但没有业务确认时，数据库保持原样，页面不能显示已开通。
        await page.route("**/api/business-vip", (route) => route.fulfill({ json: { ok: false } }), { times: 1 });
        await open.click();
        await confirmOpen.click();
        await expect(dialog).toContainText(unconfirmed);
        expect(read()).toEqual(initial);
        await expect(confirmOpen).toBeDisabled();
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await open.click();
        await expect(confirmOpen).toBeDisabled();
        await page.reload();
        await search.fill(id);

        let release!: () => void;
        const allowRequest = new Promise<void>((resolve) => { release = resolve; });
        let requests = 0;
        const trackOpen = async (route: import("@playwright/test").Route) => {
          requests += 1;
          await allowRequest;
          await route.continue();
        };
        await page.route("**/api/business-vip", trackOpen);
        try {
          await open.click();
          // 同一浏览器事件循环内触发两次，不能依赖下次 React 渲染才生效的 disabled。
          await confirmOpen.evaluate((element: HTMLButtonElement) => { element.click(); element.click(); });
          await expect.poll(() => requests).toBe(1);
          await expect(confirmOpen).toBeDisabled();
        } finally {
          release();
        }
        await expect(dialog).toHaveCount(0);
        await expect(renew).toBeVisible();
        expect(requests).toBe(1);
        await page.unroute("**/api/business-vip", trackOpen);
        const opened = read();
        expect(opened.records).toHaveLength(1);
        expect(opened.records[0]).toMatchObject({
          operation_type: "open", amount: 200, currency: "USD", previous_expires_at: null,
          confirmed_by_user_id: learningUser.id, full_year: true,
        });
        expect(opened.records[0].id).toBeTruthy();
        expect(opened.membership).toMatchObject({
          status: "active", expires_at: opened.records[0].next_expires_at, created_by_user_id: learningUser.id,
        });
        expect(opened.commission_count).toBe(0);

        // 续期由真实路由完成，随后只在浏览器边界丢弃响应。
        await page.route("**/api/business-vip", async (route) => {
          const result = await route.fetch({ maxRetries: 0 });
          expect(result.ok()).toBe(true);
          await route.abort("connectionreset");
        }, { times: 1 });
        await renew.click();
        await confirmRenew.click();
        await expect(dialog).toContainText(unconfirmed);
        await expect(confirmRenew).toBeDisabled();
        const renewed = read();
        expect(renewed.records).toHaveLength(2);
        expect(renewed.records[1]).toMatchObject({
          operation_type: "renew", amount: 200, currency: "USD",
          previous_expires_at: opened.membership.expires_at,
          confirmed_by_user_id: learningUser.id, full_year: true,
        });
        expect(renewed.records[1].id).toBeTruthy();
        expect(renewed.membership).toMatchObject({
          id: opened.membership.id, status: "active", started_at: opened.membership.started_at,
          expires_at: renewed.records[1].next_expires_at,
        });
        expect(renewed.membership.updated_at).not.toBe(opened.membership.updated_at);
        expect(renewed.commission_count).toBe(0);

        await page.reload();
        await search.fill(id);
        await records.click();
        await expect(dialog.locator("article")).toHaveCount(2);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await expect(dialog).toHaveCSS("opacity", "1");
        await page.screenshot({ path: testInfo.outputPath(`vip-${locale}-${width}.png`) });
        expect(read()).toEqual(renewed);
        expect(errors).toEqual([]);
        await writeFile(testInfo.outputPath("vip-receipts.json"), JSON.stringify({ opened, renewed }, null, 2));
      } finally {
        executeLearningSql(`begin;
          delete from public.wholesale_vip_recharges where customer_id='${id}' and confirmed_by_user_id='${learningUser.id}';
          delete from public.wholesale_vip_memberships where customer_id='${id}' and created_by_user_id='${learningUser.id}';
          delete from public.wholesale_customers where id='${id}' and unique_name='${name}' and created_by_user_id='${learningUser.id}';
          commit;`);
        expect(read()).toEqual(initial);
        expect(executeLearningSql(`select count(*) from public.wholesale_customers where id='${id}';`)).toBe("0");
      }
    });
  });
}

test.describe("批发 VIP 的权限边界", () => {
  test.use({ learningRole: "client" });

  test("客户不能打开 VIP 管理，也不能直接调用开通接口", async ({ page, learningUser }) => {
    const id = randomUUID();
    const name = `Learning VIP denied ${id}`;
    executeLearningSql(`insert into public.wholesale_customers
      (id,unique_name,created_by_user_id,salesman_commission_cohort)
      values ('${id}','${name}','${learningUser.id}','new');`);
    try {
      await page.context().addCookies([{ name: "bs-locale", value: "zh", url: "http://localhost:3000" }]);
      await loginLearningUser(page, learningUser);
      await page.goto("/client/wholesale/vip");
      await expect(page).toHaveURL(/\/access-limited$/);

      // 页面没有写入口，因此直接请求只用于验证服务端的拒绝路径。
      const payload = { action: "open", business: "wholesale", operation: "manageWholesale", targetId: id };
      const denied = await page.request.post("/api/business-vip", { data: payload });
      expect(denied.status()).toBe(403);
      expect(await denied.json()).toEqual({ error: "forbidden" });
      const disabled = await page.request.post("/api/business-vip", { data: { ...payload, business: "tourism" } });
      expect(disabled.status()).toBe(503);
      expect(await disabled.json()).toEqual({ error: "businessUnavailable" });
      expect(executeLearningSql(`select
        (select count(*) from public.wholesale_vip_memberships where customer_id='${id}')
        + (select count(*) from public.wholesale_vip_recharges where customer_id='${id}');`)).toBe("0");
    } finally {
      executeLearningSql(`delete from public.wholesale_customers
        where id='${id}' and unique_name='${name}' and created_by_user_id='${learningUser.id}';`);
      expect(executeLearningSql(`select count(*) from public.wholesale_customers where id='${id}';`)).toBe("0");
    }
  });
});
