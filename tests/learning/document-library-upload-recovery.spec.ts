import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { prepareCustomerDocumentUpload } from "./customer-document-upload-fixture";
import { expect, test } from "./fixtures";

const uploadPath = "**/api/document-library/upload";

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  test(`资料上传重送与断线恢复 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    const copy = (locale === "zh" ? zh : en).Documents;
    const fixture = prepareCustomerDocumentUpload(learningUser);
    const bytes = Buffer.from(`Learning upload recovery ${fixture.id}\n`);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const initial = fixture.read();
      expect(initial).toMatchObject({ archiveCount: 1, files: [], operations: [], objects: [] });
      await page.setViewportSize({ width, height: 900 });
      await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
        await page.keyboard.press("Escape");
      });
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      await page.goto(`/admin/documents?scope=folder&folder=${fixture.folderId}`);
      await expect(page.getByRole("heading", { name: copy.title, exact: true })).toBeVisible();
      // 两份相同请求都走真实本地服务，再丢弃浏览器的响应。核对两次提交返回同一凭证。
      let replies: unknown[] = [];
      await page.route(uploadPath, async (route) => {
        const responses = await Promise.all([route.fetch({ maxRetries: 0 }), route.fetch({ maxRetries: 0 })]);
        replies = await Promise.all(responses.map((response) => response.json()));
        await route.abort("connectionreset");
      }, { times: 1 });
      await page.locator('input[type="file"]').setInputFiles({ name: fixture.filename, mimeType: "text/plain", buffer: bytes });
      await expect(page.locator('[data-document-upload-result="failed"]')).toContainText(copy.errors.unconfirmed, { timeout: 20_000 });
      expect(replies).toHaveLength(2);
      expect(replies[0]).toEqual(replies[1]);
      const committed = fixture.read();
      expect(committed.customer).toEqual(initial.customer);
      expect(committed.files).toHaveLength(1);
      expect(committed.operations).toHaveLength(1);
      const [file] = committed.files;
      const [operation] = committed.operations;
      expect(file).toMatchObject({ status: "ready", version: 2, size_bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex") });
      expect(replies[0]).toMatchObject({ operationId: operation.id, status: "succeeded", affectedCount: 1, record: { id: file.id, version: 2 } });
      expect(committed.objects).toEqual([file.storage_path]);
      expect(await fixture.download(file.storage_path)).toEqual(bytes);

      // 重新打开页面后核对原操作。只有恢复按钮可以继续确认，没有再次提交上传。
      await page.reload();
      const reconcile = page.getByRole("button", { name: copy.reconcile, exact: true });
      await expect(reconcile).toBeVisible();
      await reconcile.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("upload-awaiting-reconcile.png"), animations: "disabled" });
      const [response] = await Promise.all([
        page.waitForResponse((result) => new URL(result.url()).pathname === "/api/document-library/reconcile" && result.request().method() === "POST"),
        reconcile.click(),
      ]);
      expect(await response.json()).toMatchObject({ operationId: operation.id, status: "succeeded", record: { id: file.id, version: 2 } });
      await expect(reconcile).toHaveCount(0);
      await page.reload();
      await expect(page.getByText(fixture.filename, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      expect(fixture.read()).toEqual(committed);
      expect(errors).toEqual([]);
      await writeFile(testInfo.outputPath("upload-recovery-receipt.json"), JSON.stringify({ initial, committed }, null, 2));
    } finally {
      const cleanup = await fixture.cleanup();
      expect(cleanup).toEqual({ customer: null, archiveCount: 0, files: [], operations: [], objects: [] });
      await writeFile(testInfo.outputPath("upload-recovery-cleanup.json"), JSON.stringify(cleanup));
    }
  });
}
