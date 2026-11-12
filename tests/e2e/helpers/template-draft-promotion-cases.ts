import { expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { documentAdmin } from "./document-library";
import { documentLogin } from "./document-library";
import { readPersonalDocument } from "./company-template-documents";
import { expectDocumentSaved } from "./company-template-documents";
import { runDocumentFixtureSql } from "./document-write-lock";
import { createTemplateDraftInsertFault } from "../../test-support/template-draft-insert-fault";
import { test } from "./template-draft-fixture";
import { openDraft } from "./template-draft-fixture";
import { draft } from "./template-draft-fixture";
import { cleanup } from "./template-draft-fixture";
import { settleDraftPage } from "./template-draft-fixture";
/** 重名/零影响及丢失响应；故障只作用于本次编号和专属数据库。 */
export function registerDraftPromotionCases() {
  test("同名忽略大小写拒绝转正，零行插入回滚保留草稿，修复后原操作完成", async ({ page }) => {
    test.setTimeout(150000);
    const ids: string[] = [];
    const prefix = `draft-zero-${randomUUID()}-`;
    const db = documentAdmin();
    let fault: ReturnType<typeof createTemplateDraftInsertFault> | undefined;
    try {
      await documentLogin(page, "salesman");
      const first = await openDraft(page, ids);
      await page.getByRole("button", { name: "另存为", exact: true }).click();
      let dialog = page.getByRole("dialog");
      await expect(dialog.locator("[data-save-as-content]")).toHaveAttribute("aria-busy", "false");
      await dialog.getByLabel("文件名", { exact: true }).fill(prefix + "Existing");
      await dialog.getByRole("button", { name: "保存", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`templates/${first}`));
      await expectDocumentSaved(page);
      const original = await readPersonalDocument(first);
      const second = await openDraft(page, ids);
      await page
        .frameLocator("iframe")
        .locator("#client")
        .fill(prefix + "新内容");
      await expect.poll(async () => JSON.stringify((await draft(second)).state)).toContain(prefix + "新内容");
      await page.getByRole("button", { name: "另存为", exact: true }).click();
      dialog = page.getByRole("dialog");
      await expect(dialog.locator("[data-save-as-content]")).toHaveAttribute("aria-busy", "false");
      await dialog.getByLabel("文件名", { exact: true }).fill(prefix + "existing");
      await dialog.getByRole("button", { name: "保存", exact: true }).click();
      await expect(dialog.getByRole("alert")).toContainText("已有同名文档");
      expect((await readPersonalDocument(first)).state_sha256).toBe(original.state_sha256);
      expect((await db.from("company_template_documents").select("id").eq("id", second)).data).toEqual([]);
      expect(await draft(second)).toBeTruthy();
      fault = createTemplateDraftInsertFault(second, runDocumentFixtureSql);
      fault.install();
      await dialog.getByLabel("文件名", { exact: true }).fill(prefix + "Corrected");
      await dialog.getByRole("button", { name: "保存", exact: true }).click();
      await expect(dialog.getByRole("alert")).toBeVisible();
      expect((await db.from("company_template_documents").select("id").eq("id", second)).data).toEqual([]);
      expect(await draft(second)).toBeTruthy();
      fault.remove();
      await dialog.getByRole("button", { name: "保存", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`templates/${second}`));
      await expectDocumentSaved(page);
      expect((await readPersonalDocument(second)).name).toBe(prefix + "Corrected");
      await page.reload();
      await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(prefix + "新内容");
    } finally {
      await settleDraftPage(page);
      fault?.remove();
      await cleanup(page, ids, prefix);
    }
  });

  test("转正响应丢失或回执影响零行不能显示成功，刷新原草稿地址核对同一正式文档", async ({ page }) => {
    test.setTimeout(150000);
    const ids: string[] = [];
    const prefix = `draft-retry-${randomUUID()}-`;
    try {
      await documentLogin(page, "salesman");
      for (const mode of ["lost", "badReceipt"]) {
        const id = await openDraft(page, ids);
        await page
          .frameLocator("iframe")
          .locator("#client")
          .fill(prefix + mode);
        await expect.poll(async () => JSON.stringify((await draft(id)).state)).toContain(prefix + mode);
        await page.getByRole("button", { name: "另存为", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.locator("[data-save-as-content]")).toHaveAttribute("aria-busy", "false");
        await dialog.getByLabel("文件名", { exact: true }).fill(prefix + mode);
        let operation = "";
        await page.route("**/api/company-template-document-drafts", async (route) => {
          const input = route.request().postDataJSON();
          if (input.action !== "promote") {
            await route.continue();
            return;
          }
          operation = input.operationId;
          const response = await route.fetch();
          if (mode === "lost") await route.abort("connectionreset");
          else {
            const actual = await response.json();
            await route.fulfill({
              response,
              json: { ...actual, receipt: { ...actual.receipt, affected_rows: 0 } },
            });
          }
        });
        await dialog.getByRole("button", { name: "保存", exact: true }).click();
        await expect(dialog.getByRole("alert")).toBeVisible();
        await expect(dialog.getByLabel("文件名", { exact: true })).toBeDisabled();
        await expect(dialog.locator("[data-save-as-tree-folder]").first()).toBeDisabled();
        await expect(page).toHaveURL(new RegExp(`drafts/${id}`));
        const doc = await readPersonalDocument(id);
        expect(JSON.stringify(doc.state)).toContain(prefix + mode);
        expect(
          (await documentAdmin().from("company_template_documents").select("id").eq("id", id)).data,
        ).toHaveLength(1);
        await page.unroute("**/api/company-template-document-drafts");
        if (mode === "lost") {
          let retry = "";
          await page.route("**/api/company-template-document-drafts", async (route) => {
            retry = route.request().postDataJSON().operationId;
            await route.continue();
          });
          await dialog.getByRole("button", { name: "保存", exact: true }).click();
          await expect(page).toHaveURL(new RegExp(`templates/${id}`));
          expect(retry).toBe(operation);
          await page.unroute("**/api/company-template-document-drafts");
        } else {
          await page.reload();
          await expect(page.getByRole("heading", { name: "此草稿已另存为文档。" })).toBeVisible();
          await page.getByRole("link", { name: "继续编辑", exact: true }).click();
        }
        await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(prefix + mode);
        await page.reload();
        await expectDocumentSaved(page);
      }
    } finally {
      await cleanup(page, ids, prefix);
    }
  });
}
