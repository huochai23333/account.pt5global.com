import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { documentAdmin } from "./document-library";
import { documentLogin } from "./document-library";
import { documentReader } from "./document-library";
import { readPersonalDocument } from "./company-template-documents";
import { expectDocumentSaved } from "./company-template-documents";
import { test } from "./template-draft-fixture";
import { openDraft } from "./template-draft-fixture";
import { draft } from "./template-draft-fixture";
import { cleanup } from "./template-draft-fixture";
/** 草稿生命周期与本人可见范围；页面操作后独立读库并刷新。 */
export function registerDraftLifecycleCases() {
  test("直接制作云端草稿，换浏览器恢复，首次另存为保留编号并移除草稿，普通保存不选位置", async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(180000);
    const ids: string[] = [];
    const prefix = `draft-lifecycle-${randomUUID()}-`;
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const other = await browser.newContext();
    let second: Page;
    try {
      second = await other.newPage();
      await documentLogin(page, "salesman");
      const id = await openDraft(page, ids);
      await page
        .frameLocator("iframe")
        .locator("#client")
        .fill(prefix + "内容");
      await expect.poll(async () => JSON.stringify((await draft(id)).state)).toContain(prefix + "内容");
      const before = await draft(id);
      expect(
        (await documentAdmin().from("company_template_documents").select("id").eq("id", id)).data,
      ).toEqual([]);
      await documentLogin(second, "salesman");
      await second.goto("/salesman/company-templates");
      await second
        .locator(`[data-template-draft="${id}"]`)
        .getByRole("link", { name: "继续制作", exact: true })
        .click();
      await expect(second.frameLocator("iframe").locator("#client")).toHaveValue(prefix + "内容");
      await second.reload();
      await expect(second.frameLocator("iframe").locator("#client")).toHaveValue(prefix + "内容");
      await page.getByRole("button", { name: "保存", exact: true }).click();
      let dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("tree", { name: "保存位置目录树" })).toBeVisible();
      await expect(dialog.locator("[data-save-as-content]")).toHaveAttribute("aria-busy", "false");
      await dialog.getByLabel("文件名", { exact: true }).fill(prefix + "正式文档");
      await dialog.getByRole("button", { name: "新建文件夹", exact: true }).click();
      await dialog.getByLabel("文件夹名称", { exact: true }).fill(prefix + "目录");
      await dialog.getByRole("button", { name: "确认", exact: true }).click();
      await expect(dialog.locator("[data-save-as-path]")).toContainText(prefix + "目录");
      await expect(dialog.locator("[data-save-as-content]")).toHaveAttribute("aria-busy", "false");
      await page.screenshot({ path: testInfo.outputPath("draft-save-as-desktop.png") });
      const folder = (
        await documentAdmin()
          .from("document_folders")
          .select("*")
          .eq("name", prefix + "目录")
          .single()
      ).data!;
      await dialog.getByRole("button", { name: "保存", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`templates/${id}$`));
      await expectDocumentSaved(page);
      const saved = await readPersonalDocument(id);
      expect(saved.id).toBe(id);
      expect(saved.folder_id).toBe(folder.id);
      expect(saved.template_version_id).toBe(before.template_version_id);
      expect(saved.state).toEqual(before.state);
      expect(saved.state_sha256).toBe(before.state_sha256);
      expect(
        (await documentAdmin().from("company_template_document_drafts").select("id").eq("id", id)).data,
      ).toEqual([]);
      await page.getByRole("button", { name: "保存", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect
        .poll(async () => (await readPersonalDocument(id)).revision)
        .toBeGreaterThan(saved.revision);
      expect((await readPersonalDocument(id)).folder_id).toBe(folder.id);
      const beforeShortcut = await readPersonalDocument(id);
      await page.frameLocator("iframe").locator("#client").press("Control+s");
      await expect
        .poll(async () => (await readPersonalDocument(id)).revision)
        .toBeGreaterThan(beforeShortcut.revision);
      await expectDocumentSaved(page);
      const sourceBeforeCopy = await readPersonalDocument(id);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page
        .frameLocator("iframe")
        .locator("#client")
        .fill(prefix + "另存编辑");
      await page.frameLocator("iframe").locator("#client").press("Control+Shift+s");
      dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("文件名", { exact: true }).fill(prefix + "副本");
      await dialog.getByRole("button", { name: "保存", exact: true }).click();
      await expect(page).not.toHaveURL(new RegExp(id + "$"));
      const copied = page.url().split("/").pop()!;
      ids.push(copied);
      await expectDocumentSaved(page);
      expect(JSON.stringify((await readPersonalDocument(copied)).state)).toContain(prefix + "另存编辑");
      expect((await readPersonalDocument(id)).state_sha256).toBe(sourceBeforeCopy.state_sha256);
      expect((await readPersonalDocument(id)).name).toBe(prefix + "正式文档");
      await page.reload();
      await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(prefix + "另存编辑");
      await page.getByRole("button", { name: "返回所在文件夹", exact: true }).click();
      await expect(page.getByRole("heading", { name: "我的文档", exact: true })).toBeVisible();
      await expect(page.locator(`[data-template-document="${copied}"]`)).toBeVisible();
      expect(errors).toEqual([]);
      writeFileSync(
        testInfo.outputPath("draft-lifecycle-proof.json"),
        JSON.stringify(
          {
            draftId: id,
            documentId: id,
            folderId: folder.id,
            templateVersionId: saved.template_version_id,
            stateHash: saved.state_sha256,
            revision: saved.revision,
            copyId: copied,
            crossBrowserRecovered: true,
            draftRemoved: true,
            pageErrors: errors,
          },
          null,
          2,
        ),
      );
    } finally {
      await other.close();
      await cleanup(page, ids, prefix);
    }
  });

  test("草稿仅本人读取，客户和其他员工不能读正文及凭证，删除后刷新消失", async ({ page, browser }) => {
    test.setTimeout(120000);
    const ids: string[] = [];
    const prefix = `draft-private-${randomUUID()}-`;
    const other = await browser.newContext();
    let visitor: Page;
    try {
      visitor = await other.newPage();
      await documentLogin(page, "salesman");
      const id = await openDraft(page, ids);
      await page.frameLocator("iframe").locator("#client").fill(prefix);
      await expect.poll(async () => JSON.stringify((await draft(id)).state)).toContain(prefix);
      for (const role of ["administrator", "manager", "client"] as const) {
        await documentLogin(visitor, role);
        const response = await visitor.request.get(
          `/api/company-template-document-drafts/${id}/content?loadToken=${randomUUID()}`,
        );
        expect(response.ok()).toBe(false);
        const reader = await documentReader(role);
        expect(
          (await reader.from("company_template_document_drafts").select("id").eq("id", id)).data,
        ).toEqual([]);
        expect(
          (await reader.from("company_template_draft_operations").select("operation_id").eq("draft_id", id))
            .data,
        ).toEqual([]);
        await visitor.goto(`/${role === "administrator" ? "admin" : role}/documents/drafts/${id}`);
        await expect(visitor.locator("iframe")).toHaveCount(0);
      }
      await page.goto("/salesman/company-templates");
      const row = page.locator(`[data-template-draft="${id}"]`);
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "删除", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "确认操作", exact: true }).click();
      await expect(row).toHaveCount(0);
      expect(
        (await documentAdmin().from("company_template_document_drafts").select("id").eq("id", id)).data,
      ).toEqual([]);
      await page.reload();
      await expect(row).toHaveCount(0);
    } finally {
      await other.close();
      await cleanup(page, ids, prefix);
    }
  });
}
