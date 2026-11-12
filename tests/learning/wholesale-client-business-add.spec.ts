import { writeFile } from "node:fs/promises";
import type { Page } from "@playwright/test";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { createLearningUser, executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const directoryPath = "/admin/wholesale/customers";
const addRoute = "**/rpc/admin_add_client_to_business";

function businessReceipt(id: string) {
  return JSON.parse(executeLearningSql(`select json_build_object(
    'customer',(select json_build_object('id',id,'version',xmin::text,'name',unique_name,'kind',customer_kind)
      from public.wholesale_customers where registered_user_id='${id}'),
    'access',(select json_build_object('enabled',is_enabled,'version',xmin::text,'grantor',granted_by_user_id,'updatedAt',updated_at)
      from public.user_workspace_business_access where user_id='${id}' and business_key='wholesale'),
    'archiveCount',(select count(*) from public.document_archives a join public.wholesale_customers c on c.id=a.customer_id
      where c.registered_user_id='${id}'));`));
}

function addDialog(page: Page, copy: typeof en.ClientBusinessAccess) {
  const dialog = page.getByRole("dialog", { name: copy.title.replace("{business}", copy.businesses.wholesale) });
  return {
    dialog,
    alert: dialog.getByRole("alert"),
    submit: dialog.getByRole("button", { name: copy.add, exact: true }),
    async search(email: string) {
      await page.getByRole("button", { name: copy.add, exact: true }).click();
      await dialog.getByPlaceholder(copy.searchPlaceholder).fill(email);
    },
  };
}

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  const messages = locale === "zh" ? zh : en;
  const copy = messages.ClientBusinessAccess;
  for (const hasExistingCustomer of [true, false]) {
    test(`独立开通批发业务 ${hasExistingCustomer ? "恢复原档案" : "断线后重复提交"} ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
      const target = await createLearningUser("client");
      const read = () => businessReceipt(target.id);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        // 两种来源都应从专属注册账号的真实档案和授权出发，夹具仅修改这个账号。
        executeLearningSql(`update public.user_workspace_business_access set is_enabled=false
          where user_id='${target.id}' and business_key='wholesale';`);
        if (!hasExistingCustomer) executeLearningSql(`delete from public.wholesale_customers
          where registered_user_id='${target.id}' and created_by_user_id='${target.id}';`);
        const initial = read();
        expect(initial.access.enabled).toBe(false);
        expect(Boolean(initial.customer)).toBe(hasExistingCustomer);
        await page.setViewportSize({ width, height: 900 });
        await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
          await page.keyboard.press("Escape");
        });
        await loginLearningUser(page, learningUser);
        await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
        await page.goto(directoryPath);
        const form = addDialog(page, copy);
        await form.search(target.email);
        await expect(form.submit).toBeEnabled();
        if (!hasExistingCustomer) {
          // 断线前未写入、空回执和与所选客户不符的编号都应保留确认框及搜索。
          await page.route(addRoute, (route) => route.abort("connectionreset"), { times: 1 });
          await form.submit.click();
          await expect(form.alert).toHaveText(copy.unconfirmed);
          expect(read()).toEqual(initial);
          await page.route(addRoute, (route) => route.fulfill({ json: null }), { times: 1 });
          await form.submit.click();
          await expect(form.alert).toHaveText(copy.unconfirmed);
          expect(read()).toEqual(initial);
          await page.route(addRoute, (route) => route.fulfill({ json: [{ business_key: "wholesale", wholesale_customer_id: target.id }] }), { times: 1 });
          await form.submit.click();
          await expect(form.alert).toHaveText(copy.unconfirmed);
          expect(read()).toEqual(initial);

          // 只丢掉提交后的浏览器响应，重试前先读回实际授权版本。
          await page.route(addRoute, async (route) => {
            const response = await route.fetch({ maxRetries: 0 });
            expect(response.ok()).toBe(true);
            await route.abort("connectionreset");
          }, { times: 1 });
          await form.submit.click();
          await expect.poll(() => read().access.enabled).toBe(true);
          const committed = read();
          await expect(form.alert).toHaveText(copy.unconfirmed);
          await expect(form.alert).toBeInViewport({ ratio: 1 });
          await expect(form.dialog.getByPlaceholder(copy.searchPlaceholder)).toHaveValue(target.email);
          await page.screenshot({ path: testInfo.outputPath("client-business-unconfirmed.png"), animations: "disabled" });
          await form.submit.click();
          await expect(form.dialog).toHaveCount(0);
          expect(read()).toEqual(committed);
        } else {
          await form.submit.click();
          await expect(form.dialog).toHaveCount(0);
          expect(read().customer).toEqual(initial.customer);
        }
        const final = read();
        expect(final).toMatchObject({
          customer: { kind: "registered_account" },
          access: { enabled: true, grantor: learningUser.id },
          archiveCount: 1,
        });
        // 即使是目标本人，也必须由管理员开通；用同一账号的数据库角色独立核对拒绝。
        executeLearningSql(`begin;
          set local role authenticated;
          set local "request.jwt.claim.sub" = '${target.id}';
          do $$ begin
            perform public.admin_add_client_to_business('${target.id}','wholesale');
            raise exception '客户开通权限断言未触发';
          exception when raise_exception then
            if sqlerrm <> 'admin_customer_business_forbidden' then raise; end if;
          end $$;
          rollback;`);
        expect(read()).toEqual(final);
        await page.reload();
        await form.search(target.email);
        await expect(form.submit).toHaveCount(0);
        await expect(form.dialog.getByText(copy.empty, { exact: true })).toBeVisible();
        await page.keyboard.press("Escape");
        await page.getByPlaceholder(messages.UiText.components_dashboard_wholesale_wholesale_people_tabs.attribute003).fill(final.customer.name);
        await expect(page.getByRole("button", { name: new RegExp(`^${final.customer.name}`) })).toBeVisible();
        expect(read()).toEqual(final);
        expect(errors).toEqual([]);
        await writeFile(testInfo.outputPath("client-business-receipt.json"), JSON.stringify({ initial, final }, null, 2));
      } finally {
        executeLearningSql(`delete from public.wholesale_customers where registered_user_id='${target.id}'
          and created_by_user_id in ('${target.id}','${learningUser.id}');`);
        const cleanup = await target.cleanup();
        expect(read()).toEqual({ customer: null, access: null, archiveCount: 0 });
        await writeFile(testInfo.outputPath("client-business-cleanup.json"), JSON.stringify(cleanup));
      }
    });
  }
}
