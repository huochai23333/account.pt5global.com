import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const expensePath = /\/rest\/v1\/company_expenses(?:\?|$)/;

for (const [locale, width, role] of [["zh", 1440, "administrator"], ["en", 390, "finance"]] as const) {
  test.describe(`公司费用写入 ${locale}/${width}`, () => {
    test.use({ learningRole: role });
    const messages = locale === "zh" ? zh : en;
    const copy = messages.CompanyExpenses;
    test("保存响应中断后仍只保留一条费用", async ({ page, learningUser }, testInfo) => {
      const owner = learningUser.id;
      const marker = `Learning expense ${randomUUID().slice(0, 12)}`;
      const read = () => JSON.parse(executeLearningSql(`select coalesce(json_agg(v order by created_at,id),'[]') from (
        select id,title,amount,currency_code,expense_month,created_by_user_id,updated_at,created_at,xmin::text as version
        from public.company_expenses where created_by_user_id='${owner}' and title='${marker}'
      ) v;`));
      const postIds: (string | undefined)[] = [];
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (expensePath.test(request.url()) && request.method() === "POST") postIds.push(request.postDataJSON().id);
      });
      try {
        await page.setViewportSize({ width, height: 900 });
        await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
          await page.keyboard.press("Escape");
        });
        await loginLearningUser(page, learningUser);
        await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
        await page.goto(`/${role === "administrator" ? "admin" : role}/company-expenses`);
        const add = page.getByRole("button", { name: copy.header.create, exact: true });
        await add.click();
        const dialog = page.getByRole("dialog", { name: copy.dialog.createTitle, exact: true });
        await dialog.getByPlaceholder(copy.dialog.titlePlaceholder).fill(marker);
        const submit = dialog.getByRole("button", { name: copy.dialog.createSubmit, exact: true });
        await dialog.getByRole("spinbutton").fill("123.456");
        await submit.click();
        await expect(dialog.getByRole("alert")).toHaveText(copy.feedback.invalidAmount);
        expect(postIds).toEqual([]);
        await dialog.getByRole("spinbutton").fill("123.45");
        // 只丢弃实际入库后的响应。桌面另外断开回执查询，验证第二次点击。
        await page.route(expensePath, async (route) => {
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
        await submit.evaluate((button: HTMLButtonElement) => {
          button.click();
          button.click();
        });
        await expect.poll(read).toHaveLength(1);
        const [committed] = read();
        if (locale === "zh") {
          await expect(dialog.getByRole("alert")).toHaveText(copy.feedback.createUnconfirmed, { timeout: 25_000 });
          await page.unroute(expensePath);
          await dialog.getByRole("spinbutton").fill("155.00");
          await submit.click();
          await expect(dialog.getByRole("alert")).toHaveText(copy.feedback.createDifferent);
          expect(postIds).toEqual([committed.id]);
          expect(read()).toEqual([committed]);
          await dialog.getByRole("button", { name: copy.dialog.cancel, exact: true }).click();
          await expect(dialog).toBeHidden();
          await add.click();
          await expect(dialog.getByRole("spinbutton")).toHaveValue("123.45");
          await submit.click();
        }
        await expect(dialog).toBeHidden();
        expect(postIds).toEqual(locale === "zh" ? [committed.id, committed.id] : [committed.id]);
        expect(read(), "重试保留唯一费用及原行版本").toEqual([committed]);
        expect(committed).toMatchObject({ title: marker, amount: 123.45, currency_code: "CNY", created_by_user_id: owner });
        await page.reload();
        await page.getByPlaceholder(copy.filters.searchPlaceholder).fill(marker);
        const card = page.locator("article").filter({ hasText: marker });
        await expect(card).toBeVisible();
        expect(read()).toEqual([committed]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        expect(errors).toEqual([]);
        await card.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath("expense.png"), animations: "disabled" });
        await card.getByRole("button", { name: copy.list.edit, exact: true }).click();
        const edit = page.getByRole("dialog", { name: copy.dialog.editTitle, exact: true });
        await edit.getByRole("spinbutton").fill("130.50");
        await edit.getByRole("button", { name: copy.dialog.editSubmit, exact: true }).click();
        await expect(edit).toBeHidden();
        const [updated] = read();
        expect(updated).toMatchObject({ id: committed.id, amount: 130.5 });
        expect(updated.version).not.toBe(committed.version);
        await page.reload();
        await page.getByPlaceholder(copy.filters.searchPlaceholder).fill(marker);
        await expect(card).toContainText(new Intl.NumberFormat(locale, { currency: "CNY", style: "currency" }).format(130.5));
        expect(read()).toEqual([updated]);
        await card.getByRole("button", { name: copy.list.delete, exact: true }).click();
        const confirm = messages.DashboardFramework.confirm;
        await page.getByRole("dialog", { name: confirm.title, exact: true })
          .getByRole("button", { name: confirm.accept, exact: true }).click();
        await expect(card).toHaveCount(0);
        expect(read()).toEqual([]);
        await page.reload();
        await page.getByPlaceholder(copy.filters.searchPlaceholder).fill(marker);
        await expect(card).toHaveCount(0);
        expect(read()).toEqual([]);
        await writeFile(testInfo.outputPath("expense-receipt.json"), JSON.stringify({ committed, updated, postIds, rowsAfterDelete: 0 }, null, 2));
      } finally {
        executeLearningSql(`delete from public.company_expenses where created_by_user_id='${owner}' and title='${marker}';`);
        expect(read()).toEqual([]);
        await writeFile(testInfo.outputPath("expense-cleanup.json"), JSON.stringify({ expenses: 0 }));
      }
    });
  });
}

test.describe("公司费用权限", () => {
  test.use({ learningRole: "salesman" });
  test("业务员访问公司费用会进入权限提示", async ({ page, learningUser }) => {
    await loginLearningUser(page, learningUser);
    await page.goto("/salesman/company-expenses");
    await expect(page).toHaveURL(/\/access-limited$/);
    await expect(page.getByRole("button", { name: zh.CompanyExpenses.header.create, exact: true })).toHaveCount(0);
  });
});
