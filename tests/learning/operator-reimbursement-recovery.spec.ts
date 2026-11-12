import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const recordPath = /\/rest\/v1\/operator_reimbursements(?:\?|$)/;
const batchPath = "**/rpc/mark_operator_reimbursements_reimbursed";

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  test.describe(`运营报销断线 ${locale}/${width}`, () => {
    test.use({ learningRole: "operator" });
    const copy = (locale === "zh" ? zh : en).OperatorReimbursements;
    test("新增重试保留原记录，周期确认独立读回并拒绝零行成功", async ({ page, learningUser }, testInfo) => {
      const actor = learningUser.id;
      const marker = `Learning reimbursement ${randomUUID().slice(0, 12)}`;
      const read = () => JSON.parse(executeLearningSql(`select coalesce(json_agg(r order by created_at,id),'[]') from (
        select id,operator_user_id,amount,content,spent_at,reimbursement_period_start,reimbursement_period_end,
          status,reimbursed_at,reimbursed_by_user_id,created_at,updated_at,xmin::text as version
        from public.operator_reimbursements where operator_user_id='${actor}' and content='${marker}'
      ) r;`));
      const postIds: (string | undefined)[] = [];
      const batchReceipts: Record<string, unknown>[] = [];
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (recordPath.test(request.url()) && request.method() === "POST") postIds.push(request.postDataJSON().id);
      });
      try {
        await page.setViewportSize({ width, height: 900 });
        await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
          await page.keyboard.press("Escape");
        });
        await loginLearningUser(page, learningUser);
        await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
        await page.goto("/operator/reimbursements");
        const add = page.getByRole("button", { name: copy.header.create, exact: true });
        await add.click();
        const editor = page.getByRole("dialog", { name: copy.dialog.createTitle, exact: true });
        const submit = editor.getByRole("button", { name: copy.dialog.createSubmit, exact: true });
        await editor.getByPlaceholder(copy.dialog.contentPlaceholder).fill(marker);
        const amount = editor.getByRole("spinbutton");
        await amount.fill("123.456");
        await submit.click();
        await expect(editor.getByText(copy.feedback.invalidAmount, { exact: true })).toBeVisible();
        expect(postIds).toEqual([]);
        await amount.fill("123.45");
        // 丢掉真实新增后的响应；桌面同时阻断读回，要求用户再次保存原草稿。
        await page.route(recordPath, async (route) => {
          const request = route.request();
          if (locale === "zh" && request.method() === "GET" && new URL(request.url()).searchParams.has("id")) {
            await route.abort("connectionreset");
            return;
          }
          if (request.method() === "POST" && postIds.length === 1) {
            const response = await route.fetch({ maxRetries: 0 });
            expect(response.ok()).toBe(true);
            expect(read()).toHaveLength(1);
            await route.abort("connectionreset");
            return;
          }
          await route.continue();
        });
        await submit.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
        await expect.poll(read).toHaveLength(1);
        const [original] = read();
        if (locale === "zh") {
          await expect(editor.getByRole("alert")).toHaveText(copy.feedback.createUnconfirmed, { timeout: 25_000 });
          await page.unroute(recordPath);
          await amount.fill("140.00");
          await submit.click();
          await expect(editor.getByRole("alert")).toHaveText(copy.feedback.createDifferent);
          expect(postIds).toEqual([original.id]);
          expect(read()).toEqual([original]);
          await editor.getByRole("button", { name: copy.dialog.cancel, exact: true }).click();
          await expect(editor).toBeHidden();
          await add.click();
          await expect(amount).toHaveValue("123.45");
          await submit.click();
        }
        await expect(editor).toBeHidden();
        expect(postIds).toEqual(locale === "zh" ? [original.id, original.id] : [original.id]);
        expect(read(), "原草稿重试只保留一笔报销").toEqual([original]);
        expect(original).toMatchObject({ operator_user_id: actor, amount: 123.45, content: marker, status: "unreimbursed" });
        const card = page.locator("article").filter({ hasText: marker });
        await page.reload();
        await expect(card.getByText(copy.status.unreimbursed, { exact: true }).first()).toBeVisible();
        expect(read()).toEqual([original]);
        const start = page.getByRole("button", { name: copy.header.reimburse, exact: true });
        await start.click();
        const confirm = page.getByRole("dialog", { name: copy.confirm.title, exact: true });
        const confirmSubmit = confirm.getByRole("button", { name: copy.confirm.submit, exact: true });
        await page.route(batchPath, async (route) => {
          const response = await route.fetch({ maxRetries: 0 });
          expect(response.ok()).toBe(true);
          const body = await response.json();
          batchReceipts.push(Array.isArray(body) ? body[0] : body);
          if (locale === "zh" && batchReceipts.length === 1) {
            await route.abort("connectionreset");
          } else {
            await route.fulfill({ response });
          }
        });
        await confirmSubmit.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
        await expect.poll(() => read()[0]?.status).toBe("reimbursed");
        const [reimbursed] = read();
        expect(reimbursed).toMatchObject({ id: original.id, amount: 123.45, reimbursed_by_user_id: actor, reimbursed_at: expect.any(String) });
        expect(reimbursed.version).not.toBe(original.version);
        expect(batchReceipts).toEqual([{
          period_start: original.reimbursement_period_start, period_end: original.reimbursement_period_end,
          updated_count: 1, reimbursed_total: 123.45,
        }]);
        if (locale === "zh") {
          await expect(confirm.getByRole("alert")).toHaveText(copy.feedback.reimburseUnconfirmed);
          await confirmSubmit.click();
          await expect.poll(() => batchReceipts.at(-1)?.updated_count).toBe(0);
          expect(batchReceipts[1]).toEqual({
            period_start: original.reimbursement_period_start, period_end: original.reimbursement_period_end,
            updated_count: 0, reimbursed_total: 0,
          });
          await expect(confirmSubmit).toBeEnabled();
          await expect(confirm.getByRole("alert")).toHaveText(copy.feedback.reimburseUnconfirmed);
          await expect(page.getByText(copy.feedback.reimburseSuccess.replace("{count}", "1"), { exact: true })).toHaveCount(0);
          expect(read()).toEqual([reimbursed]);
        } else {
          await expect(confirm).toBeHidden();
          await expect(page.getByText(copy.feedback.reimburseSuccess.replace("{count}", "1"), { exact: true })).toBeVisible();
        }
        await page.reload();
        await expect(card.getByText(copy.status.reimbursed, { exact: true }).first()).toBeVisible();
        await expect(card.getByRole("button", { name: copy.list.delete, exact: true })).toHaveCount(0);
        await expect(start).toBeDisabled();
        expect(read()).toEqual([reimbursed]);
        expect(errors).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await card.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath("reimbursed.png"), animations: "disabled" });
        await writeFile(testInfo.outputPath("reimbursement-receipt.json"), JSON.stringify({ original, reimbursed, postIds, batchReceipts }, null, 2));
      } finally {
        executeLearningSql(`delete from public.operator_reimbursements where operator_user_id='${actor}' and content='${marker}';`);
        expect(read()).toEqual([]);
        await writeFile(testInfo.outputPath("reimbursement-cleanup.json"), JSON.stringify({ reimbursements: 0 }));
      }
    });
  });
}
