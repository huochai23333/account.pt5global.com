import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import type { Page } from "@playwright/test";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";
import { convertedCustomerFixture, customerDocumentFixture } from "./wholesale-customer-delete-fixtures";

const customersPath = "/admin/wholesale/customers";

async function openCustomer(page: Page, locale: "zh" | "en", name: string) {
  const messages = (locale === "zh" ? zh : en).UiText;
  await page.getByPlaceholder(messages.components_dashboard_wholesale_wholesale_people_tabs.attribute003).fill(name);
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  return page.getByRole("dialog", { name, exact: true });
}

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  test.describe(`${locale}/${width}`, () => {
    const messages = (locale === "zh" ? zh : en).UiText;
    const details = messages.components_dashboard_wholesale_wholesale_customer_details;
    const deletion = messages.components_dashboard_wholesale_wholesale_customer_delete_dialog;
    test.beforeEach(async ({ page, learningUser }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addLocatorHandler(
        page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }),
        async () => { await page.keyboard.press("Escape"); },
      );
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
    });
    test("线索转换档案保留来源", async ({ page, learningUser }, testInfo) => {
      const fixture = convertedCustomerFixture(learningUser.id, randomUUID());
      const requests: string[] = [];
      const errors: string[] = [];
      page.on("request", (request) => {
        if (request.url().endsWith("/rpc/delete_wholesale_customer")) requests.push(request.url());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        fixture.create();
        const before = fixture.read();
        expect(before.customer.id).toBeTruthy();
        expect(before).toMatchObject({ lead: { status: "converted", customerId: before.customer.id }, assignmentCount: 1 });
        await page.goto(customersPath);
        for (const reload of [false, true]) {
          if (reload) await page.reload();
          const profile = await openCustomer(page, locale, fixture.name);
          // 已转换线索的客户可以维护资料，删除入口应阻止误操作并说明原因。
          const notice = profile.getByText(details.linkedLeadNotice, { exact: true });
          await notice.scrollIntoViewIfNeeded();
          await expect(notice).toBeInViewport({ ratio: 1 });
          await expect(profile.getByRole("button", { name: details.text002.trim(), exact: true })).toBeDisabled();
          await expect(profile.getByRole("button", { name: details.text001.trim(), exact: true })).toBeEnabled();
        }
        expect(requests).toHaveLength(0);
        expect(fixture.read()).toEqual(before);
        expect(errors).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath("converted-customer-protection.png"), animations: "disabled" });
        await writeFile(testInfo.outputPath("converted-customer-receipt.json"), JSON.stringify(before, null, 2));
      } finally {
        fixture.cleanup();
        const remaining = fixture.read();
        expect(remaining).toEqual({ customer: null, lead: null, assignmentCount: 0 });
        await writeFile(testInfo.outputPath("converted-customer-cleanup.json"), JSON.stringify(remaining));
      }
    });
    test("有资料文件的客户档案拒绝删除", async ({ page, learningUser }, testInfo) => {
      const customerId = randomUUID();
      const documentId = randomUUID();
      const fixture = customerDocumentFixture(learningUser.id, customerId, documentId);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        fixture.create();
        const before = fixture.read();
        expect(before).toMatchObject({ customer: { id: customerId }, document: { id: documentId, archiveCustomerId: customerId, revision: 1 }, archiveCount: 1, operationCount: 1 });
        await page.goto(customersPath);
        const startDelete = async () => {
          const profile = await openCustomer(page, locale, fixture.name);
          await profile.getByRole("button", { name: details.text002.trim(), exact: true }).click();
          return page.getByRole("dialog", { name: deletion.attribute002 });
        };
        let confirmation = await startDelete();
        const confirm = () => confirmation.getByRole("button", { name: deletion.text004.trim(), exact: true });
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const [response] = await Promise.all([
            page.waitForResponse((result) => result.url().endsWith("/rpc/delete_wholesale_customer")),
            confirm().click(),
          ]);
          expect(await response.json()).toMatchObject({ message: "document_customer_has_files" });
          expect(fixture.read()).toEqual(before);
          const notice = confirmation.getByRole("alert");
          await expect(notice).toHaveText(locale === "zh"
            ? "这个客户还有资料文件，请先处理资料，再删除客户档案。"
            : "This customer still has files. Take care of those files before deleting the customer record.");
          await expect(notice).toBeInViewport({ ratio: 1 });
        }
        await page.screenshot({ path: testInfo.outputPath("customer-document-delete-blocked.png"), animations: "disabled" });
        await page.reload();
        expect(fixture.read()).toEqual(before);
        confirmation = await startDelete();
        // 仅撤掉本次专属的保护条件，随后仍由页面执行客户删除。
        fixture.removeDocument();
        const ready = fixture.read();
        expect(ready).toMatchObject({ customer: before.customer, document: null });
        // 成功的传输响应不能证明档案已删除。单次返回空响应，真实读回必须发现档案仍在。
        await page.route("**/rpc/delete_wholesale_customer", (route) => route.fulfill({ status: 204 }), { times: 1 });
        await confirm().click();
        await expect(confirmation.getByRole("alert")).toHaveText(locale === "zh"
          ? "客户档案暂时无法删除，请稍后再试。"
          : "The customer record could not be deleted. Please try again later.");
        expect(fixture.read()).toEqual(ready);
        await confirm().click();
        await expect(confirmation).toHaveCount(0);
        const deleted = fixture.read();
        expect(deleted).toMatchObject({ customer: null, document: null, archiveCount: 0 });
        await page.reload();
        await page.getByPlaceholder(messages.components_dashboard_wholesale_wholesale_people_tabs.attribute003).fill(fixture.name);
        await expect(page.getByRole("button", { name: new RegExp(`^${fixture.name}`) })).toHaveCount(0);
        expect(errors).toEqual([]);
        await writeFile(testInfo.outputPath("document-delete-receipt.json"), JSON.stringify({ before, deleted }, null, 2));
      } finally {
        fixture.removeDocument();
        fixture.cleanup();
        const remaining = fixture.read();
        expect(remaining).toEqual({ customer: null, document: null, archiveCount: 0, operationCount: 0 });
        await writeFile(testInfo.outputPath("document-delete-cleanup.json"), JSON.stringify(remaining));
      }
    });
  });
}
