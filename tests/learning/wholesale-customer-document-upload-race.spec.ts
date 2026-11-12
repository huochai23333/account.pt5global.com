import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import type { Page } from "@playwright/test";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";
import { prepareCustomerDocumentUpload } from "./customer-document-upload-fixture";
import { holdCustomerUploadProfile } from "./customer-document-upload-lock";

const uploadRoute = "**/api/document-library/upload";
const deletePath = "/rpc/delete_wholesale_customer";
const directoryPath = "/admin/wholesale/customers";
const empty = { customer: null, archiveCount: 0, files: [], operations: [], objects: [] };

function customerDirectory(page: Page, copy: typeof en.UiText, name: string) {
  const detail = copy.components_dashboard_wholesale_wholesale_customer_details;
  const deletion = copy.components_dashboard_wholesale_wholesale_customer_delete_dialog;
  const customer = page.getByRole("button", { name: new RegExp(`^${name}`) });
  const confirmation = page.getByRole("dialog", { name: deletion.attribute002 });
  return {
    customer,
    confirmation,
    async find() {
      await page.getByPlaceholder(copy.components_dashboard_wholesale_wholesale_people_tabs.attribute003).fill(name);
    },
    async open() {
      await customer.click();
      await page.getByRole("dialog", { name, exact: true })
        .getByRole("button", { name: detail.text002.trim(), exact: true }).click();
    },
    confirm: () => confirmation.getByRole("button", { name: deletion.text004.trim(), exact: true }).click(),
  };
}

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  const messages = locale === "zh" ? zh : en;
  for (const uploadWins of [true, false]) {
    test(`资料上传与客户删除 ${uploadWins ? "上传先登记" : "删除先完成"} ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
      const fixture = prepareCustomerDocumentUpload(learningUser);
      const directory = customerDirectory(page, messages.UiText, fixture.name);
      const documentUrl = `/admin/documents?scope=folder&folder=${fixture.folderId}`;
      const buffer = Buffer.from(`Synthetic document ${fixture.id}\n`);
      const payload = { name: fixture.filename, mimeType: "text/plain", buffer };
      const errors: string[] = [];
      let documents: Page | undefined;
      let holder: ReturnType<typeof holdCustomerUploadProfile> | undefined;
      let continueUpload = () => {};
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        const initial = fixture.read();
        expect(initial).toMatchObject({ customer: { id: fixture.id }, archiveCount: 1, files: [], operations: [], objects: [] });
        await page.setViewportSize({ width, height: 900 });
        await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
          await page.keyboard.press("Escape");
        });
        await loginLearningUser(page, learningUser);
        await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
        documents = await page.context().newPage();
        documents.on("pageerror", (error) => errors.push(error.message));
        await documents.setViewportSize({ width, height: 900 });
        await page.goto(directoryPath);
        await directory.find();
        await directory.open();
        await documents.goto(documentUrl);
        await expect(documents.getByRole("heading", { name: messages.Documents.title, exact: true })).toBeVisible();
        const picker = documents.locator('input[type="file"]');
        const uploadResponse = () => documents!.waitForResponse((response) => new URL(response.url()).pathname === "/api/document-library/upload", { timeout: 25_000 });
        const deleteResponse = () => page.waitForResponse((response) => response.url().endsWith(deletePath), { timeout: 25_000 });

        if (uploadWins) {
          holder = holdCustomerUploadProfile(learningUser.id, fixture.id);
          await expect.poll(holder.isReady).toBe(true);
          const uploaded = uploadResponse();
          await picker.setInputFiles(payload);
          await expect.poll(() => holder!.blocked(false), { timeout: 8_000 }).toBe(true);
          const deleted = deleteResponse();
          await directory.confirm();
          // 三个连接构成真实等待链。释放专属行后，上传登记应先提交。
          await expect.poll(() => holder!.blocked(true), { timeout: 8_000 }).toBe(true);
          expect(fixture.read()).toEqual(initial);
          expect(await holder.release()).toEqual({ committed: true, error: "" });
          const [upload, deletion] = await Promise.all([uploaded, deleted]);
          expect(upload.ok()).toBe(true);
          expect(deletion.ok()).toBe(false);
          const final = fixture.read();
          expect(final).toMatchObject({ customer: initial.customer, archiveCount: 1 });
          expect(final.files).toHaveLength(1);
          expect(final.operations).toHaveLength(1);
          const [file] = final.files;
          expect(file).toMatchObject({ folder_id: fixture.folderId, status: "ready", size_bytes: buffer.length,
            sha256: createHash("sha256").update(buffer).digest("hex") });
          expect(final.operations[0]).toMatchObject({ status: "succeeded", affected: "1" });
          expect(final.objects).toEqual([file.storage_path]);
          expect(await fixture.download(file.storage_path)).toEqual(buffer);
          expect(await deletion.json()).toMatchObject({ message: "document_customer_has_files" });
          await expect(directory.confirmation.getByRole("alert")).toHaveText(messages.WholesaleBusiness.customerWrite.deleteHasDocuments);
          await page.screenshot({ path: testInfo.outputPath("customer-delete-upload-conflict.png"), animations: "disabled" });
          await Promise.all([page.reload(), documents.reload()]);
          await directory.find();
          await expect(directory.customer).toBeVisible();
          await expect(documents.getByText(fixture.filename, { exact: true }).filter({ visible: true }).first()).toBeVisible();
          expect(fixture.read()).toEqual(final);
          await writeFile(testInfo.outputPath("document-race-receipt.json"), JSON.stringify({ initial, final }, null, 2));
        } else {
          // 文件已在页面选择，暂缓上传请求，等另一页完成档案删除再发送。
          const gate = new Promise<void>((resolve) => { continueUpload = resolve; });
          let uploadWaiting = false;
          await documents.route(uploadRoute, async (route) => {
            uploadWaiting = true;
            await gate;
            await route.continue();
          }, { times: 1 });
          const uploaded = uploadResponse();
          await picker.setInputFiles(payload);
          await expect.poll(() => uploadWaiting).toBe(true);
          const [deletion] = await Promise.all([deleteResponse(), directory.confirm()]);
          expect(deletion.ok()).toBe(true);
          await expect(directory.confirmation).toHaveCount(0);
          expect(fixture.read()).toEqual(empty);
          continueUpload();
          const upload = await uploaded;
          expect(upload.status()).toBe(403);
          await expect(documents.locator('[data-document-upload-result="failed"]')).toContainText(messages.Documents.errors.forbidden);
          await Promise.all([page.reload(), documents.reload()]);
          await directory.find();
          await expect(directory.customer).toHaveCount(0);
          await expect(documents.getByText(fixture.filename, { exact: true })).toHaveCount(0);
          expect(fixture.read()).toEqual(empty);
          await writeFile(testInfo.outputPath("document-race-receipt.json"), JSON.stringify({ initial, final: empty }, null, 2));
        }
        expect(errors).toEqual([]);
      } finally {
        continueUpload();
        await holder?.release();
        await documents?.close();
        const cleanup = await fixture.cleanup();
        expect(cleanup).toEqual(empty);
        await writeFile(testInfo.outputPath("document-race-cleanup.json"), JSON.stringify(cleanup));
      }
    });
  }
}
