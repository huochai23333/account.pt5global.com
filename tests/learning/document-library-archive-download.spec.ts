import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { prepareCustomerDocumentUpload } from "./customer-document-upload-fixture";
import { expect, test } from "./fixtures";

const endpoint = "**/api/document-library/download";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

for (const [locale, width, messages] of [["zh", 1440, zh], ["en", 390, en]] as const) {
  test(`资料库压缩包核对与错误恢复 ${locale}/${width}`, async ({ page, request, learningUser }, testInfo) => {
    const fixture = prepareCustomerDocumentUpload(learningUser);
    const files = ["first", "second"].map((label) => ({
      name: `${fixture.id}-${label}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(`Learning archive: ${label}`),
    }));
    const errors: string[] = [];
    let downloads = 0;
    let archiveRequests = 0;
    const copy = messages.Documents;
    const notice = messages.DashboardShell.announcements;
    try {
      await page.setViewportSize({ width, height: 900 });
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("download", () => { downloads += 1; });
      page.on("request", (attempt) => {
        if (new URL(attempt.url()).pathname === "/api/document-library/download") archiveRequests += 1;
      });
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      const announcement = page.getByRole("dialog", { name: notice.newTitle, exact: true });
      await page.addLocatorHandler(announcement, () => announcement.getByRole("button", { name: notice.acknowledge }).click());
      await page.goto(`/admin/documents?scope=folder&folder=${fixture.folderId}`);
      await page.locator('input[type="file"]').setInputFiles(files);
      await expect(page.locator("[data-document-file]")).toHaveCount(2);
      const saved = fixture.read();
      expect(saved.files).toHaveLength(2);
      for (const [index, file] of saved.files.entries()) {
        expect(file).toMatchObject({ status: "ready", version: 2, sha256: digest(files[index].buffer) });
        expect(await fixture.download(file.storage_path)).toEqual(files[index].buffer);
      }

      await page.locator(`[data-document-file="${saved.files[0].id}"]`).click();
      await page.locator(`[data-document-file="${saved.files[1].id}"]`).click({ modifiers: ["Control"] });
      await page.getByRole("button", { name: copy.download, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: copy.explorer.download, exact: true });
      const confirm = dialog.getByRole("button", { name: copy.confirm, exact: true });
      // 即使中间层错误地返回成功和压缩包类型，也不应下载实际并非压缩包的字节。
      await page.route(endpoint, (route) => route.fulfill({
        status: 200, contentType: "application/zip", body: "not a zip archive but HTTP succeeded",
      }), { times: 1 });
      await confirm.click();
      await expect(dialog.getByRole("alert")).toContainText(copy.errors.unconfirmed);
      expect(downloads).toBe(0);
      expect(fixture.read()).toEqual(saved);
      await page.screenshot({ path: testInfo.outputPath("archive-error.png"), animations: "disabled" });

      // 更新清单失败时不能继续用旧的确认。重读成功后再开放下载按钮。
      const reloadManifest = dialog.getByRole("button", { name: copy.explorer.reloadManifest, exact: true });
      await page.route("**/api/document-library/manifest", (route) => route.fulfill({
        status: 403, json: { error: "forbidden" },
      }), { times: 1 });
      await reloadManifest.click();
      await expect(dialog.getByRole("alert")).toContainText(copy.errors.forbidden);
      await expect(confirm).toBeDisabled();
      await reloadManifest.click();
      await expect(confirm).toBeEnabled();

      const target = saved.files[1].storage_path as string;
      const bucket = learningUser.client.storage.from("document-library");
      // 文件登记保留。桌面测试替换为等长错误字节，手机测试保留缺失对象。
      const removed = await bucket.remove([target]);
      expect(removed.error).toBeNull();
      if (locale === "zh") {
        const corrupt = await bucket.upload(target, Buffer.alloc(files[1].buffer.length, "x"), { contentType: files[1].mimeType });
        expect(corrupt.error).toBeNull();
      }
      const [failure] = await Promise.all([page.waitForResponse(endpoint), confirm.click()]);
      expect(failure.ok()).toBe(false);
      expect(await failure.json()).toMatchObject({ error: "unconfirmed" });
      await expect(dialog.getByRole("alert")).toContainText(copy.errors.unconfirmed);
      expect(downloads).toBe(0);
      const restored = await bucket.upload(target, files[1].buffer, { contentType: files[1].mimeType, upsert: true });
      expect(restored.error).toBeNull();

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        confirm.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); }),
      ]);
      expect(download.suggestedFilename()).toBe("PT5-documents.zip");
      expect(await download.failure()).toBeNull();
      const archive = unzipSync(await readFile(await download.path()));
      expect(Object.keys(archive).sort()).toEqual(files.map(({ name }) => name).sort());
      for (const file of files) expect(Buffer.from(archive[file.name])).toEqual(file.buffer);
      expect(downloads).toBe(1);
      expect(archiveRequests).toBe(3);
      await expect(dialog).toHaveCount(0);
      await page.reload();
      await expect(page.locator("[data-document-file]")).toHaveCount(2);
      const [single] = await Promise.all([
        page.waitForEvent("download"),
        page.locator(`[data-document-file="${saved.files[0].id}"]`).dblclick(),
      ]);
      expect(single.suggestedFilename()).toBe(files[0].name);
      expect(await readFile(await single.path())).toEqual(files[0].buffer);
      expect((await request.get(`/api/document-library/files/${saved.files[0].id}/content`)).status()).toBe(403);
      expect(fixture.read()).toEqual(saved);
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await writeFile(testInfo.outputPath("archive-receipt.json"), JSON.stringify({
        archiveName: download.suggestedFilename(),
        files: saved.files,
        downloadedSha256: Object.fromEntries(Object.entries(archive).map(([name, bytes]) => [name, digest(bytes)])),
      }, null, 2));
    } finally {
      const cleanup = await fixture.cleanup();
      expect(cleanup).toEqual({ customer: null, archiveCount: 0, files: [], operations: [], objects: [] });
      await writeFile(testInfo.outputPath("archive-cleanup.json"), JSON.stringify(cleanup));
    }
  });
}
