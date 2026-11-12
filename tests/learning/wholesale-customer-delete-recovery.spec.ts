import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import type { Page } from "@playwright/test";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";
import { startCompetingCustomerDelete } from "./wholesale-customer-delete-race";

const customersPath = "/admin/wholesale/customers";
const deleteRoute = "**/rpc/delete_wholesale_customer";

function prepareCustomer(actorId: string) {
  const id = randomUUID();
  const name = `Learning delete ${id}`;
  const scope = `id='${id}' and created_by_user_id='${actorId}' and unique_name='${name}'`;
  executeLearningSql(`insert into public.wholesale_customers(id,unique_name,created_by_user_id)
    values ('${id}','${name}','${actorId}');`);
  return {
    id,
    name,
    // 保留版本和归档数量，区分没有写入、确实已删除以及只收到响应的情况。
    read: () => JSON.parse(executeLearningSql(`select json_build_object(
      'customer',(select json_build_object('id',id,'version',xmin::text) from public.wholesale_customers where ${scope}),
      'archiveCount',(select count(*) from public.document_archives where customer_id='${id}'));`)),
    cleanup: () => executeLearningSql(`delete from public.wholesale_customers where ${scope};`),
  };
}

function customerDirectory(page: Page, messages: typeof en, name: string) {
  const { UiText: copy } = messages;
  const customer = page.getByRole("button", { name: new RegExp(`^${name}`) });
  const dialog = page.getByRole("dialog", { name: copy.components_dashboard_wholesale_wholesale_customer_delete_dialog.attribute002 });
  return {
    customer,
    dialog,
    notice: dialog.getByRole("alert"),
    confirm: dialog.getByRole("button", { name: copy.components_dashboard_wholesale_wholesale_customer_delete_dialog.text004.trim(), exact: true }),
    async search() {
      await page.getByPlaceholder(copy.components_dashboard_wholesale_wholesale_people_tabs.attribute003).fill(name);
    },
    async open() {
      await customer.click();
      await page.getByRole("dialog", { name, exact: true }).getByRole("button", {
        name: copy.components_dashboard_wholesale_wholesale_customer_details.text002.trim(), exact: true,
      }).click();
    },
  };
}

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  const messages = locale === "zh" ? zh : en;
  const unconfirmed = messages.WholesaleBusiness.customerWrite.deleteUnconfirmed;

  test.describe(`${locale}/${width}`, () => {
    test.beforeEach(async ({ page, learningUser }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addLocatorHandler(
        page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }),
        async () => { await page.keyboard.press("Escape"); },
      );
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
    });

    test("断线后刷新核对删除结果", async ({ page, learningUser }, testInfo) => {
      const fixture = prepareCustomer(learningUser.id);
      const directory = customerDirectory(page, messages, fixture.name);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        const original = fixture.read();
        expect(original).toMatchObject({ customer: { id: fixture.id }, archiveCount: 1 });
        await page.goto(customersPath);
        await directory.search();
        await directory.open();
        await page.route(deleteRoute, (route) => route.abort("connectionreset"), { times: 1 });
        await directory.confirm.click();
        await expect(directory.notice).toHaveText(unconfirmed);
        expect(fixture.read()).toEqual(original);
        await page.reload();
        await directory.search();
        await directory.open();

        // 请求真正提交到数据库，仅丢弃本次给浏览器的响应。
        await page.route(deleteRoute, async (route) => {
          const response = await route.fetch({ maxRetries: 0 });
          expect(response.ok()).toBe(true);
          await route.abort("connectionreset");
        }, { times: 1 });
        await directory.confirm.click();
        await expect(directory.notice).toHaveText(unconfirmed);
        await expect(directory.notice).toBeInViewport({ ratio: 1 });
        const committed = fixture.read();
        expect(committed).toEqual({ customer: null, archiveCount: 0 });
        await page.screenshot({ path: testInfo.outputPath("delete-response-lost.png"), animations: "disabled" });
        await page.reload();
        await directory.search();
        await expect(directory.customer).toHaveCount(0);
        expect(fixture.read()).toEqual(committed);
        expect(errors).toEqual([]);
        await writeFile(testInfo.outputPath("delete-recovery-receipt.json"), JSON.stringify({ original, committed }, null, 2));
      } finally {
        fixture.cleanup();
        expect(fixture.read()).toEqual({ customer: null, archiveCount: 0 });
      }
    });

    test("竞争请求已删除时页面不能报告成功", async ({ page, learningUser }, testInfo) => {
      const fixture = prepareCustomer(learningUser.id);
      const directory = customerDirectory(page, messages, fixture.name);
      let competingDelete: ReturnType<typeof startCompetingCustomerDelete> | undefined;
      try {
        const original = fixture.read();
        expect(original).toMatchObject({ customer: { id: fixture.id }, archiveCount: 1 });
        await page.goto(customersPath);
        await directory.search();
        await directory.open();
        competingDelete = startCompetingCustomerDelete(fixture.id, learningUser.id);
        await expect.poll(competingDelete.isWaitingForPage).toBe(true);
        expect(fixture.read()).toEqual(original);
        const [response] = await Promise.all([
          page.waitForResponse((result) => result.url().endsWith("/rpc/delete_wholesale_customer"), { timeout: 15_000 }),
          directory.confirm.click(),
        ]);
        expect(await competingDelete.completion).toEqual({ committed: true, error: "" });
        const committed = fixture.read();
        expect(committed).toEqual({ customer: null, archiveCount: 0 });
        expect(response.ok()).toBe(false);
        expect(await response.json()).toMatchObject({ message: "wholesale_customer_not_found" });
        await expect(directory.notice).toHaveText(unconfirmed);
        await page.reload();
        await directory.search();
        await expect(directory.customer).toHaveCount(0);
        await writeFile(testInfo.outputPath("delete-race-receipt.json"), JSON.stringify({ original, committed, losingStatus: response.status() }, null, 2));
      } finally {
        await competingDelete?.completion;
        fixture.cleanup();
        expect(fixture.read()).toEqual({ customer: null, archiveCount: 0 });
      }
    });
  });
}
