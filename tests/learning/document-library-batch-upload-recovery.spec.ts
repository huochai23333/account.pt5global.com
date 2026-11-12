import { writeFile } from "node:fs/promises";
import type { Page } from "@playwright/test";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser, type createLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { prepareCustomerDocumentUpload } from "./customer-document-upload-fixture";
import { expect, test } from "./fixtures";

const uploadPath = "**/api/document-library/upload";
const empty = { customer: null, archiveCount: 0, files: [], operations: [], objects: [] };

async function openFolder(page: Page, user: Awaited<ReturnType<typeof createLearningUser>>, url: string, locale: "zh" | "en", width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
    await page.keyboard.press("Escape");
  });
  await loginLearningUser(page, user);
  await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
  await page.goto(url);
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
}

function checkOriginalOperation(page: Page) {
  return page.waitForResponse((response) => response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/document-library/reconcile");
}

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  const copy = (locale === "zh" ? zh : en).Documents;
  test(`批量上传断线后只更新原文件的结果 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    const fixture = prepareCustomerDocumentUpload(learningUser);
    const files = [
      { name: `${fixture.id}-normal.txt`, mimeType: "text/plain", buffer: Buffer.from("Normal payload") },
      { name: `${fixture.id}-disconnect.txt`, mimeType: "text/plain", buffer: Buffer.from("Disconnect after commit") },
      { name: `${fixture.id}-invalid.txt`, mimeType: "text/plain", buffer: Buffer.alloc(0) },
    ];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await openFolder(page, learningUser, `/admin/documents?scope=folder&folder=${fixture.folderId}`, locale, width);
      let requests = 0;
      await page.route(uploadPath, async (route) => {
        // 只丢掉第二份文件的响应。其余文件仍按真实写入及校验规则完成或拒绝。
        requests += 1;
        if (requests !== 2) return route.continue();
        const response = await route.fetch({ maxRetries: 0 });
        expect(response.ok()).toBe(true);
        await route.abort("connectionreset");
      });
      await page.locator('input[type="file"]').setInputFiles(files);
      const notice = page.locator('[data-document-result="partial_failed"]');
      const item = (name: string) => page.locator("[data-document-upload-result]").filter({ hasText: name });
      await expect(notice).toContainText(copy.errors.partial, { timeout: 15_000 });
      await expect(item(files[0].name)).toHaveAttribute("data-document-upload-result", "succeeded");
      await expect(item(files[1].name)).toContainText(copy.errors.unconfirmed);
      await expect(item(files[2].name)).toContainText(copy.errors.invalid);
      const committed = fixture.read();
      expect(committed.files).toHaveLength(2);
      expect(committed.operations).toHaveLength(2);
      expect(committed.objects).toHaveLength(2);
      for (const input of files.slice(0, 2)) {
        const stored = committed.files.find((row: { original_name: string }) => row.original_name === input.name);
        expect(stored).toMatchObject({ status: "ready", version: 2, size_bytes: input.buffer.length });
        expect(await fixture.download(stored.storage_path)).toEqual(input.buffer);
      }
      const pending = page.getByRole("button", { name: copy.reconcile, exact: true });
      // 原操作核对也可能断线。仍有已确认文件时，整批保持部分完成。
      await page.route("**/api/document-library/reconcile", (route) => route.abort("connectionreset"), { times: 1 });
      await Promise.all([
        page.waitForEvent("requestfailed", (request) => request.method() === "POST" && request.url().endsWith("/reconcile")),
        pending.click(),
      ]);
      await expect(pending).toBeEnabled();
      await expect(notice).toContainText(copy.errors.partial);
      expect(fixture.read()).toEqual(committed);
      const [response] = await Promise.all([checkOriginalOperation(page), pending.click()]);
      expect(await response.json()).toMatchObject({
        operationId: committed.operations.find((row: { filename: string }) => row.filename === files[1].name).id,
        status: "succeeded",
      });
      await expect(item(files[1].name)).toHaveAttribute("data-document-upload-result", "succeeded");
      await expect(item(files[2].name)).toHaveAttribute("data-document-upload-result", "failed");
      const summary = copy.explorer.uploadSummary.replace("{done}", "2").replace("{total}", "3");
      await expect(page.locator("[data-document-upload-summary]").getByRole("status")).toHaveText(summary);
      await expect(notice).toContainText(copy.errors.partial);
      await expect(page.locator('[data-document-result="succeeded"]')).toHaveCount(0);
      await expect(pending).toHaveCount(0);
      await notice.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("batch-upload-partial.png"), animations: "disabled" });
      await page.reload();
      for (const input of files.slice(0, 2)) await expect(page.getByText(input.name, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText(files[2].name, { exact: true })).toHaveCount(0);
      expect(fixture.read()).toEqual(committed);
      expect(requests).toBe(3);
      expect(errors).toEqual([]);
      await writeFile(testInfo.outputPath("batch-upload-receipt.json"), JSON.stringify(committed, null, 2));
    } finally {
      const cleanup = await fixture.cleanup();
      expect(cleanup).toEqual(empty);
      await writeFile(testInfo.outputPath("document-cleanup.json"), JSON.stringify(cleanup));
    }
  });

  test(`撤回客户目录权限后原凭证不能恢复 ${locale}/${width}`, async ({ page, learningStaff }, testInfo) => {
    const fixture = prepareCustomerDocumentUpload(learningStaff);
    const location = `?scope=folder&folder=${fixture.folderId}`;
    try {
      await openFolder(page, learningStaff, `/salesman/documents${location}`, locale, width);
      await page.route(uploadPath, async (route) => {
        const response = await route.fetch({ maxRetries: 0 });
        expect(response.ok()).toBe(true);
        await route.abort("connectionreset");
      }, { times: 1 });
      const bytes = Buffer.from("Preserve the file when access is withdrawn");
      await page.locator('input[type="file"]').setInputFiles({ name: fixture.filename, mimeType: "text/plain", buffer: bytes });
      await expect(page.locator('[data-document-upload-result="failed"]')).toContainText(copy.errors.unconfirmed);
      const saved = fixture.read();
      expect(saved.files).toHaveLength(1);
      expect(saved.operations).toHaveLength(1);

      // 只变更本次账号的真实数据库岗位。账号仍有效，但推广岗位在本地无客户目录权限。
      executeLearningSql(`update public.user_roles_data set role_id=(select id from public.user_roles where role='promoter')
        where user_id='${learningStaff.id}';`);
      const pending = page.getByRole("button", { name: copy.reconcile, exact: true });
      const [response] = await Promise.all([checkOriginalOperation(page), pending.click()]);
      expect(response.status()).toBe(403);
      expect(await response.json()).toEqual({ error: "forbidden" });
      await expect(page.locator('[data-document-result="failed"]')).toContainText(copy.errors.forbidden);
      await expect(page.locator('[data-document-result="succeeded"]')).toHaveCount(0);
      await expect(page.locator(`[data-document-file="${saved.files[0].id}"]`)).toHaveCount(0);
      expect(fixture.read()).toEqual(saved);
      expect(await fixture.download(saved.files[0].storage_path)).toEqual(bytes);
      await page.goto(`/promoter/documents${location}`);
      await expect(page.getByRole("alert").filter({ hasText: copy.errors.forbidden })).toBeVisible();
      await expect(page.getByText(fixture.filename, { exact: true })).toHaveCount(0);
      expect(fixture.read()).toEqual(saved);
      await writeFile(testInfo.outputPath("withdrawal-receipt.json"), JSON.stringify(saved, null, 2));
    } finally {
      const cleanup = await fixture.cleanup();
      expect(cleanup).toEqual(empty);
      await writeFile(testInfo.outputPath("document-cleanup.json"), JSON.stringify(cleanup));
    }
  });
}
