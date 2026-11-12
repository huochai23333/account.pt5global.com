import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

test("批发全部列的费用表头与数据库金额逐项对齐", async ({ page, learningUser }, testInfo) => {
  const customerId = randomUUID();
  const orderId = randomUUID();
  const owner = learningUser.id;
  const number = `Learning-fees-${orderId.slice(0, 12)}`;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const read = () => JSON.parse(executeLearningSql(`select coalesce((select row_to_json(r) from (
    select id, international_shipping_fee, service_fee, cn_tax_fee, payment_processing_fee, other_fee,
      referral_commission_fee, updated_at from public.wholesale_orders where id='${orderId}' and created_by_user_id='${owner}'
  ) r),'null'::json);`));
  try {
    // 用互不相同的运费和其他费用区分各列，服务费仍由真实订单规则计算。
    executeLearningSql(`begin;
      insert into public.wholesale_customers(id,unique_name,created_by_user_id,salesman_commission_cohort)
        values ('${customerId}','${number}','${owner}','new');
      insert into public.wholesale_orders(id,order_number,customer_id,created_by_user_id,order_month,ordered_at,
        customer_payment_amount,customer_payment_currency,international_shipping_fee,other_fee)
        values ('${orderId}','${number}','${customerId}','${owner}',date_trunc('month',now())::date,now(),200,'CNY',12.34,98.76);
      commit;`);
    const order = read();
    expect(order).toMatchObject({ id: orderId, international_shipping_fee: 12.34, other_fee: 98.76 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
      await page.keyboard.press("Escape");
    });
    await loginLearningUser(page, learningUser);
    const results = [];
    for (const [locale, messages] of [["zh", zh], ["en", en]] as const) {
      const copy = messages.WholesaleBusiness.ordersUi;
      const tableText = messages.UiText.components_dashboard_wholesale_wholesale_orders_table;
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      await page.goto("/admin/wholesale/orders");
      await page.getByRole("button", { name: copy.compactColumns.showAll, exact: true }).click();
      const row = page.getByTestId(`wholesale-order-row-${orderId}`);
      await expect(row).toBeVisible();
      const table = row.locator("xpath=ancestor::table");
      const headers = (await table.getByRole("columnheader").allTextContents()).map((heading) => heading.trim());
      const cells = (await row.getByRole("cell").allTextContents()).map((value) => value.trim());
      expect(cells).toHaveLength(headers.length);
      // 全表沿用批发展示格式，语言切换改变字段名，金额仍用固定的人民币格式。
      const display = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" });
      const fees = [
        [tableText.text007, "international_shipping_fee"],
        [copy.fees.serviceFee, "service_fee"],
        [copy.fees.cnTaxFee, "cn_tax_fee"],
        [copy.fees.paymentProcessingFee, "payment_processing_fee"],
        [tableText.text008, "other_fee"],
        [tableText.text009, "referral_commission_fee"],
      ];
      for (const [label, key] of fees) {
        const index = headers.indexOf(label.trim());
        expect(index, label).toBeGreaterThanOrEqual(0);
        expect(cells[index], `${locale} ${label}`).toBe(display.format(order[key]));
      }
      expect(read()).toEqual(order);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await table.getByRole("columnheader", { name: tableText.text008, exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`fees-${locale}.png`), animations: "disabled" });
      results.push({ locale, fees: fees.map(([label, key]) => ({ label, key, displayed: cells[headers.indexOf(label.trim())] })) });
    }
    expect(pageErrors).toEqual([]);
    await writeFile(testInfo.outputPath("order-fee-column-receipt.json"), JSON.stringify({ order, results }, null, 2));
  } finally {
    executeLearningSql(`begin;
      delete from public.wholesale_orders where id='${orderId}' and created_by_user_id='${owner}';
      delete from public.wholesale_customers where id='${customerId}' and created_by_user_id='${owner}';
      commit;`);
    expect(read()).toBeNull();
    expect(executeLearningSql(`select count(*) from public.wholesale_customers where id='${customerId}';`)).toBe("0");
  }
});
