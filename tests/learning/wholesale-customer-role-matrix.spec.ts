import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

import type { AppRole } from "../../lib/auth-routing";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { createLearningUser, executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

// 把路由、档案写入及账号关联合在一张验收表里，业务入口与单项权限分开验证。
const scenarios = [
  { role: "administrator", access: "record", locale: "zh", width: 1440 },
  { role: "salesman", access: "record", locale: "en", width: 390 },
  { role: "finance", access: "link", locale: "zh", width: 1440 },
  { role: "finance", access: "link", locale: "en", width: 390 },
  { role: "manager", access: "section-denied", locale: "zh", width: 1440 },
  { role: "operator", access: "section-denied", locale: "en", width: 390 },
  { role: "recruiter", access: "section-denied", locale: "zh", width: 1440 },
  { role: "client", access: "section-denied", locale: "en", width: 390 },
  { role: "promoter", access: "business-denied", locale: "zh", width: 1440 },
] as const satisfies ReadonlyArray<{
  role: AppRole;
  access: "record" | "link" | "section-denied" | "business-denied";
  locale: "zh" | "en";
  width: number;
}>;

function queryAsUser(userId: string, sql: string) {
  // 独立于浏览器核对真实角色规则，断言结束后回滚；用户编号来自本次 Auth 夹具。
  return executeLearningSql(`begin;
    set local role authenticated;
    set local "request.jwt.claim.role" = 'authenticated';
    set local "request.jwt.claim.sub" = '${userId}';
    ${sql}
    rollback;`);
}

for (const { role, access, locale, width } of scenarios) {
  test.describe(`${role} ${locale}/${width}`, () => {
    test.use({ learningRole: role });

    test("客户档案入口与删除权限一致", async ({ page, learningUser }, testInfo) => {
      const messages = (locale === "zh" ? zh : en).UiText;
      const details = messages.components_dashboard_wholesale_wholesale_customer_details;
      const deletion = messages.components_dashboard_wholesale_wholesale_customer_delete_dialog;
      const heading = messages.components_dashboard_wholesale_wholesale_customers_section.attribute003;
      const createLabel = messages.components_dashboard_wholesale_wholesale_customers_section.text001.trim();
      const id = randomUUID();
      const name = `Learning customer role ${id}`;
      const actorId = learningUser.id;
      const read = () => JSON.parse(executeLearningSql(`select json_build_object(
        'customer',(select json_build_object('id',id,'version',xmin::text,'registeredUserId',registered_user_id,'kind',customer_kind)
          from public.wholesale_customers where id='${id}'),
        'archiveCount',(select count(*) from public.document_archives where customer_id='${id}'));`));
      const empty = { customer: null, archiveCount: 0 };
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let target: Awaited<ReturnType<typeof createLearningUser>> | undefined;
      try {
        // 夹具无负责人，业务员删除也必须通过实际的跨档案协作规则。
        executeLearningSql(`insert into public.wholesale_customers(id,unique_name)
          values ('${id}','${name}');`);
        const initial = read();
        expect(initial).toMatchObject({ customer: { id }, archiveCount: 1 });
        if (access === "section-denied") {
          // 先给专属账号开通批发，才能区分整个业务不可用与客户栏目不向该岗位开放。
          executeLearningSql(`insert into public.user_workspace_business_access(user_id,business_key,is_enabled)
            values ('${actorId}','wholesale',true)
            on conflict (user_id,business_key) do update set is_enabled=true;`);
        }
        expect(queryAsUser(actorId, `select public.current_app_role() || '|' || public.current_user_has_wholesale_access();`))
          .toBe(`${role}|${access !== "business-denied"}`);
        if (access !== "record") {
          queryAsUser(actorId, `do $$ begin
            perform public.delete_wholesale_customer('${id}');
            raise exception 'protected_delete_unexpected_success';
          exception when raise_exception then
            if sqlerrm <> 'wholesale_customer_forbidden' then raise; end if;
          end $$;`);
          expect(read()).toEqual(initial);
        }
        if (access === "link") {
          // 财务允许关联账号。建档及编辑仍须在数据库直接拒绝，不能只依赖页面隐藏按钮。
          queryAsUser(actorId, `do $$ begin
            begin
              insert into public.wholesale_customers(unique_name) values ('Denied create ${id}');
              raise exception 'finance_create_unexpected_success';
            exception when insufficient_privilege then null;
            end;
            begin
              perform public.update_wholesale_customer('${id}','${name}',array[]::text[],null,null,null,null,1);
              raise exception 'finance_edit_unexpected_success';
            exception when raise_exception then
              if sqlerrm <> 'wholesale_customer_forbidden' then raise; end if;
            end;
          end $$;`);
          expect(read()).toEqual(initial);
        }

        await page.setViewportSize({ width, height: 900 });
        await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
          await page.keyboard.press("Escape");
        });
        await loginLearningUser(page, learningUser, access === "business-denied" ? /\/business-unavailable$/ : undefined);
        await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
        const path = `/${role === "administrator" ? "admin" : role}/wholesale/customers`;
        if (access === "link") {
          target = await createLearningUser("client");
          executeLearningSql(`delete from public.wholesale_customers
            where registered_user_id='${target.id}' and created_by_user_id='${target.id}';`);
        }
        await page.goto(path);
        const directoryHeading = page.getByRole("heading", { name: heading, exact: true });
        const search = page.getByPlaceholder(messages.components_dashboard_wholesale_wholesale_people_tabs.attribute003);
        const open = page.getByRole("button", { name: new RegExp(`^${name}`) });
        const profile = page.getByRole("dialog", { name, exact: true });
        const deleteButton = profile.getByRole("button", { name: details.text002.trim(), exact: true });
        const editButton = profile.getByRole("button", { name: details.text001.trim(), exact: true });
        const createButton = page.getByRole("button", { name: createLabel, exact: true });
        if (access === "section-denied" || access === "business-denied") {
          const deniedPath = access === "business-denied" ? /\/business-unavailable$/ : /\/access-limited$/;
          await expect(page).toHaveURL(deniedPath);
          await expect(directoryHeading).toHaveCount(0);
          expect(read()).toEqual(initial);
        } else {
          await expect(page).toHaveURL(new RegExp(`${path}$`));
          await expect(directoryHeading).toBeVisible();
          if (access === "record") await expect(createButton).toBeVisible();
          else await expect(createButton).toHaveCount(0);
          await search.fill(name);
          await open.click();
          if (access === "record") {
            await expect(editButton).toBeEnabled();
            await deleteButton.click();
            const confirmation = page.getByRole("dialog", { name: deletion.attribute002 });
            await confirmation.getByRole("button", { name: deletion.text004.trim(), exact: true }).click();
            await expect(confirmation).toHaveCount(0);
            expect(read()).toEqual(empty);
            await page.reload();
            await search.fill(name);
            await expect(open).toHaveCount(0);
          } else if (target) {
            await expect(profile).toHaveCSS("opacity", "1");
            await page.screenshot({ path: testInfo.outputPath("finance-customer-permissions.png"), animations: "disabled" });
            await expect(deleteButton).toHaveCount(0);
            await expect(editButton).toHaveCount(0);
            // 关联合格账号是独立能力，财务仍应通过真实页面操作取得数据库凭证。
            const account = profile.getByRole("combobox", { name: details.attribute001, exact: true });
            await account.click();
            const listId = await account.getAttribute("aria-controls");
            await page.locator(`[id=${JSON.stringify(listId)}]`).getByRole("option", { name: new RegExp(target.runId) }).click();
            await profile.getByRole("button", { name: details.text006.trim(), exact: true }).click();
            await expect(profile.getByText(details.text003.trim(), { exact: true })).toBeVisible();
            expect(read()).toMatchObject({ customer: { id, registeredUserId: target.id, kind: "registered_account" }, archiveCount: 1 });
            expect(executeLearningSql(`select granted_by_user_id from public.user_workspace_business_access
              where user_id='${target.id}' and business_key='wholesale' and is_enabled;`)).toBe(actorId);
            await page.reload();
            await search.fill(name);
            await open.click();
            await expect(profile.getByText(details.text003.trim(), { exact: true })).toBeVisible();
          }
        }
        expect(errors).toEqual([]);
        await writeFile(testInfo.outputPath("customer-role-receipt.json"), JSON.stringify({ role, access, initial, final: read() }, null, 2));
      } finally {
        executeLearningSql(`delete from public.wholesale_customers where id='${id}' and unique_name='${name}';`);
        expect(read()).toEqual(empty);
        if (target) {
          const cleanup = await target.cleanup();
          const businessRows = Number(executeLearningSql(`select count(*) from public.user_workspace_business_access where user_id='${target.id}';`));
          expect(businessRows).toBe(0);
          await writeFile(testInfo.outputPath("linked-account-cleanup.json"), JSON.stringify({ ...cleanup, businessRows }));
        }
      }
    });
  });
}
