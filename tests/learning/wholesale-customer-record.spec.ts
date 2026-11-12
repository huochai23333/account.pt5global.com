import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { createLearningUser, executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  test(`批发客户建档、编辑、合并账号和删除 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    page.setDefaultTimeout(10_000);
    const messages = (locale === "zh" ? zh : en).UiText;
    const dialogs = messages.components_dashboard_wholesale_wholesale_customer_dialogs;
    const details = messages.components_dashboard_wholesale_wholesale_customer_details;
    const deletion = messages.components_dashboard_wholesale_wholesale_customer_delete_dialog;
    const name = `Learning record ${randomUUID()}`;
    const orderId = randomUUID();
    const note = "Synthetic customer record updated";
    const target = await createLearningUser("client");
    const read = () => JSON.parse(executeLearningSql(`
      select coalesce(json_agg(t),'[]') from (select id,unique_name,notes,customer_kind,
        registered_user_id,xmin::text as version from public.wholesale_customers
        where unique_name='${name}' and created_by_user_id='${learningUser.id}') t;`));
    const access = () => JSON.parse(executeLearningSql(`
      select coalesce(json_agg(t),'[]') from (select user_id,is_enabled,granted_by_user_id
      from public.user_workspace_business_access where user_id='${target.id}' and business_key='wholesale') t;`));
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      // 只移除本次目标账号注册时自动建立的空档案，模拟先有人工档案、再有待关联登录账号。
      executeLearningSql(`delete from public.wholesale_customers
        where registered_user_id='${target.id}' and created_by_user_id='${target.id}';`);
      expect(executeLearningSql(`select count(*) from public.wholesale_customers where registered_user_id='${target.id}';`)).toBe("0");
      await page.addLocatorHandler(
        page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }),
        async () => { await page.keyboard.press("Escape"); },
      );
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      await page.setViewportSize({ width, height: 900 });
      const goToDirectory = async () => {
        await page.goto("/admin/wholesale/customers");
        await page.getByPlaceholder(messages.components_dashboard_wholesale_wholesale_people_tabs.attribute003).fill(name);
      };
      const recordButton = page.getByRole("button", { name: new RegExp(`^${name}`) });
      const addButton = page.getByRole("button", { name: messages.components_dashboard_wholesale_wholesale_customers_section.text001.trim(), exact: true });
      const openDetails = async () => {
        await recordButton.click();
        return page.getByRole("dialog", { name, exact: true });
      };
      await goToDirectory();
      await expect(recordButton).toHaveCount(0);
      await addButton.click();
      const create = page.getByRole("dialog", { name: dialogs.attribute002 });
      const nameField = create.locator('[name="unique_name"]');
      const save = create.getByRole("button", { name: locale === "zh" ? "保存客户" : "Save customer", exact: true });
      await nameField.fill(name);
      await save.click();
      await expect(create).toHaveCount(0);
      await expect.poll(read).toHaveLength(1);
      const [created] = read();
      expect(created).toMatchObject({ unique_name: name, registered_user_id: null, customer_kind: "sales_created" });
      // 重复建档应保留表单和已保存的唯一记录，不能靠提示文案判断是否写入。
      await addButton.click();
      await nameField.fill(name);
      const [duplicate] = await Promise.all([
        page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/wholesale_customers")
          && response.request().method() === "POST", { timeout: 10_000 }),
        save.click(),
      ]);
      expect(duplicate.ok()).toBe(false);
      await expect(nameField).toHaveValue(name);
      expect(read()).toEqual([created]);
      await page.keyboard.press("Escape");
      await expect(create).toHaveCount(0);
      await goToDirectory();
      let profile = await openDetails();
      await expect(profile.getByText(locale === "zh" ? "备注" : "Notes", { exact: true })).toBeVisible();
      await profile.getByRole("button", { name: details.text001.trim(), exact: true }).click();
      const edit = page.getByRole("dialog", { name: dialogs.attribute004 });
      await edit.locator('[name="notes"]').fill(note);
      await edit.getByRole("button", { name: locale === "zh" ? "保存修改" : "Save changes", exact: true }).click();
      await expect(edit).toHaveCount(0);
      await expect.poll(() => read()[0]?.notes).toBe(note);
      const [edited] = read();
      expect(edited.id).toBe(created.id);
      expect(edited.version).not.toBe(created.version);
      await goToDirectory();
      profile = await openDetails();
      await expect(profile.getByText(note, { exact: true })).toBeVisible();

      const candidate = profile.getByRole("combobox", { name: details.attribute001, exact: true });
      await candidate.click();
      await expect(candidate).toHaveAttribute("aria-controls", /.+/);
      const listId = await candidate.getAttribute("aria-controls");
      await page.locator(`[id=${JSON.stringify(listId)}]`).getByRole("option", { name: new RegExp(target.email.replaceAll(".", "\\.")) }).click();
      await profile.getByRole("button", { name: details.text006.trim(), exact: true }).click();
      await expect.poll(() => read()[0]?.registered_user_id).toBe(target.id);
      const [linked] = read();
      const accessReceipt = access();
      expect(linked).toMatchObject({ id: created.id, notes: note, customer_kind: "registered_account" });
      expect(accessReceipt).toEqual([{ user_id: target.id, is_enabled: true, granted_by_user_id: learningUser.id }]);
      await goToDirectory();
      profile = await openDetails();
      await expect(profile.getByText(details.text003.trim(), { exact: true })).toBeVisible();
      await expect(profile.getByRole("combobox", { name: details.attribute001 })).toHaveCount(0);
      await expect(profile).toHaveCSS("opacity", "1");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("customer-linked.png"), animations: "disabled" });

      // 有关联订单时，删除必须失败。之后仅撤掉本次订单夹具，再走同一页面删除。
      executeLearningSql(`insert into public.wholesale_orders
        (id,order_number,customer_id,created_by_user_id,order_month)
        values ('${orderId}','Learning-${orderId}','${created.id}','${learningUser.id}',date_trunc('month',now())::date);`);
      await profile.getByRole("button", { name: details.text002.trim(), exact: true }).click();
      const confirmation = page.getByRole("dialog", { name: deletion.attribute002 });
      const confirm = confirmation.getByRole("button", { name: deletion.text004.trim(), exact: true });
      const [blocked] = await Promise.all([
        page.waitForResponse((response) => response.url().includes("/rpc/delete_wholesale_customer"), { timeout: 10_000 }),
        confirm.click(),
      ]);
      expect(blocked.ok()).toBe(false);
      await expect(confirmation).toBeVisible();
      expect(read()).toEqual([linked]);
      executeLearningSql(`delete from public.wholesale_orders where id='${orderId}' and created_by_user_id='${learningUser.id}';`);
      await confirm.click();
      await expect(confirmation).toHaveCount(0);
      expect(read()).toEqual([]);
      await goToDirectory();
      await expect(recordButton).toHaveCount(0);
      expect(access()).toEqual(accessReceipt);
      expect(errors).toEqual([]);
      await writeFile(testInfo.outputPath("customer-record-receipts.json"), JSON.stringify({ created, edited, linked, accessReceipt, finalCount: read().length }, null, 2));
    } finally {
      executeLearningSql(`begin;
        delete from public.wholesale_orders where id='${orderId}' and created_by_user_id='${learningUser.id}';
        delete from public.wholesale_customers where unique_name='${name}' and created_by_user_id='${learningUser.id}';
        commit;`);
      expect(read()).toEqual([]);
      await target.cleanup();
      expect(access()).toEqual([]);
    }
  });
}
