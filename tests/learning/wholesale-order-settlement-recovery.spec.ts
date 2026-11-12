import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

for (const [language, width] of [["zh", 1440], ["en", 390]] as const) {
  test(`结汇回执丢失后复用原登记 ${language}/${width}`, async ({ page, learningUser }, testInfo) => {
    const messages = language === "zh" ? zh : en;
    const orders = messages.WholesaleBusiness.ordersUi;
    const form = messages.UiText.components_dashboard_wholesale_wholesale_order_rate_dialogs;
    const details = messages.UiText.components_dashboard_wholesale_wholesale_order_details_dialog;
    const orderId = randomUUID();
    const customerId = randomUUID();
    const number = `Learning-${orderId}`;
    const owner = learningUser.id;
    const readSettlements = () => JSON.parse(executeLearningSql(`
      select coalesce(json_agg(s),'[]') from (
        select id, order_id, settlement_amount, settlement_exchange_rate,
          settlement_rmb_amount, settled_on, created_by_user_id
        from public.wholesale_order_settlements where order_id='${orderId}' order by created_at,id
      ) s;`));
    const readOrder = () => JSON.parse(executeLearningSql(`
      select json_build_object('status',status,'updated_at',updated_at)
      from public.wholesale_orders where id='${orderId}';`));
    executeLearningSql(`begin;
      insert into public.wholesale_customers (id, unique_name, created_by_user_id, salesman_commission_cohort)
        values ('${customerId}','${number}','${owner}','new');
      insert into public.wholesale_orders (id, order_number, customer_id, created_by_user_id,
        order_month,customer_payment_amount,customer_payment_currency)
        values ('${orderId}','${number}','${customerId}','${owner}',date_trunc('month',now())::date,100,'CNY');
      commit;`);

    try {
      await page.context().addCookies([{ name: "bs-locale", value: "zh", url: "http://localhost:3000" }]);
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: language, url: "http://localhost:3000" }]);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/wholesale/orders");
      const detail = page.getByRole("dialog", { name: orders.detailFields.title.replace("{number}", number) });
      const dialog = page.getByRole("dialog", { name: form.attribute001 });
      const save = dialog.getByRole("button", { name: form.text003.trim(), exact: true });
      const amount = dialog.locator('input[name="settlement_amount"]');
      const openDetails = async () => {
        if (width === 390) {
          await page.getByTestId(`wholesale-order-card-${orderId}`).click();
        } else {
          await page.getByTestId(`wholesale-order-row-${orderId}`)
            .getByRole("button", { name: orders.compactColumns.details, exact: true }).click();
        }
        await expect(detail).toBeVisible();
      };
      const openSettlement = async () => {
        await openDetails();
        await detail.getByRole("button", { name: details.text001.trim(), exact: true }).click();
        await expect(dialog).toBeVisible();
      };
      await openSettlement();
      const before = readOrder();
      expect(readSettlements()).toEqual([]);
      const firstAmount = language === "en" ? 60 : 20;
      await amount.fill(String(firstAmount));
      const requestIds: (string | undefined)[] = [];
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.endsWith("/rpc/add_wholesale_order_settlement")) {
          requestIds.push(request.postDataJSON().p_settlement_request_id);
        }
      });
      // 真实写入完成后，浏览器看不到回执；重试必须指向同一笔结汇。
      await page.route("**/rpc/add_wholesale_order_settlement", async (route) => {
        if (language === "en") {
          // 同一请求同时到达两个数据库连接，两边应收到相同的真实回执。
          const [first, second] = await Promise.all([
            route.fetch({ maxRetries: 0 }), route.fetch({ maxRetries: 0 }),
          ]);
          expect(first.ok() && second.ok()).toBe(true);
          expect(await first.json()).toEqual(await second.json());
        } else {
          const response = await route.fetch({ maxRetries: 0 });
          expect(response.ok()).toBe(true);
        }
        await route.abort("connectionreset");
      }, { times: 1 });
      await save.click();
      await expect.poll(() => readSettlements()).toHaveLength(1);
      await expect(save).toBeEnabled();
      await expect(page.getByText(orders.writeFeedback.settlementUnconfirmed, { exact: true })).toBeVisible();
      await expect(amount).toHaveValue(String(firstAmount));
      const [record] = readSettlements();
      const partial = readOrder();
      expect(partial.status).toBe("partial_settled");
      expect(partial.updated_at).not.toBe(before.updated_at);
      if (language === "en") {
        // 60 元已写入，刷新后剩余只有 40 元，重试原意图仍要能取回回执。
        await page.reload();
        await openSettlement();
        await expect(amount).toHaveValue("60");
      }
      await save.click();
      await expect(dialog).toBeHidden();
      expect(readSettlements(), "一次结汇意图只能登记一笔").toEqual([record]);
      expect(readOrder()).toEqual(partial);
      expect(requestIds[0]).toMatch(/^[a-f0-9-]{36}$/);
      expect(requestIds).toEqual([requestIds[0], requestIds[0]]);
      expect(record).toMatchObject({
        order_id: orderId, settlement_amount: firstAmount, settlement_exchange_rate: 1,
        settlement_rmb_amount: firstAmount, created_by_user_id: owner,
      });
      await page.reload();
      await openSettlement();
      await expect(dialog.getByText(`¥${firstAmount}.00`, { exact: true }).first()).toBeVisible();
      // 中文用例再次登记相同金额和日期，证明新意图仍然独立。
      await amount.fill("20");
      await save.click();
      await expect(dialog).toBeHidden();
      const after = readSettlements();
      expect(after).toHaveLength(2);
      expect(after[0]).toEqual(record);
      expect(after[1].settlement_amount).toBe(20);
      expect(requestIds[2]).not.toBe(requestIds[0]);
      await page.reload();
      await openSettlement();
      await expect(dialog.locator('[data-slot="field"]').filter({
        has: page.getByText(form.attribute004, { exact: true }),
      }))
        .toContainText(`¥${80 - firstAmount}.00`);
      await expect(dialog).toHaveCSS("opacity", "1");
      // 弹窗本身可能隐藏横向溢出，直接核对表单内部宽度。
      await expect.poll(() => dialog.locator("form").evaluate((element) =>
        element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`settlement-${language}-${width}.png`) });
      await amount.fill(String(80 - firstAmount));
      await save.click();
      await expect(dialog).toBeHidden();
      const completed = readOrder();
      const records = readSettlements();
      expect(completed.status).toBe("settled");
      expect(records).toHaveLength(3);
      expect(records.reduce((total: number, row: { settlement_amount: number }) => total + row.settlement_amount, 0))
        .toBe(100);
      await page.reload();
      await openDetails();
      await expect(detail.getByText(orders.statuses.settled, { exact: true })).toBeVisible();
      await expect(detail.getByRole("button", { name: details.text001.trim(), exact: true })).toHaveCount(0);
      await writeFile(testInfo.outputPath("settlement-receipt.json"), JSON.stringify({
        orderId, requestIds, partial, completed, records,
      }, null, 2));
    } finally {
      executeLearningSql(`begin;
        delete from public.wholesale_orders where id='${orderId}' and customer_id='${customerId}'
          and order_number='${number}' and created_by_user_id='${owner}';
        delete from public.wholesale_customers where id='${customerId}' and unique_name='${number}'
          and created_by_user_id='${owner}';
        commit;`);
      expect(readSettlements()).toEqual([]);
    }
  });
}
