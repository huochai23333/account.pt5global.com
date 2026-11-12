import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import type { Page, Route } from "@playwright/test";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

function isAliasWrite(route: Route, customerId: string) {
  const request = route.request();
  const url = new URL(request.url());
  if (request.method() === "PATCH") {
    return url.pathname.endsWith("/wholesale_customers") && url.searchParams.get("id") === `eq.${customerId}`;
  }
  return request.method() === "POST" && url.pathname.endsWith("/rpc/append_wholesale_customer_other_names")
    && request.postDataJSON().p_customer_id === customerId;
}

test("两个会话同时追加批发客户别名，刷新后都保留", async ({ browser, page, learningUser, learningStaff }, testInfo) => {
  page.setDefaultTimeout(12_000);
  const id = randomUUID();
  const name = `Learning customer ${id}`;
  const oldName = `Original ${id}`;
  const firstName = `First ${id}`;
  const secondName = `Second ${id}`;
  const interruptedName = `Interrupted ${id}`;
  const read = () => JSON.parse(executeLearningSql(`
    select row_to_json(t) from (select id,other_names,xmin::text as row_version
      from public.wholesale_customers where id='${id}') t;`));
  const mobile = await browser.newPage({ viewport: { width: 390, height: 900 } });
  mobile.setDefaultTimeout(12_000);
  const errors: string[] = [];
  for (const view of [page, mobile]) view.on("pageerror", (error) => errors.push(error.message));
  const open = async (view: Page, locale: "zh" | "en") => {
    const messages = locale === "zh" ? zh : en;
    await view.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
    await view.goto("http://localhost:3000/admin/wholesale/customers");
    const placeholder = messages.UiText.components_dashboard_wholesale_wholesale_people_tabs.attribute003;
    await view.getByPlaceholder(placeholder).fill(name);
    await view.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    return view.getByRole("dialog", { name, exact: true });
  };
  const prepare = async (view: Page, locale: "zh" | "en", alias: string) => {
    const dialog = await open(view, locale);
    const copy = (locale === "zh" ? zh : en).UiText.components_dashboard_wholesale_wholesale_customer_other_names;
    // 修复前的英文界面也使用中文按钮，红例仍经过实际页面。
    await dialog.getByRole("button", { name: /^(新增名称|Add another name)$/ }).click();
    await dialog.getByPlaceholder(copy.attribute002).fill(alias);
    return dialog.getByRole("button", { name: copy.text004.trim(), exact: true });
  };
  executeLearningSql(`insert into public.wholesale_customers(id,unique_name,other_names,created_by_user_id,salesman_commission_cohort)
    values ('${id}','${name}',array['${oldName}'],'${learningUser.id}','new');`);
  try {
    const before = read();
    for (const view of [page, mobile]) {
      await view.addLocatorHandler(
        view.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }),
        async () => { await view.keyboard.press("Escape"); },
      );
      await loginLearningUser(view, learningUser);
    }
    const first = await prepare(page, "zh", firstName);
    const second = await prepare(mobile, "en", secondName);
    const gate = Promise.withResolvers<void>();
    const writes: unknown[] = [];
    const barrier = async (route: Route) => {
      if (!isAliasWrite(route, id)) return route.continue();
      writes.push(route.request().postDataJSON());
      // 只暂停真实请求，两边都发出保存后才放行，稳定复现旧实现的陈旧读取。
      if (writes.length === 2) gate.resolve();
      await gate.promise;
      await route.continue();
    };
    for (const view of [page, mobile]) await view.route("**/rest/v1/**", barrier);
    try {
      const responses = await Promise.all([page, mobile].map(async (view, index) => {
        const [response] = await Promise.all([
          view.waitForResponse((item) => {
            const request = item.request();
            return ["PATCH", "POST"].includes(request.method()) &&
              (request.url().includes("/wholesale_customers?") || request.url().includes("/rpc/append_wholesale_customer_other_names"));
          }, { timeout: 12_000 }),
          (index === 0 ? first : second).click(),
        ]);
        return response.status();
      }));
      expect(responses).toEqual([200, 200]);
      expect(writes).toHaveLength(2);
      const committed = read();
      expect([...committed.other_names].sort()).toEqual([oldName, firstName, secondName].sort());
      expect(committed.row_version).not.toBe(before.row_version);
      for (const [view, locale] of [[page, "zh"], [mobile, "en"]] as const) {
        const dialog = await open(view, locale);
        for (const alias of [oldName, firstName, secondName]) await expect(dialog.getByText(alias, { exact: true })).toBeVisible();
        expect(await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        // 弹窗和遮罩的入场动画结束后，再把本次核对的名称滚到可见位置。
        await expect(dialog).toHaveCSS("opacity", "1");
        const savedName = dialog.getByText(secondName, { exact: true });
        await savedName.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
        await expect(savedName).toBeInViewport();
        await view.screenshot({ path: testInfo.outputPath(`customer-alias-${locale}.png`), animations: "disabled" });
      }
      await writeFile(testInfo.outputPath("customer-alias-committed.json"), JSON.stringify({ before, committed }, null, 2));
    } finally {
      gate.resolve();
      for (const view of [page, mobile]) await view.unroute("**/rest/v1/**", barrier);
    }
    const beforeDuplicate = read();
    const duplicate = await prepare(mobile, "en", firstName.toUpperCase());
    await duplicate.click();
    const duplicateCopy = en.UiText.components_dashboard_wholesale_wholesale_customer_other_names.alreadyPresent;
    await expect(mobile.getByText(duplicateCopy, { exact: true })).toBeVisible();
    expect(read()).toEqual(beforeDuplicate);

    await mobile.getByRole("dialog", { name, exact: true }).getByPlaceholder(
      en.UiText.components_dashboard_wholesale_wholesale_customer_other_names.attribute002,
    ).fill(interruptedName);
    // 真实写入提交后丢弃浏览器响应，原输入应保留；重试只核对已有名称。
    await mobile.route("**/rpc/append_wholesale_customer_other_names", async (route) => {
      const committed = await route.fetch({ maxRetries: 0 });
      expect(committed.ok()).toBe(true);
      await route.abort("connectionreset");
    }, { times: 1 });
    await duplicate.click();
    const aliasCopy = en.UiText.components_dashboard_wholesale_wholesale_customer_other_names;
    await expect(mobile.getByText(aliasCopy.failed, { exact: true })).toBeVisible();
    const interrupted = read();
    expect(interrupted.other_names).toContain(interruptedName);
    expect(interrupted.row_version).not.toBe(beforeDuplicate.row_version);
    await duplicate.click();
    await expect(mobile.getByText(duplicateCopy, { exact: true })).toBeVisible();
    expect(read()).toEqual(interrupted);
    const refreshed = await open(mobile, "en");
    await expect(refreshed.getByText(interruptedName, { exact: true })).toBeVisible();
    await writeFile(testInfo.outputPath("customer-alias-interrupted.json"), JSON.stringify(interrupted, null, 2));
    expect(errors).toEqual([]);
    // 保留原有跨档案协作。用另一名业务员验证可写，再回滚这次权限探针。
    expect(executeLearningSql(`begin;
      set local role authenticated;
      set local "request.jwt.claim.sub" = '${learningStaff.id}';
      select public.append_wholesale_customer_other_names('${id}',array['Salesman alias'])->>'changed';
      rollback;`)).toBe("true");
    expect(read()).toEqual(interrupted);
  } finally {
    await mobile.close();
    executeLearningSql(`delete from public.wholesale_customers where id='${id}' and created_by_user_id='${learningUser.id}';`);
    expect(executeLearningSql(`select count(*) from public.wholesale_customers where id='${id}';`)).toBe("0");
  }
});

test.describe("客户自己的档案也不能通过追加函数改名", () => {
  test.use({ learningRole: "client" });
  test("数据库按现有行权限返回零行回执", async ({ learningUser }) => {
    const customerId = executeLearningSql(`select id from public.wholesale_customers where registered_user_id='${learningUser.id}';`);
    expect(customerId).toMatch(/^[a-f0-9-]{36}$/);
    const readVersion = () => executeLearningSql(`select xmin from public.wholesale_customers where id='${customerId}';`);
    const version = readVersion();
    expect(version).toMatch(/^\d+$/);
    const denied = executeLearningSql(`begin;
      set local role authenticated;
      set local "request.jwt.claim.sub" = '${learningUser.id}';
      select public.current_app_role() || ':' ||
        (public.append_wholesale_customer_other_names('${customerId}',array['Denied alias']) is null)::text;
      rollback;`);
    expect(denied).toBe("client:true");
    expect(readVersion()).toBe(version);
  });
});
