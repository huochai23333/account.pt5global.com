import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { test, expect } from "./fixtures";

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  test(`批发客户查询与推荐关系 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    const parentId = randomUUID();
    const childId = randomUUID();
    const parentName = `Learning parent ${parentId}`;
    const childName = `Learning child ${childId}`;
    const childAlias = `Learning alias ${childId}`;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
    // 公告的阅读记录归属本次账号，不能修改共享公告以通过测试。
    if (locale === "en") {
      await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
        await page.keyboard.press("Escape");
      });
    }
    const pair = `referrer_customer_id='${parentId}' and referred_customer_id='${childId}'`;
    const readRelationship = () => JSON.parse(executeLearningSql(
      `select coalesce(json_agg(t),'[]') from (select id,referrer_customer_id,referred_customer_id,created_by_user_id,created_at
        from public.wholesale_referrals where ${pair}) t;`,
    ));

    // 只准备两条无订单的客户档案。推荐关系必须由实际页面创建。
    executeLearningSql(`insert into public.wholesale_customers(id,unique_name,other_names,created_by_user_id,salesman_commission_cohort)
      values ('${parentId}','${parentName}','{}','${learningUser.id}','new'),
        ('${childId}','${childName}',array['${childAlias}'],'${learningUser.id}','new');`);
    try {
      expect(readRelationship()).toEqual([]);
      await loginLearningUser(page, learningUser);
      await page.goto("/admin/wholesale/customers");
      const search = page.getByPlaceholder(locale === "zh" ? "客户名称、联系方式、来源或业务员" : "Customer name, contact information, source or salesperson");
      const customer = page.getByRole("button", { name: new RegExp(childName) });
      await search.fill(childAlias);
      await expect(customer).toBeVisible();
      await expect(page.getByRole("button", { name: new RegExp(parentName) })).toHaveCount(0);
      await customer.click();
      await expect(page.getByRole("dialog").getByText(childAlias, { exact: true })).toBeVisible();
      await page.keyboard.press("Escape");

      await page.goto("/admin/wholesale/referrals");
      const referralSearch = page.getByPlaceholder(locale === "zh" ? "输入客户名称查找推荐关系" : "Enter customer name to find referral relationships");
      const parentPath = page.getByText(new RegExp(`→ ${parentName}$`));
      const open = page.getByRole("button", { name: locale === "zh" ? "新增推荐关系" : "Add recommendation relationship" });
      const form = page.getByRole("dialog");
      const submit = form.getByRole("button", { name: locale === "zh" ? "保存关系" : "Save relationship" });
      const chooseCustomer = async (label: string, name: string) => {
        const trigger = form.getByRole("combobox", { name: label, exact: true });
        await trigger.click();
        // 两个下拉框选项相同，离场动画中旧菜单可能还在 DOM；只选择当前控件对应的列表。
        await expect(trigger).toHaveAttribute("aria-controls", /.+/);
        const list = await trigger.getAttribute("aria-controls");
        await page.locator(`[id=${JSON.stringify(list)}]`).getByRole("option", { name, exact: true }).click();
      };
      const selectPair = async () => {
        await open.click();
        await chooseCustomer(locale === "zh" ? "推荐客户" : "Recommend customers", parentName);
        await chooseCustomer(locale === "zh" ? "被推荐客户" : "Recommended customers", childName);
      };
      await referralSearch.fill(childAlias);
      await expect(parentPath).toHaveCount(0);
      await selectPair();
      await submit.click();
      await expect(form).toHaveCount(0);
      await expect(parentPath).toBeVisible();
      const receipt = readRelationship();
      expect(receipt).toHaveLength(1);
      expect(receipt[0]).toMatchObject({
        referrer_customer_id: parentId, referred_customer_id: childId, created_by_user_id: learningUser.id,
      });
      expect(receipt[0].id).toBeTruthy();

      await selectPair();
      const response = page.waitForResponse((item) =>
        new URL(item.url()).pathname.endsWith("/rest/v1/wholesale_referrals") && item.request().method() === "POST");
      await submit.click();
      expect((await response).ok()).toBe(false);
      await expect(submit).toBeEnabled();
      await expect(form).toBeVisible();
      expect(readRelationship()).toEqual(receipt);
      await page.reload();
      await referralSearch.fill(childAlias);
      await expect(parentPath).toBeVisible();
      expect(readRelationship()).toEqual(receipt);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(errors).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`referral-${locale}-${width}.png`) });
      await writeFile(testInfo.outputPath("referral-receipt.json"), JSON.stringify(receipt, null, 2));
    } finally {
      executeLearningSql(`begin;
        delete from public.wholesale_referrals where ${pair} and created_by_user_id='${learningUser.id}';
        delete from public.wholesale_customers where created_by_user_id='${learningUser.id}'
          and ((id='${parentId}' and unique_name='${parentName}') or (id='${childId}' and unique_name='${childName}'));
        commit;`);
      expect(readRelationship()).toEqual([]);
      expect(executeLearningSql(`select count(*) from public.wholesale_customers where id in ('${parentId}','${childId}');`)).toBe("0");
    }
  });
}
