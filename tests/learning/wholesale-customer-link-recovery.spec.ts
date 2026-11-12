import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { createLearningUser, executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const linkRoute = "**/rpc/link_wholesale_customer_registered_user";

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  test(`合并账号断线后重试保留同一档案与授权版本 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    page.setDefaultTimeout(10_000);
    const messages = locale === "zh" ? zh : en;
    const details = messages.UiText.components_dashboard_wholesale_wholesale_customer_details;
    const id = randomUUID();
    const name = `Learning link ${id}`;
    const target = await createLearningUser("client");
    const read = () => JSON.parse(executeLearningSql(`
      select json_build_object(
        'customer', (select row_to_json(c) from (select id,registered_user_id,customer_kind,edit_revision,
          xmin::text as version from public.wholesale_customers where id='${id}') c),
        'access', (select row_to_json(a) from (select user_id,is_enabled,granted_by_user_id,updated_at,
          xmin::text as version from public.user_workspace_business_access
          where user_id='${target.id}' and business_key='wholesale') a)
      );`));
    try {
      // 注册流程会准备一份空档案。只撤掉目标账号本次自建的空档案，让它成为可合并候选。
      executeLearningSql(`begin;
        delete from public.wholesale_customers where registered_user_id='${target.id}' and created_by_user_id='${target.id}';
        insert into public.wholesale_customers(id,unique_name,created_by_user_id,salesman_commission_cohort)
          values ('${id}','${name}','${learningUser.id}','new');
        commit;`);
      expect(executeLearningSql(`select count(*) from public.wholesale_customers where registered_user_id='${target.id}';`)).toBe("0");
      const initial = read();
      await page.setViewportSize({ width, height: 900 });
      await page.addLocatorHandler(
        page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }),
        async () => { await page.keyboard.press("Escape"); },
      );
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      const open = async () => {
        await page.goto("/admin/wholesale/customers");
        await page.getByPlaceholder(messages.UiText.components_dashboard_wholesale_wholesale_people_tabs.attribute003).fill(name);
        await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
        return page.getByRole("dialog", { name, exact: true });
      };
      const profile = await open();
      const alert = profile.getByRole("alert");
      const account = profile.getByRole("combobox", { name: details.attribute001, exact: true });
      const submit = profile.getByRole("button", { name: details.text006.trim(), exact: true });
      await account.click();
      await expect(account).toHaveAttribute("aria-controls", /.+/);
      const listId = await account.getAttribute("aria-controls");
      await page.locator(`[id=${JSON.stringify(listId)}]`).getByRole("option", { name: new RegExp(target.email.replaceAll(".", "\\.")) }).click();

      // 请求没到数据库时不能出现已合并提示，原档案和授权保持原样。
      await page.route(linkRoute, (route) => route.abort("connectionreset"), { times: 1 });
      await submit.click();
      await expect(alert).toHaveText(messages.WholesaleBusiness.customerWrite.linkUnconfirmed);
      await expect(submit).toBeEnabled();
      expect(read()).toEqual(initial);

      // 实际执行数据库写入，仅丢弃返回给浏览器的响应。
      await page.route(linkRoute, async (route) => {
        const response = await route.fetch({ maxRetries: 0 });
        expect(response.ok()).toBe(true);
        await route.abort("connectionreset");
      }, { times: 1 });
      await submit.click();
      await expect.poll(() => read().customer.registered_user_id).toBe(target.id);
      const committed = read();
      expect(committed.customer).toMatchObject({ id, customer_kind: "registered_account", edit_revision: initial.customer.edit_revision + 1 });
      expect(committed.access).toMatchObject({ user_id: target.id, is_enabled: true, granted_by_user_id: learningUser.id });
      await expect(submit).toBeEnabled();
      await expect(alert).toHaveText(messages.WholesaleBusiness.customerWrite.linkUnconfirmed);
      await expect(alert).toBeInViewport({ ratio: 1 });
      await expect(profile.locator('[name="registered_user_id"]')).toHaveValue(target.id);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("customer-link-unconfirmed.png"), animations: "disabled" });

      // 仍在原表单上重试相同档案与账号，已完成的记录应原样返回。
      await submit.click();
      await expect(profile.getByText(details.text003.trim(), { exact: true })).toBeVisible();
      expect(read()).toEqual(committed);
      const refreshed = await open();
      await expect(refreshed.getByText(details.text003.trim(), { exact: true })).toBeVisible();
      await expect(refreshed.getByRole("combobox", { name: details.attribute001 })).toHaveCount(0);
      expect(read()).toEqual(committed);
      // 即使是已绑定的本人账号，数据库也不能让客户走员工的合并确认入口。
      executeLearningSql(`begin;
        set local role authenticated;
        set local "request.jwt.claim.sub" = '${target.id}';
        do $$ begin
          perform public.link_wholesale_customer_registered_user('${id}','${target.id}');
          raise exception '客户合并权限断言未触发';
        exception when raise_exception then
          if sqlerrm <> 'wholesale_customer_link_forbidden' then raise; end if;
        end $$;
        rollback;`);
      expect(read()).toEqual(committed);
      await writeFile(testInfo.outputPath("customer-link-receipt.json"), JSON.stringify({ initial, committed }, null, 2));
    } finally {
      executeLearningSql(`delete from public.wholesale_customers where id='${id}' and created_by_user_id='${learningUser.id}';`);
      expect(read().customer).toBeNull();
      await target.cleanup();
      expect(read().access).toBeNull();
    }
  });
}
