import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };

for (const [language, width] of [["zh", 1440], ["en", 390]] as const) {
  test(`批发建单丢响应后重试与列表恢复 ${language}/${width}`, async ({ page, learningUser }, testInfo) => {
    const messages = language === "zh" ? zh : en;
    const formCopy = messages.UiText.components_dashboard_wholesale_wholesale_order_form_dialog;
    const listCopy = messages.UiText.components_dashboard_wholesale_wholesale_orders_section;
    const editCopy = messages.UiText.components_dashboard_wholesale_wholesale_order_edit_dialog;
    const orderCopy = messages.WholesaleBusiness.ordersUi;
    const id = randomUUID();
    const name = `Learning order customer ${id}`;
    const marker = `Learning create recovery ${id}`;
    const updatedMarker = `Learning edit recovery ${id}`;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const readOrders = () => JSON.parse(executeLearningSql(`
      select coalesce(json_agg(t),'[]') from (select id,order_number,customer_id,creation_request_id,
        created_by_user_id,status,updated_at,order_month,notes,small_order_count,product_purchase_amount,
        international_shipping_fee,service_fee,cn_tax_fee,payment_processing_fee,customer_payment_amount,
        customer_payment_currency from public.wholesale_orders where customer_id='${id}') t;
    `));
    executeLearningSql(`insert into public.wholesale_customers
      (id,unique_name,created_by_user_id,salesman_commission_cohort)
      values ('${id}','${name}','${learningUser.id}','new');`);

    try {
      // 先在中文工作台关闭夹具的公告，再设置验收语言和宽度。
      await page.context().addCookies([{ name: "bs-locale", value: "zh", url: "http://localhost:3000" }]);
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: language, url: "http://localhost:3000" }]);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/wholesale/orders");
      await page.getByRole("button", { name: listCopy.text001.trim(), exact: true }).click();
      const dialog = page.getByRole("dialog", { name: formCopy.attribute002 });
      const select = async (label: string, option: string) => {
        const trigger = dialog.getByRole("combobox", { name: label, exact: true });
        await trigger.click();
        await expect(trigger).toHaveAttribute("aria-controls", /.+/);
        const listId = await trigger.getAttribute("aria-controls");
        await page.locator(`[id=${JSON.stringify(listId)}]`).getByRole("option", { name: option, exact: true }).click();
      };
      const save = dialog.getByRole("button", { name: formCopy.text005.trim(), exact: true });
      await select(formCopy.attribute003, name);
      await select(formCopy.attribute011, "CNY");
      for (const [field, value] of Object.entries({
        small_order_count: "2",
        product_purchase_amount: "100",
        international_shipping_fee: "20",
        customer_payment_amount: "300",
      })) {
        await dialog.locator(`input[name="${field}"]`).fill(value);
      }
      const month = dialog.locator('input[data-mode="month"]');
      const [year, monthNumber] = new Date().toISOString().slice(0, 7).split("-");
      await month.fill(language === "zh" ? `${year}/${monthNumber}` : `${monthNumber}/${year}`);
      await month.press("Tab");
      await expect(dialog.locator('input[name="order_month"]')).toHaveValue(`${year}-${monthNumber}`);
      await dialog.locator('textarea[name="notes"]').fill(marker);
      await expect(dialog.getByTestId("order-fee-serviceFee")).toHaveValue("6.30");
      await expect(dialog.getByTestId("order-fee-cnTaxFee")).toHaveValue("3.78");
      await expect(dialog.getByTestId("order-fee-paymentProcessingFee")).toHaveValue("1.36");

      const requestIds: string[] = [];
      let updateRequests = 0;
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.endsWith("/rpc/create_wholesale_order")) {
          requestIds.push(request.postDataJSON().p_creation_request_id);
        }
        if (new URL(request.url()).pathname.endsWith("/rpc/update_wholesale_order")) updateRequests += 1;
      });
      // 让实际数据库完成建单，再丢掉第一次响应。草稿重试应携带原请求编号。
      await page.route("**/rpc/create_wholesale_order", async (route) => {
        const response = await route.fetch({ maxRetries: 0 });
        expect(response.ok()).toBe(true);
        await route.abort("connectionreset");
      }, { times: 1 });
      await save.click();
      await expect.poll(() => readOrders()).toHaveLength(1);
      await expect(save).toBeEnabled();
      await expect(dialog.locator('textarea[name="notes"]')).toHaveValue(marker);
      const committed = readOrders();
      expect(committed[0]).toMatchObject({
        customer_id: id, creation_request_id: requestIds[0], created_by_user_id: learningUser.id,
        small_order_count: 2, product_purchase_amount: 100, international_shipping_fee: 20,
        service_fee: 6.3, cn_tax_fee: 3.78, payment_processing_fee: 1.36,
        customer_payment_amount: 300, customer_payment_currency: "CNY", notes: marker,
      });
      expect(committed[0].order_month).toBe(`${year}-${monthNumber}-01`);
      expect(committed[0].order_number).toBeTruthy();

      // 重试取得同一订单的写入回执，但本次列表读取故障。
      await page.route("**/rpc/get_wholesale_order_page", (route) => route.fulfill({
        status: 503, json: { message: "learning list unavailable" },
      }), { times: 1 });
      await save.click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText(orderCopy.writeFeedback.refreshPending, { exact: true })).toBeVisible();
      await expect(page.getByText(orderCopy.loadError, { exact: true })).toBeVisible();
      expect(requestIds).toEqual([committed[0].creation_request_id, committed[0].creation_request_id]);
      expect(readOrders()).toEqual(committed);

      await page.getByRole("button", { name: listCopy.text002.trim(), exact: true }).click();
      const order = page.getByText(committed[0].order_number, { exact: true }).filter({ visible: true });
      await expect(order).toBeVisible();
      await page.reload();
      await expect(order).toBeVisible();
      expect(readOrders()).toEqual(committed);
      const detail = page.getByRole("dialog", {
        name: orderCopy.detailFields.title.replace("{number}", committed[0].order_number),
      });
      const openDetails = async () => {
        if (width < 1024) {
          await page.getByTestId(`wholesale-order-card-${committed[0].id}`).click();
        } else {
          await page.getByTestId(`wholesale-order-row-${committed[0].id}`)
            .getByRole("button", { name: orderCopy.compactColumns.details, exact: true }).click();
        }
        await expect(detail.getByText(orderCopy.detailFields.purchase, { exact: true })).toBeVisible();
        await expect(detail.getByText(/6\.30/)).toBeVisible();
        const settle = detail.getByRole("button", {
          name: messages.UiText.components_dashboard_wholesale_wholesale_order_details_dialog.text001.trim(),
          exact: true,
        });
        // 整页没有横向滚动时，弹窗仍可能裁掉按钮。直接检查操作区内的文本位置。
        expect(await settle.evaluate((button) => {
          const footer = button.closest('[data-testid="dashboard-dialog-actions"]');
          if (!footer) return false;
          const bounds = footer.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(button);
          return [...range.getClientRects()].every(
            (rect) => rect.left >= bounds.left && rect.right <= bounds.right,
          );
        })).toBe(true);
        await expect(detail.getByText(orderCopy.fallbacks.unassigned, { exact: true })).toBeVisible();
      };
      const edit = page.getByRole("dialog", { name: editCopy.title });
      const startEdit = () => detail.getByRole("button", { name: orderCopy.actions.edit, exact: true }).click();
      const saveEdit = () => edit.getByRole("button", { name: editCopy.saveAction, exact: true }).click();
      await openDetails();
      await startEdit();
      await saveEdit();
      await expect(edit).toHaveCount(0);
      expect(updateRequests).toBe(0);
      expect(readOrders()).toEqual(committed);

      await openDetails();
      await startEdit();
      await edit.locator('textarea[name="notes"]').fill(updatedMarker);
      await saveEdit();
      await expect(edit).toHaveCount(0);
      const edited = readOrders();
      expect(edited).toHaveLength(1);
      expect(edited[0]).toMatchObject({ ...committed[0], notes: updatedMarker, updated_at: edited[0].updated_at });
      expect(edited[0].updated_at).not.toBe(committed[0].updated_at);
      expect(updateRequests).toBe(1);
      const changeLog = JSON.parse(executeLearningSql(
        `select coalesce(json_agg(l),'[]') from (
          select id,action,actor_user_id,previous_data->>'notes' as previous_notes,next_data->>'notes' as next_notes
          from public.wholesale_order_change_logs where order_id='${committed[0].id}' and action='direct_update'
        ) l;`,
      ));
      expect(changeLog).toHaveLength(1);
      expect(changeLog[0]).toMatchObject({ actor_user_id: learningUser.id, previous_notes: marker, next_notes: updatedMarker });
      await page.reload();
      await openDetails();
      await expect(detail.getByText(updatedMarker, { exact: true })).toBeVisible();
      await expect(detail).toHaveCSS("opacity", "1");
      expect(readOrders()).toEqual(edited);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(errors).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`order-recovery-${language}-${width}.png`) });
      await writeFile(testInfo.outputPath("order-recovery-receipt.json"), JSON.stringify({ committed, edited, changeLog, requestIds }, null, 2));
    } finally {
      executeLearningSql(`begin;
        delete from public.wholesale_orders
          where customer_id='${id}' and notes in ('${marker}','${updatedMarker}') and created_by_user_id='${learningUser.id}';
        delete from public.wholesale_customers
          where id='${id}' and unique_name='${name}' and created_by_user_id='${learningUser.id}';
        commit;`);
      expect(readOrders()).toEqual([]);
      expect(executeLearningSql(`select count(*) from public.wholesale_customers where id='${id}';`)).toBe("0");
    }
  });
}
