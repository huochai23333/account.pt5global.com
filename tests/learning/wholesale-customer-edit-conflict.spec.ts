import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import type { Page } from "@playwright/test";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

for (const [editLocale, aliasLocale] of [["en", "zh"], ["zh", "en"]] as const) {
  test(`资料编辑遇到另一个会话追加别名时保留草稿和最新资料 ${editLocale}`, async ({ browser, page, learningUser }, testInfo) => {
    const id = randomUUID();
    const name = `Learning conflict ${id}`;
    const alias = `Saved alias ${id}`;
    const draft = "Learning draft for conflict";
    const read = () => JSON.parse(executeLearningSql(`
      select row_to_json(t) from (select id,other_names,notes,edit_revision,xmin::text as version
      from public.wholesale_customers where id='${id}') t;`));
    const mobile = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors: string[] = [];
    const editor = editLocale === "en" ? mobile : page;
    const colleague = aliasLocale === "en" ? mobile : page;
    const editMessages = editLocale === "en" ? en : zh;
    const aliasMessages = (aliasLocale === "en" ? en : zh).UiText.components_dashboard_wholesale_wholesale_customer_other_names;
    const editButtonText = editMessages.UiText.components_dashboard_wholesale_wholesale_customer_details.text001.trim();
    const open = async (view: Page, locale: "zh" | "en") => {
      await view.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      await view.goto("http://localhost:3000/admin/wholesale/customers");
      const copy = (locale === "en" ? en : zh).UiText.components_dashboard_wholesale_wholesale_people_tabs;
      await view.getByPlaceholder(copy.attribute003).fill(name);
      await view.getByRole("button", { name: new RegExp(`^${name}`) }).click();
      return view.getByRole("dialog", { name, exact: true });
    };
    executeLearningSql(`insert into public.wholesale_customers(id,unique_name,created_by_user_id,salesman_commission_cohort)
      values ('${id}','${name}','${learningUser.id}','new');`);
    try {
      for (const view of [page, mobile]) {
        view.on("pageerror", (error) => errors.push(error.message));
        view.setDefaultTimeout(10_000);
        await view.addLocatorHandler(
          view.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }),
          async () => { await view.keyboard.press("Escape"); },
        );
        await loginLearningUser(view, learningUser);
      }
      const notes = editor.locator('textarea[name="notes"]');
      const save = editor.getByRole("button", {
        name: editMessages.UiText.components_dashboard_wholesale_wholesale_customer_form.saveChanges,
        exact: true,
      });
      const editTitle = editMessages.UiText.components_dashboard_wholesale_wholesale_customer_dialogs.attribute004;
      const alert = editor.getByRole("dialog", { name: editTitle }).getByRole("alert");
      const openEdit = async () => {
        const profile = await open(editor, editLocale);
        await profile.getByRole("button", { name: editButtonText, exact: true }).click();
        await notes.fill(draft);
      };
      await openEdit();
      const opened = read();

      // 编辑表单保持打开，由另一个会话先提交同一档案的新别名。
      const details = await open(colleague, aliasLocale);
      await details.getByRole("button", { name: aliasMessages.open, exact: true }).click();
      await details.locator('input[name="other_names"]').fill(alias);
      await details.getByRole("button", { name: aliasMessages.text004.trim(), exact: true }).click();
      await expect.poll(() => read().other_names).toEqual([alias]);
      const appended = read();
      expect(appended.edit_revision).toBe(opened.edit_revision + 1);

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const [conflict] = await Promise.all([
          editor.waitForResponse((response) => response.url().includes("/rpc/update_wholesale_customer"), { timeout: 10_000 }),
          save.click(),
        ]);
        expect(read()).toEqual(appended);
        expect(conflict.status()).toBe(409);
        await expect(notes).toHaveValue(draft);
        await expect(alert).toHaveText(editMessages.WholesaleBusiness.customerWrite.editConflict);
        await expect(alert).toBeInViewport({ ratio: 1 });
        await expect(notes).toBeInViewport();
        await expect(save).toBeEnabled();
      }
      expect(await editor.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await editor.screenshot({ path: testInfo.outputPath("customer-edit-conflict.png"), animations: "disabled" });

      // 重新打开会读取已提交版本，再把草稿应用到新资料上。
      await openEdit();
      await expect(editor.locator('textarea[name="other_names"]')).toHaveValue(alias);
      await save.click();
      await expect.poll(() => read().notes).toBe(draft);
      const saved = read();
      expect(saved.other_names).toEqual([alias]);
      expect(saved.edit_revision).toBe(appended.edit_revision + 1);
      expect(saved.version).not.toBe(appended.version);
      const refreshed = await open(editor, editLocale);
      await expect(refreshed.getByText(alias, { exact: true })).toBeVisible();
      await expect(refreshed.getByText(draft, { exact: true })).toBeVisible();
      await refreshed.getByRole("button", { name: editButtonText, exact: true }).click();
      const interruptedDraft = "Learning update with lost response";
      await notes.fill(interruptedDraft);
      await editor.route("**/rpc/update_wholesale_customer", async (route) => {
        const response = await route.fetch({ maxRetries: 0 });
        expect(response.ok()).toBe(true);
        await route.abort("connectionreset");
      }, { times: 1 });
      await save.click();
      await expect(alert).toHaveText(editMessages.WholesaleBusiness.customerWrite.editUnconfirmed);
      await expect(alert).toBeInViewport({ ratio: 1 });
      await expect(notes).toHaveValue(interruptedDraft);
      const interrupted = read();
      expect(interrupted).toMatchObject({ notes: interruptedDraft, other_names: [alias], edit_revision: saved.edit_revision + 1 });
      const verified = await open(editor, editLocale);
      await expect(verified.getByText(interruptedDraft, { exact: true })).toBeVisible();
      expect(read()).toEqual(interrupted);
      expect(errors).toEqual([]);
      await writeFile(testInfo.outputPath("customer-edit-conflict-receipt.json"), JSON.stringify({ opened, appended, saved, interrupted }, null, 2));
    } finally {
      await mobile.close();
      executeLearningSql(`delete from public.wholesale_customers where id='${id}' and created_by_user_id='${learningUser.id}';`);
      expect(executeLearningSql(`select count(*) from public.wholesale_customers where id='${id}';`)).toBe("0");
    }
  });
}
