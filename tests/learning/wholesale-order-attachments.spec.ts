import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const bucket = "wholesale-order-lists";

for (const [language, width] of [["zh", 1440], ["en", 390]] as const) {
  test(`订单附件登记回执丢失后仍可下载与删除 ${language}/${width}`, async ({ page, learningUser }, testInfo) => {
    const { ordersUi } = (language === "zh" ? zh : en).WholesaleBusiness;
    const orderId = randomUUID();
    const customerId = randomUUID();
    const orderNumber = `Learning-${orderId}`;
    const filename = `learning-${orderId}.csv`;
    const csv = Buffer.from("name,quantity\nlearning,2\n");
    const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
    // 记录本次合成附件的传输阶段，区分真实删除失败和测试的过短等待；不记录签名或请求头。
    const deletionProbe = { startedAt: 0, interceptedAt: 0, abortedAt: 0 };
    const transfers: { method: string; path: string; at: number }[] = [];
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path.includes("/storage/v1/object/") || path.endsWith("/wholesale_order_list_attachments"))
        transfers.push({ method: request.method(), path, at: Date.now() });
    });
    const scope = `${orderId}/${learningUser.id}`;
    const readRows = () => JSON.parse(executeLearningSql(`
      select coalesce(json_agg(a),'[]') from (
        select id, order_id, bucket_name, storage_path, file_size_bytes, original_name, uploaded_by_user_id
        from public.wholesale_order_list_attachments where order_id='${orderId}'
      ) a;`));
    const readObjectPaths = (): string[] => JSON.parse(executeLearningSql(`
      select coalesce(json_agg(name),'[]') from storage.objects
      where bucket_id='${bucket}' and name like '${scope}/%';`));

    // 准备独立订单以聚焦附件操作。上传、下载与删除仍全部从页面发起。
    executeLearningSql(`begin;
      insert into public.wholesale_customers (id, unique_name, created_by_user_id, salesman_commission_cohort)
        values ('${customerId}','${orderNumber}','${learningUser.id}','new');
      insert into public.wholesale_orders (id, order_number, customer_id, created_by_user_id, order_month)
        values ('${orderId}','${orderNumber}','${customerId}','${learningUser.id}',date_trunc('month',now())::date);
      commit;`);

    try {
      await page.context().addCookies([{ name: "bs-locale", value: "zh", url: "http://localhost:3000" }]);
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: language, url: "http://localhost:3000" }]);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/wholesale/orders");

      const detail = page.getByRole("dialog", {
        name: ordersUi.detailFields.title.replace("{number}", orderNumber),
      });
      const manager = page.getByRole("dialog", { name: `${ordersUi.orderList.title} · ${orderNumber}` });
      const openDetails = async () => {
        if (width < 1024) {
          await page.getByTestId(`wholesale-order-card-${orderId}`).click();
        } else {
          await page.getByTestId(`wholesale-order-row-${orderId}`)
            .getByRole("button", { name: ordersUi.compactColumns.details, exact: true }).click();
        }
        await expect(detail).toBeVisible();
      };
      const openManager = async () => {
        await detail.getByRole("button", { name: ordersUi.orderList.manage, exact: true }).click();
        await expect(manager).toBeVisible();
      };
      await openDetails();
      await openManager();
      await expect(manager.getByText(ordersUi.orderList.noneUploaded, { exact: true })).toBeVisible();
      await manager.locator('input[type="file"]').setInputFiles({ name: filename, mimeType: "text/csv", buffer: csv });
      let registerRequests = 0;
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.endsWith("/rpc/register_wholesale_order_list_attachments")) {
          registerRequests += 1;
        }
      });
      // 真正提交登记，独立确认事务完成后再丢弃浏览器回执。
      await page.route("**/rpc/register_wholesale_order_list_attachments", async (route) => {
        const response = await route.fetch({ maxRetries: 0 });
        expect(response.ok()).toBe(true);
        expect(readRows()).toHaveLength(1);
        await route.abort("connectionreset");
      }, { times: 1 });
      if (language === "en") {
        // 同时丢掉第一次登记核对，下一次点击应只重新核对原批次。
        await page.route(/\/wholesale_order_list_attachments\?.*storage_path=in\./, (route) =>
          route.abort("connectionreset"), { times: 1 });
      }
      const upload = manager.getByRole("button", { name: ordersUi.orderList.upload, exact: true });
      await upload.evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
      });
      await expect.poll(() => readRows()).toHaveLength(1);
      await expect.poll(async () => await manager.isHidden() || await upload.isEnabled()).toBe(true);
      const [row] = readRows();
      expect(readObjectPaths(), "已登记的对象不能被失败清理删除").toEqual([row.storage_path]);
      if (language === "en") {
        await expect(manager.getByRole("status")).toHaveText(ordersUi.orderList.uploadUnconfirmed);
        await upload.click();
      }
      await expect(manager).toBeHidden();
      expect(registerRequests).toBe(1);
      expect(row).toMatchObject({
        order_id: orderId, bucket_name: bucket, file_size_bytes: csv.length,
        original_name: filename, uploaded_by_user_id: learningUser.id,
      });
      const independentlyDownloaded = await learningUser.client.storage.from(bucket).download(row.storage_path);
      expect(independentlyDownloaded.error).toBeNull();
      expect(sha(Buffer.from(await independentlyDownloaded.data!.arrayBuffer()))).toBe(sha(csv));

      await page.reload();
      await openDetails();
      const fileButton = detail.getByRole("button", { name: filename, exact: true });
      const downloadPromise = page.waitForEvent("download");
      await fileButton.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(filename);
      await openManager();
      await expect(manager).toHaveCSS("opacity", "1");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`order-attachments-${language}-${width}.png`) });
      const deleteFile = async () => {
        await manager.locator("[data-attachment-name]").filter({ hasText: filename })
          .getByRole("button", { name: ordersUi.orderList.delete, exact: true }).click();
        const confirm = page.getByRole("dialog", { name: (language === "zh" ? zh : en).DashboardFramework.confirm.title });
        await confirm.getByRole("button", {
          name: (language === "zh" ? zh : en).DashboardFramework.confirm.accept,
          exact: true,
        }).click();
      };
      let storageDeletes = 0;
      page.on("request", (request) => {
        if (request.method() === "DELETE" &&
          new URL(request.url()).pathname.endsWith("/storage/v1/object/wholesale-order-lists")) {
          storageDeletes += 1;
        }
      });
      if (language === "en") {
        // 文件已真实删除，阻断本次登记删除，随后刷新验证能否从存量记录续办。
        let blockedDelete = false;
        await page.route(/\/wholesale_order_list_attachments\?/, async (route) => {
          if (route.request().method() !== "DELETE") return route.fallback();
          deletionProbe.interceptedAt = Date.now();
          expect(readObjectPaths()).toEqual([]);
          expect(readRows()).toEqual([row]);
          await route.abort("connectionreset");
          deletionProbe.abortedAt = Date.now();
          blockedDelete = true;
        });
        deletionProbe.startedAt = Date.now();
        await deleteFile();
        // 删除须先经过真实登记读取、Storage 删除和目录核对，不能限制整个链路为默认五秒。
        await expect.poll(() => blockedDelete, { timeout: 30_000 }).toBe(true);
        await expect(page.getByText(ordersUi.orderList.deleteIncomplete, { exact: true })).toBeVisible();
        expect(readRows()).toEqual([row]);
        expect(readObjectPaths()).toEqual([]);
        await page.unroute(/\/wholesale_order_list_attachments\?/);
        await page.reload();
        await openDetails();
        await openManager();
      } else {
        // 目录读取错误没有“不存在”的含义，两个系统都不能被改动。
        await page.route("**/storage/v1/object/list/wholesale-order-lists", (route) =>
          route.fulfill({ status: 400, json: { message: "learning list failure" } }), { times: 1 });
        await deleteFile();
        await expect(page.getByText(ordersUi.orderList.deleteFailed, { exact: true })).toBeVisible();
        expect(readRows()).toEqual([row]);
        expect(readObjectPaths()).toEqual([row.storage_path]);
        expect(storageDeletes).toBe(0);
      }
      await deleteFile();
      await expect.poll(() => readRows()).toEqual([]);
      expect(readObjectPaths()).toEqual([]);
      await expect(manager.getByText(ordersUi.orderList.noneUploaded, { exact: true })).toBeVisible();
      await expect.poll(() => storageDeletes).toBe(1);
      if (language === "zh") {
        // 让真实数据库因不合格的附件大小拒绝整个登记事务，验证补偿只清理本次对象。
        await page.route("**/rpc/register_wholesale_order_list_attachments", async (route) => {
          const payload = route.request().postDataJSON();
          payload.p_attachments[0].file_size_bytes = -1;
          const response = await route.fetch({ postData: payload, maxRetries: 0 });
          expect((await response.json()).code).toBe("23514");
          await route.fulfill({ response });
        }, { times: 1 });
        await manager.locator('input[type="file"]').setInputFiles({ name: filename, mimeType: "text/csv", buffer: csv });
        await upload.click();
        await expect(manager.getByRole("status")).toHaveText(ordersUi.orderList.uploadUnconfirmed);
        expect(readRows()).toEqual([]);
        expect(readObjectPaths()).toEqual([]);
        expect(registerRequests).toBe(2);
      }
      await page.reload();
      await openDetails();
      await expect(fileButton).toHaveCount(0);
      await writeFile(testInfo.outputPath("attachment-receipt.json"), JSON.stringify({
        ...row, sha256: sha(csv), registerRequests, deletedRows: 1, objectsAfterDelete: 0,
        rejectionCleanupVerified: language === "zh", failedReadRecoveryVerified: language === "en",
      }, null, 2));
    } finally {
      await writeFile(testInfo.outputPath("attachment-observation.json"), JSON.stringify({
        language, width, deletionProbe, transfers, rowsBeforeCleanup: readRows(), objectsBeforeCleanup: readObjectPaths(),
      }, null, 2));
      const paths = readObjectPaths();
      if (paths.length) {
        // 对象只能通过 Storage API 清理。按本次订单和上传者限定目录，再独立读回。
        const result = await learningUser.client.storage.from(bucket).remove(paths);
        expect(result.error).toBeNull();
      }
      expect(readObjectPaths()).toEqual([]);
      executeLearningSql(`begin;
        delete from public.wholesale_orders where id='${orderId}' and customer_id='${customerId}'
          and order_number='${orderNumber}' and created_by_user_id='${learningUser.id}';
        delete from public.wholesale_customers where id='${customerId}' and unique_name='${orderNumber}'
          and created_by_user_id='${learningUser.id}';
        commit;`);
      expect(readRows()).toEqual([]);
    }
  });
}
