import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  const copy = (locale === "zh" ? zh : en).WholesaleBusiness.logisticsArchive;
  test(`物流按日期拆分店铺归属后独立核对两个区间 ${locale}/${width}`, async ({ page, learningUser, learningStaff }, testInfo) => {
    const oldId = randomUUID();
    const customerId = randomUUID();
    const store = `Learning store ${oldId}`;
    const customer = `Learning customer ${customerId}`;
    const splitDate = executeLearningSql("select ((now() at time zone 'Asia/Shanghai')::date-3)::text;");
    const splitTime = new Date(`${splitDate}T00:00:00+08:00`).toISOString();
    const read = () => JSON.parse(executeLearningSql(`select coalesce(json_agg(row order by effective_from nulls first),'[]') from (
      select id,sales_user_id,customer_id,effective_from,effective_to,updated_by_user_id
      from public.wholesale_logistics_store_assignments where store_name='${store}'
    ) row;`));
    const readArchiveOwners = () => JSON.parse(executeLearningSql(`select json_object_agg(r.package_number,a.customer_id)
      from public.wholesale_logistics_records r join public.wholesale_logistics_store_assignments a
        on a.store_name_normalized=r.store_name_normalized and a.effective_range @> r.order_created_at
      where r.store_name='${store}';`));
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // 只准备本次测试的客户、已有归属和跨日期包裹，拆分必须从页面提交。
    executeLearningSql(`begin;
      insert into public.wholesale_customers(id,unique_name,created_by_user_id) values ('${customerId}','${customer}','${learningUser.id}');
      insert into public.wholesale_logistics_store_assignments(id,store_name,sales_user_id,created_by_user_id)
        values ('${oldId}','${store}','${learningStaff.id}','${learningUser.id}');
      insert into public.wholesale_logistics_records(source_order_id,package_number,store_name,order_created_at)
        values (813701,'${oldId}-before','${store}','${splitTime}'::timestamptz-interval '1 second'),
          (813702,'${oldId}-after','${store}','${splitTime}'::timestamptz);
      commit;`);
    try {
      // 页面会主动请求同步。此用例仅验证归属，拦下该请求以保护本地来源边界。
      await page.route("**/functions/v1/wholesale-logistics-sync", (route) => route.abort("connectionreset"));
      await page.setViewportSize({ width, height: 900 });
      await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
        await page.keyboard.press("Escape");
      });
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      await page.goto("/admin/wholesale/logistics");
      const search = page.getByPlaceholder(copy.filters.searchPlaceholder, { exact: true });
      const archiveRow = (suffix: string) => page.locator(width < 1024 ? "article" : "tr")
        .filter({ hasText: `${oldId}-${suffix}`, visible: true });
      await search.fill(oldId);
      await expect(archiveRow("after")).toBeVisible();
      await expect(page.getByText(copy.sourceRefreshDeferred, { exact: true })).toBeVisible();
      const settings = page.getByRole("button", { name: copy.actions.settings, exact: true });
      const dialog = page.getByRole("dialog", { name: copy.assignments.title });
      await settings.click();
      const history = dialog.locator("article").filter({ hasText: store });
      await history.getByRole("button", { name: copy.assignments.adjust, exact: true }).click();
      await dialog.getByRole("combobox", { name: copy.assignments.customer, exact: true }).click();
      await page.getByRole("option", { name: customer, exact: true }).click();
      await dialog.getByRole("radio", { name: copy.assignments.fromDate }).check();
      const date = dialog.getByRole("textbox", { name: copy.assignments.fromDate, exact: true });
      await date.fill(splitDate);
      await date.press("Tab");
      const save = dialog.getByRole("button", { name: copy.assignments.save, exact: true });
      let submissions = 0;
      page.on("request", (request) => {
        if (request.url().endsWith("/rpc/change_wholesale_logistics_store_assignment")) submissions += 1;
      });
      if (locale === "en") {
        // 数据库完成后切断独立读回，页面只能提示核对，刷新再以实际区间为准。
        await page.route(/\/wholesale_logistics_store_assignments\?.*id=in\./,
          (route) => route.abort("connectionreset"), { times: 1 });
      }
      await expect(save).toBeEnabled();
      await save.evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
      });
      await expect.poll(read).toHaveLength(2);
      if (locale === "zh") {
        // 旧实现已完成数据库拆分，但把新编号当作失败，编辑弹窗会一直保留。
        await expect(dialog.getByRole("heading", { name: copy.assignments.newAssignment, exact: true })).toBeVisible();
        await expect(dialog.getByText(copy.assignmentFeedback.changed, { exact: true })).toBeVisible();
        await expect(history).toHaveCount(2);
        await expect(history.filter({ hasText: customer })).toHaveCount(1);
      } else {
        await expect(dialog.getByText(copy.assignmentFeedback.unconfirmed, { exact: true })).toBeVisible();
        await expect(dialog.getByText(copy.assignmentFeedback.changed, { exact: true })).toHaveCount(0);
      }
      const [before, after] = read();
      expect(before).toMatchObject({ id: oldId, sales_user_id: learningStaff.id, customer_id: null, effective_from: null, updated_by_user_id: learningUser.id });
      expect(after).toMatchObject({ sales_user_id: learningStaff.id, customer_id: customerId, effective_to: null, updated_by_user_id: learningUser.id });
      expect(after.id).not.toBe(before.id);
      expect(new Date(before.effective_to).toISOString()).toBe(splitTime);
      expect(new Date(after.effective_from).toISOString()).toBe(splitTime);
      expect(readArchiveOwners()).toEqual({ [`${oldId}-before`]: null, [`${oldId}-after`]: customerId });
      await page.reload();
      await search.fill(oldId);
      await expect(archiveRow("before")).toContainText(copy.fallbacks.noCustomer);
      await expect(archiveRow("after")).toContainText(customer);
      await settings.click();
      await expect(history).toHaveCount(2);
      await expect(history.filter({ hasText: customer })).toHaveCount(1);
      expect(read()).toEqual([before, after]);
      expect(submissions).toBe(1);
      expect(errors).toEqual([]);
      await expect(dialog).toHaveCSS("opacity", "1");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("logistics-intervals.png"), animations: "disabled" });
      let confirmedInPlace = null;
      if (locale === "zh") {
        // 调整整个新区间仍要核对原编号，且不能触碰相邻的历史区间。
        await history.filter({ hasText: customer }).getByRole("button", { name: copy.assignments.adjust, exact: true }).click();
        await dialog.getByRole("combobox", { name: copy.assignments.customer, exact: true }).click();
        await page.getByRole("option", { name: copy.assignments.noCustomer, exact: true }).click();
        await save.click();
        await expect(dialog.getByText(copy.assignmentFeedback.changed, { exact: true })).toBeVisible();
        confirmedInPlace = read();
        expect(confirmedInPlace).toEqual([before, { ...after, customer_id: null }]);
        // 尝试从旧区间的结束时刻拆分，真实数据库必须拒绝且保留两条记录。
        await history.filter({ hasText: copy.assignments.allHistory }).getByRole("button", { name: copy.assignments.adjust, exact: true }).click();
        await dialog.getByRole("radio", { name: copy.assignments.fromDate }).check();
        await date.fill(splitDate);
        await date.press("Tab");
        await save.click();
        await expect(dialog.getByText(copy.assignmentFeedback.dateOutside, { exact: true })).toBeVisible();
        expect(read()).toEqual(confirmedInPlace);
        expect(submissions).toBe(3);
      }
      await writeFile(testInfo.outputPath("logistics-intervals.json"), JSON.stringify({ before, after, splitTime, confirmedInPlace }, null, 2));
    } finally {
      executeLearningSql(`begin;
        delete from public.wholesale_logistics_records where store_name='${store}' and package_number in ('${oldId}-before','${oldId}-after');
        delete from public.wholesale_logistics_store_assignments where store_name='${store}' and sales_user_id='${learningStaff.id}' and created_by_user_id='${learningUser.id}';
        delete from public.wholesale_customers where id='${customerId}' and created_by_user_id='${learningUser.id}';
        commit;`);
      expect(read()).toEqual([]);
      const remaining = executeLearningSql(`select (select count(*) from public.wholesale_logistics_records where store_name='${store}')+
        (select count(*) from public.wholesale_customers where id='${customerId}');`);
      expect(remaining).toBe("0");
      await writeFile(testInfo.outputPath("logistics-cleanup.json"), JSON.stringify({ assignments: 0, rowsAndCustomers: 0 }));
    }
  });
}
