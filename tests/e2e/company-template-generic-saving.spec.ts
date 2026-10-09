import {confirmDocumentFolder} from "./helpers/company-template-documents";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { requireLocalAdminClient, fillPublishDialog, sha256 } from "./helpers/company-template-actions";
import { expectDocumentContains, expectDocumentSaved, readPersonalDocument } from "./helpers/company-template-documents";
import { genericTemplateFixture } from "./helpers/generic-template-fixture";

test("普通模板恢复闭包行、对话框回答、多选、可编辑文字及文件图片，继续计算后再次保存", async ({ page }) => {
  test.setTimeout(120000); const admin = requireLocalAdminClient(), marker = `Generic autosave ${randomUUID()}`;
  let templateId = "", id = ""; const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const dialogs: string[] = [];
  page.on("dialog", async dialog => { dialogs.push(dialog.type()); await dialog.accept(dialog.type() === "prompt" ? "10" : undefined); });
  await loginAs(page, "administrator");
  try {
    await page.goto("/admin/company-templates"); await page.getByRole("button", { name: "新建模板", exact: true }).click();
    const dialog = page.getByRole("dialog"); await fillPublishDialog(dialog, { html: genericTemplateFixture, name: marker, slug: `generic-${randomUUID()}` });
    await dialog.getByRole("button", { name: "上传并启用", exact: true }).click(); await expect(dialog).toBeHidden({ timeout: 30000 });
    const { data: template, error } = await admin.from("company_templates").select("id,current_version_id").eq("name", marker).single(); if (error) throw error; templateId = template.id;
    await page.locator("article").filter({ hasText: marker }).getByRole("button", { name: "新建文档", exact: true }).click();await confirmDocumentFolder(page);
    await expect(page).toHaveURL(/\/documents\/templates\/[a-f0-9-]+$/); id = page.url().split("/").pop()!; await expectDocumentSaved(page);
    const frame = page.frameLocator("iframe");
    await frame.locator("#customer").fill("Generic state acceptance"); await frame.locator("#note").fill("Multiline\nnote");
    await frame.locator("#editable").fill("Editable text"); await frame.locator("#include").check(); await frame.locator("#choices").selectOption(["a", "c"]);
    await frame.locator(".amount").first().fill("20"); await frame.locator("#add").click(); await frame.locator(".amount").nth(1).fill("30");
    await frame.locator("#add").click(); await frame.locator(".remove").nth(2).click();
    await frame.locator("#percent").selectOption("custom"); await expect(frame.locator("#sum")).toHaveText("55.00000000000001");
    await frame.locator("#photo").setInputFiles({ name: "test.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64") });
    // 无须按保存按钮：直接用独立数据库确认自动保存终态和图片真实字节。
    await expectDocumentContains(page, id, "Editable text");
    await expect.poll(async () => (await readPersonalDocument(id)).state.images[0]?.src).toMatch(/^data:image\/png;base64,/);
    const before = await readPersonalDocument(id), dialogCount = dialogs.length;
    expect(before.state.actions.some((action: { files?: unknown[] }) => action.files?.length)).toBe(true);
    await page.reload(); await expectDocumentSaved(page);
    await expect(frame.locator(".amount")).toHaveCount(2); await expect(frame.locator("#sum")).toHaveText("55.00000000000001");
    await expect(frame.locator("#include")).toBeChecked(); await expect(frame.locator("#note")).toHaveValue("Multiline\nnote");
    await expect(frame.locator("#editable")).toHaveText("Editable text"); await expect(frame.locator("#choices")).toHaveValues(["a", "c"]);
    await expect(frame.locator("#picture")).toHaveAttribute("src", /^data:image\/png;base64,/); expect(dialogs).toHaveLength(dialogCount);
    await frame.locator(".amount").nth(1).fill("40"); await expect(frame.locator("#sum")).toHaveText("66");
    await frame.locator("#add").click(); await frame.locator(".amount").nth(2).fill("10"); await expect(frame.locator("#sum")).toHaveText("77");
    await page.getByRole("button", { name: "保存", exact: true }).click();await confirmDocumentFolder(page); await expectDocumentSaved(page);
    const after = await readPersonalDocument(id); expect(after.revision).toBeGreaterThan(before.revision);
    await page.reload(); await expectDocumentSaved(page); await expect(frame.locator("#sum")).toHaveText("77"); await expect(frame.locator(".amount")).toHaveCount(3);
    // 只破坏本地这份夹具的权威记录，证明查库断言能发现错误保存，再从真实页面恢复正确值。
    const correct = await readPersonalDocument(id), broken = structuredClone(correct.state);
    broken.fields[0].value = "Incorrect persisted customer";
    const { error: faultError } = await admin.from("company_template_documents").update({ state: broken }).eq("id", id); if (faultError) throw faultError;
    let detected = false; try { expect((await readPersonalDocument(id)).state).toEqual(correct.state); } catch { detected = true; }
    expect(detected).toBe(true); await page.reload(); await expectDocumentSaved(page); await expect(frame.locator("#customer")).toHaveValue("Incorrect persisted customer");
    await frame.locator("#customer").fill("Generic state acceptance"); await page.getByRole("button", { name: "保存", exact: true }).click();await confirmDocumentFolder(page); await expectDocumentContains(page, id, "Generic state acceptance");
    expect((await readPersonalDocument(id)).state).toEqual(correct.state); await page.reload(); await expectDocumentSaved(page); await expect(frame.locator("#customer")).toHaveValue("Generic state acceptance");
    const { data: original } = await admin.from("company_template_versions").select("html_content,html_sha256").eq("id", template.current_version_id).single();
    expect(original?.html_content).toBe(genericTemplateFixture); expect(original?.html_sha256).toBe(sha256(genericTemplateFixture)); expect(errors).toEqual([]);
    const final = await readPersonalDocument(id);
    writeFileSync("output/generic-template-saving-evidence.json", JSON.stringify({ id, revision: final.revision, templateVersionId: template.current_version_id, hash: final.state_sha256, originalHash: original?.html_sha256, dialogs: dialogCount, redGreenDetected: detected, errors }, null, 2));
  } finally { if (id) await admin.from("company_template_documents").delete().eq("id", id); if (templateId) await admin.from("company_templates").delete().eq("id", templateId); }
});
