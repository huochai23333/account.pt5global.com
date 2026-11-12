import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const bucket = "customer-inventory-order-lists";
const registerPath = "**/rpc/register_customer_inventory_order_list_attachments";

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  const copy = (locale === "zh" ? zh : en).CustomerInventory;
  test(`库存附件登记丢失响应后从原路径恢复 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    const orderId = randomUUID();
    const customerId = randomUUID();
    const orderNumber = `Learning-${orderId}`;
    const filename = `${orderId}.csv`;
    const bytes = Buffer.from("name,quantity\nlearning-stock,2\n");
    const scope = `${orderId}/${learningUser.id}/`;
    const read = () => JSON.parse(executeLearningSql(`select json_build_object(
      'attachments',(select coalesce(json_agg(a),'[]') from public.customer_inventory_order_list_attachments a where order_id='${orderId}'),
      'objects',(select coalesce(json_agg(name),'[]') from storage.objects where bucket_id='${bucket}' and name like '${scope}%'),
      'order',(select json_build_object('id',id,'revision',revision) from public.customer_inventory_orders where id='${orderId}'),
      'customer',(select id from public.wholesale_customers where id='${customerId}')); `));
    const storage = learningUser.client.storage.from(bucket);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // 只用 SQL 准备独立订单，实际附件操作全部从页面发起。
    executeLearningSql(`begin;
      insert into public.wholesale_customers(id,unique_name,created_by_user_id)
        values ('${customerId}','${orderNumber}','${learningUser.id}');
      insert into public.customer_inventory_orders(id,order_number,customer_id,sales_user_id,purchase_amount,currency,created_by_user_id)
        values ('${orderId}','${orderNumber}','${customerId}','${learningUser.id}',300,'USD','${learningUser.id}');
      commit;`);
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
        await page.keyboard.press("Escape");
      });
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      await page.goto("/admin/wholesale/inventory-orders");
      const dialog = page.getByRole("dialog", { name: copy.attachments.title.replace("{number}", orderNumber) });
      const open = () => (width < 1024
        ? page.locator("article").filter({ hasText: orderNumber }).getByRole("button", { name: copy.orders.attachments, exact: true })
        : page.getByRole("row").filter({ hasText: orderNumber }).getByRole("button", { name: /^\d+ (?:个附件|files)$/ })
      ).click();
      await open();
      await expect(dialog.getByText(copy.attachments.empty, { exact: true })).toBeVisible();
      await dialog.locator('input[type="file"]').setInputFiles({ name: filename, mimeType: "text/csv", buffer: bytes });
      let registrations = 0;
      page.on("request", (request) => {
        if (request.url().endsWith("/rpc/register_customer_inventory_order_list_attachments")) registrations += 1;
      });
      // 执行真实登记，然后断开回浏览器的响应。
      await page.route(registerPath, async (route) => {
        const response = await route.fetch({ maxRetries: 0 });
        expect(response.ok()).toBe(true);
        expect(read().attachments).toHaveLength(1);
        await route.abort("connectionreset");
      }, { times: 1 });
      if (locale === "en") {
        await page.route(/\/customer_inventory_order_list_attachments\?.*storage_path=in\./, (route) =>
          route.abort("connectionreset"), { times: 1 });
      }
      const upload = dialog.getByRole("button", { name: copy.attachments.upload, exact: true });
      await upload.evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
      });
      await expect.poll(() => read().attachments).toHaveLength(1);
      if (locale === "en") {
        await expect(dialog.getByRole("status")).toHaveText(copy.attachments.uploadUnconfirmed);
        await expect.poll(() => read().objects, { message: "登记待核对时保留真实对象" }).toHaveLength(1);
        await dialog.getByRole("button", { name: copy.attachments.checkUpload, exact: true }).click();
      } else {
        await expect(upload).not.toHaveAttribute("aria-busy", "true");
        await expect.poll(() => read().objects, { message: "登记已提交的文件仍有真实对象" }).toHaveLength(1);
      }
      await expect(dialog.getByRole("button", { name: copy.attachments.download, exact: true })).toBeVisible();
      const receipt = read();
      const [row] = receipt.attachments;
      expect(row).toMatchObject({ order_id: orderId, file_size_bytes: bytes.length, original_name: filename });
      expect(receipt.objects).toEqual([row.storage_path]);
      expect(receipt.order).toEqual({ id: orderId, revision: 1 });
      const downloaded = await storage.download(row.storage_path);
      expect(downloaded.error).toBeNull();
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      expect(createHash("sha256").update(Buffer.from(await downloaded.data!.arrayBuffer())).digest("hex")).toBe(sha256);
      await page.reload();
      await open();
      await expect(dialog.getByText(filename, { exact: true })).toBeVisible();
      expect(read()).toEqual(receipt);
      expect(registrations).toBe(1);
      const fileDownload = page.waitForEvent("download");
      await dialog.getByRole("button", { name: copy.attachments.download, exact: true }).click();
      expect((await fileDownload).suggestedFilename()).toBe(filename);
      await expect(dialog.getByRole("button", { name: copy.attachments.download, exact: true })).toBeEnabled();
      await expect(dialog).toHaveCSS("opacity", "1");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      // 页面整体不溢出仍可能出现弹窗内部横移；单独检查标题及底部操作区。
      await expect.poll(() => dialog.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const title = element.querySelector("h3")!.getBoundingClientRect();
        const actions = element.querySelector('[data-testid="dashboard-dialog-actions"]')!.getBoundingClientRect();
        return {
          scrollLeft: element.scrollLeft,
          titleClipped: title.left < box.left - 1,
          footerClipped: actions.left < box.left - 1,
        };
      })).toEqual({ scrollLeft: 0, titleClipped: false, footerClipped: false });
      await page.screenshot({ path: testInfo.outputPath("inventory-attachment.png"), animations: "disabled" });

      if (locale === "zh") {
        // 数据库真实拒绝尺寸不合格的登记，只允许清理第二次上传的未登记对象。
        let rejected = false;
        await page.route(registerPath, async (route) => {
          const payload = route.request().postDataJSON();
          payload.p_attachments[0].file_size_bytes = 0;
          const response = await route.fetch({ postData: payload });
          expect((await response.json()).message).toBe("customer_inventory_attachments_invalid");
          expect(read().objects).toHaveLength(2);
          rejected = true;
          await route.fulfill({ response });
        }, { times: 1 });
        await dialog.locator('input[type="file"]').setInputFiles({ name: `rejected-${filename}`, mimeType: "text/csv", buffer: bytes });
        await upload.click();
        await expect.poll(() => rejected).toBe(true);
        await expect(upload).toBeEnabled();
        expect(read()).toEqual(receipt);
      }
      await dialog.getByRole("button", { name: copy.attachments.delete, exact: true }).click();
      await expect(dialog.getByText(copy.attachments.empty, { exact: true })).toBeVisible();
      expect(read()).toEqual({ ...receipt, attachments: [], objects: [] });
      expect((await storage.exists(row.storage_path)).data).toBe(false);
      await page.reload();
      await open();
      await expect(dialog.getByText(copy.attachments.empty, { exact: true })).toBeVisible();
      expect(read()).toEqual({ ...receipt, attachments: [], objects: [] });
      expect(errors).toEqual([]);
      await writeFile(testInfo.outputPath("inventory-attachment-receipt.json"), JSON.stringify({ receipt, sha256 }, null, 2));
    } finally {
      const paths: string[] = read().objects;
      if (paths.length) expect((await storage.remove(paths)).error).toBeNull();
      executeLearningSql(`begin;
        delete from public.customer_inventory_order_list_attachments where order_id='${orderId}' and uploaded_by_user_id='${learningUser.id}';
        delete from public.customer_inventory_orders where id='${orderId}' and created_by_user_id='${learningUser.id}';
        delete from public.wholesale_customers where id='${customerId}' and created_by_user_id='${learningUser.id}';
        commit;`);
      const clean = read();
      expect(clean).toEqual({ attachments: [], objects: [], order: null, customer: null });
      await writeFile(testInfo.outputPath("inventory-attachment-cleanup.json"), JSON.stringify(clean));
    }
  });
}
