import {confirmDocumentFolder} from "./helpers/company-template-documents";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { requireLocalAdminClient, fillPublishDialog, fillQuotationRow, sha256, clickStableTemplateButton } from "./helpers/company-template-actions";
import { expectDocumentContains, expectDocumentSaved, readPersonalDocument } from "./helpers/company-template-documents";

test.use({ trace: "off", video: "off" });
test("老板未加接口的原报价单保存多目的地、动态产品、文件图片与手动字段，恢复后继续使用", async ({ page }) => {
  test.setTimeout(120000); const admin = requireLocalAdminClient(), marker = `Raw quotation ${randomUUID()}`;
  const exported = readFileSync("output/template-repair-quotation.html", "utf8");
  // 前缀与云端不可变 v4 的哈希逐字一致，只取回老板原文件，不改写当前模板或测试原文。
  const html = exported.slice(0, exported.indexOf("</html>") + 7) + "\n";
  expect(sha256(html)).toBe("12e2bafc38af8c59e2d8a1ab8025288abadfe76d4f57fb31b53afc7a988766a2");
  expect(html).not.toContain("PT5Template"); let templateId = "", id = ""; const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message)); await page.emulateMedia({ reducedMotion: "reduce" }); await loginAs(page, "administrator");
  await page.addInitScript(() => window.addEventListener("message", event => { if (event.data?.type === "pt5.document.error") console.info("restore-reason:" + event.data.reason); }));
  page.on("console", message => { if (message.text().startsWith("restore-reason:")) console.log(message.text()); });
  try {
    await page.goto("/admin/company-templates"); await page.getByRole("button", { name: "新建模板", exact: true }).click();
    const dialog = page.getByRole("dialog"); await fillPublishDialog(dialog, { html, name: marker, slug: `raw-quotation-${randomUUID()}` });
    await dialog.getByRole("button", { name: "上传并启用", exact: true }).click(); await expect(dialog).toBeHidden({ timeout: 30000 });
    const { data: template, error } = await admin.from("company_templates").select("id,current_version_id").eq("name", marker).single(); if (error) throw error; templateId = template.id;
    await page.locator("article").filter({ hasText: marker }).getByRole("button", { name: "新建文档", exact: true }).click();await confirmDocumentFolder(page);
    await expect(page).toHaveURL(/\/documents\/templates\/[a-f0-9-]+$/); id = page.url().split("/").pop()!; await expectDocumentSaved(page);
    const frame = page.frameLocator("iframe"); await frame.locator("#client").fill("Raw quotation restored"); await frame.locator("#qDate").fill("2020-01-02");
    await fillQuotationRow(frame, 0); await clickStableTemplateButton(page, frame, "+ Add product"); await fillQuotationRow(frame, 1);
    await clickStableTemplateButton(page, frame, "+ Add destination"); await fillQuotationRow(frame, 2);
    await frame.locator(".photo").first().dblclick(); await frame.locator("#photoFileInput").setInputFiles({ name: "test.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64") });
    await expectDocumentContains(page, id, "Raw quotation restored"); await expect.poll(async () => (await readPersonalDocument(id)).state.actions.some((action: { kind: string }) => action.kind === "dblclick")).toBe(true);
    const total = await frame.locator(".o-tot").first().innerText(); expect(total).not.toBe("—");
    await page.reload(); await expectDocumentSaved(page); await expect(frame.locator("tr.prow")).toHaveCount(3);
    await expect(frame.locator("#client")).toHaveValue("Raw quotation restored"); await expect(frame.locator("#qDate")).toHaveValue("2020-01-02");
    await expect(frame.locator(".o-tot").first()).toHaveText(total); await expect(frame.locator(".f-imgdata").first()).toHaveValue(/^data:image\/png;base64,/);
    await frame.locator(".f-cny").first().fill("200"); await expect(frame.locator(".o-tot").first()).not.toHaveText(total);
    await clickStableTemplateButton(page, frame, "+ Add product"); await expect(frame.locator("tr.prow")).toHaveCount(4);
    await page.getByRole("button", { name: "保存", exact: true }).click();await confirmDocumentFolder(page); await expectDocumentSaved(page); const saved = await readPersonalDocument(id);
    await page.reload(); await expectDocumentSaved(page); await expect(frame.locator(".f-cny").first()).toHaveValue("200"); await expect(frame.locator("tr.prow")).toHaveCount(4);
    const { data: version } = await admin.from("company_template_versions").select("html_content,html_sha256").eq("id", template.current_version_id).single();
    expect(version?.html_content).toBe(html); expect(version?.html_sha256).toBe(sha256(html)); expect(errors).toEqual([]);
    writeFileSync("output/raw-quotation-saving-evidence.json", JSON.stringify({ id, revision: saved.revision, hash: saved.state_sha256, originalHash: version?.html_sha256, errors }, null, 2));
  } catch (cause) {
    if (id) {
      const expected = (await readPersonalDocument(id)).state;
      const iframe = page.frames().find(frame => frame.url().includes(`/api/company-template-documents/${id}/content`));
      const actual = await iframe?.evaluate(async () => (window as typeof window & { PT5Template: { exportState: () => unknown } }).PT5Template.exportState());
      const paths: string[] = [];
      function compare(left: unknown, right: unknown, path: string) {
        if (JSON.stringify(left) === JSON.stringify(right)) return;
        if (left && right && typeof left === "object" && typeof right === "object") { for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) compare((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key], `${path}/${key}`); }
        else paths.push(path);
      }
      compare(expected, actual, "state"); console.log(JSON.stringify({ restoreDifferences: paths.slice(0, 30) }));
    }
    throw cause;
  } finally { if (id) await admin.from("company_template_documents").delete().eq("id", id); if (templateId) await admin.from("company_templates").delete().eq("id", templateId); }
});
