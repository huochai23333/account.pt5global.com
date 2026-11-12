import { test, expect } from "@playwright/test";
import { cleanupTemplateDocumentFixtures } from "../test-support/template-document-fixture-cleanup";
import { writeFileSync } from "node:fs";
import { documentAdmin, documentLogin } from "./helpers/document-library";
import {
  openNewDocument,
  readPersonalDocument,
  expectDocumentContains,
} from "./helpers/company-template-documents";

test.use({ video: "off" });

test("另存为响应丢失沿用原编号，独立位置断言识别错误归档后恢复", async ({
  page,
}) => {
  test.setTimeout(150000);
  const admin = documentAdmin();
  const ids: string[] = [];
  const prefix = `folder-retry-${Date.now()}-`;
  try {
    await documentLogin(page, "salesman");
    const id = await openNewDocument(page, ids);
    await page.frameLocator("iframe").locator("#client").fill(prefix);
    await expectDocumentContains(page, id, prefix);
    const original = await readPersonalDocument(id);
    const destinations = await (
      await page.request.get("/api/company-template-documents/destinations", {
        maxRetries: 2,
      })
    ).json();
    const archive = destinations.archives.find(
      (a: { customer_id: string }) =>
        a.customer_id === "c1000000-0000-4000-8000-000000000002",
    );
    const target = destinations.folders.find(
      (f: { archive_id: string; system_key: string }) =>
        f.archive_id === archive.id && f.system_key === "personal",
    );
    await page.getByRole("button", { name: "另存为", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("文件名", { exact: true }).fill(prefix + "副本");
    await dialog.locator(`[data-save-as-tree-folder="${target.id}"]`).click();
    await expect(dialog.locator("[data-save-as-content]")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    let operation = "";
    let copyId = "";
    await page.route("**/api/company-template-documents", async (route) => {
      const body = route.request().postDataJSON();
      operation = body.operationId;
      copyId = body.documentId;
      ids.push(copyId);
      await route.fetch();
      await route.abort("connectionreset");
    });
    await dialog.getByRole("button", { name: "保存", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByLabel("文件名", { exact: true })).toBeDisabled();
    await expect(
      dialog.locator(`[data-save-as-tree-folder="${target.id}"]`),
    ).toBeDisabled();
    await page.unroute("**/api/company-template-documents");
    const committed = await readPersonalDocument(copyId);
    expect(committed.folder_id).toBe(target.id);
    let retried = "";
    await page.route("**/api/company-template-documents", async (route) => {
      retried = route.request().postDataJSON().operationId;
      await route.continue();
    });
    await dialog.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(copyId + "$"));
    await page.unroute("**/api/company-template-documents");
    expect(retried).toBe(operation);
    expect(
      (
        await admin
          .from("company_template_documents")
          .select("id")
          .eq("id", copyId)
      ).data,
    ).toHaveLength(1);
    expect((await readPersonalDocument(id)).folder_id).toBe(original.folder_id);
    // 只改变已记录的夹具编号，确认读回断言会拒绝错误位置，再恢复真实位置。
    expect(
      (
        await admin
          .from("company_template_documents")
          .update({ folder_id: original.folder_id })
          .eq("id", copyId)
      ).error,
    ).toBeNull();
    let detected = false;
    try {
      expect((await readPersonalDocument(copyId)).folder_id).toBe(target.id);
    } catch {
      detected = true;
    }
    expect(detected).toBe(true);
    expect(
      (
        await admin
          .from("company_template_documents")
          .update({ folder_id: target.id })
          .eq("id", copyId)
      ).error,
    ).toBeNull();
    await page.reload();
    await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(
      prefix,
    );
    await page
      .getByRole("button", { name: "返回所在文件夹", exact: true })
      .click();
    await expect(
      page.locator(`[data-template-document="${copyId}"]`),
    ).toBeVisible();
    writeFileSync(
      "output/template-folder-retry-evidence.json",
      JSON.stringify(
        {
          sourceId: id,
          copyId,
          folderId: target.id,
          retriedOriginalOperation: true,
          redGreenDetected: detected,
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanupTemplateDocumentFixtures(admin, ids);
  }
});
