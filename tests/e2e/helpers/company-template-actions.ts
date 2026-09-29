import { createHash } from "node:crypto";
import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getLocalSupabaseAdminClient } from "./local-supabase-admin";

// 文件选择、模板填写与独立数据库凭证放在同层工具中，正式用例只描述用户流程。
export async function fillQuotationRow(frame: FrameLocator, index: number) {
  const row = frame.locator("tr.prow").nth(index);
  await row.locator('input[placeholder="Product name / SKU"]').fill(`Product ${index + 1}`);
  await row.locator('input[placeholder^="detail.1688.com"]').fill(`https://example.com/product-${index + 1}`);
  await row.locator(".f-imgurl").fill("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==");
  await row.locator(".f-cny").fill(String(100 + index));
  await row.locator(".f-kg").fill("1.2");
  await row.locator(".f-l").fill("20");
  await row.locator(".f-w").fill("15");
  await row.locator(".f-h").fill("10");
  await row.locator(".f-pack").fill("0.5");
  await row.locator(".f-rkg2").fill("42");
  await row.locator(".f-rpar2").fill("8");
  await row.locator(".f-tax").fill("2");
  await row.locator(".f-pdp").fill("7-10 working days");
}

export async function fillPublishDialog(
  dialog: ReturnType<Page["getByRole"]>,
  input: { guide?: string; html: string; name: string; slug: string },
) {
  await dialog.getByLabel("模板名称").fill(input.name);
  await dialog.getByLabel("模板标识").fill(input.slug);
  await dialog.getByLabel("模板说明").fill("Playwright 公司模板回归");
  await dialog.getByLabel("互动 HTML").setInputFiles(htmlFile("template.html", input.html));
  if (input.guide) await dialog.getByLabel("使用指南 HTML（可选）").setInputFiles(htmlFile("guide.html", input.guide));
}

export function htmlFile(name: string, content: string | Buffer) {
  return {
    buffer: Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8"),
    mimeType: "text/html",
    name,
  };
}

export function publishMultipart(input: {
  expectedRevision?: string;
  guideFileValue?: ReturnType<typeof htmlFile>;
  html?: string;
  htmlFileValue?: ReturnType<typeof htmlFile>;
  slug: string;
  templateId: string;
  versionId: string;
}) {
  const multipart: Record<string, string | ReturnType<typeof htmlFile>> = {
    description: "Playwright API 回归",
    expectedRevision: input.expectedRevision ?? "",
    name: "Playwright API template",
    slug: input.slug,
    templateId: input.templateId,
    versionId: input.versionId,
  };
  const html = input.htmlFileValue ?? (input.html ? htmlFile("template.html", input.html) : undefined);
  if (html) multipart.htmlFile = html;
  if (input.guideFileValue) multipart.guideFile = input.guideFileValue;
  return multipart;
}

export function requireLocalAdminClient() {
  const admin = getLocalSupabaseAdminClient();
  test.skip(!admin, "必须连接本地 Docker Supabase 才能核对最终业务凭证。");
  if (!admin) throw new Error("local_supabase_admin_required");
  return admin;
}

export async function readTemplateBySlug(admin: SupabaseClient, slug: string) {
  const { data, error } = await admin.from("company_templates")
    .select("id,current_version_id,revision,status").eq("slug", slug).single();
  if (error) throw error;
  return data as { current_version_id: string; id: string; revision: number; status: string };
}

export async function readVersion(admin: SupabaseClient, id: string) {
  const { data, error } = await admin.from("company_template_versions")
    .select("id,version_number,html_sha256,guide_sha256").eq("id", id).single();
  if (error) throw error;
  return data as { guide_sha256: string | null; html_sha256: string; id: string; version_number: number };
}

export async function countTemplates(admin: SupabaseClient, templateId: string) {
  const { count, error } = await admin.from("company_templates")
    .select("id", { count: "exact", head: true }).eq("id", templateId);
  if (error) throw error;
  return count ?? 0;
}

export async function countVersions(admin: SupabaseClient, templateId: string) {
  const { count, error } = await admin.from("company_template_versions")
    .select("id", { count: "exact", head: true }).eq("template_id", templateId);
  if (error) throw error;
  return count ?? 0;
}

export async function deleteTemplate(admin: SupabaseClient, templateId: string) {
  const { error: clearError } = await admin.from("company_templates")
    .update({ current_version_id: null }).eq("id", templateId);
  if (clearError) throw clearError;
  const { error } = await admin.from("company_templates").delete().eq("id", templateId);
  if (error) throw error;
  if (await countTemplates(admin, templateId)) throw new Error("company_template_test_cleanup_failed");
}

export function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** 外页平滑滚动会改变 iframe 的点击坐标；等待按钮连续三次稳定后仍执行真实点击。 */
export async function clickStableTemplateButton(page: Page, frame: FrameLocator, name: string) {
  const button = frame.getByRole("button", { name, exact: true }).first();
  await button.scrollIntoViewIfNeeded();
  let previous = "";
  let stable = 0;
  await expect.poll(async () => {
    const box = await button.boundingBox();
    const position = JSON.stringify(box);
    stable = box && position === previous ? stable + 1 : 0;
    previous = position;
    return stable;
  }, { intervals: [100], timeout: 5_000 }).toBeGreaterThanOrEqual(3);
  await expect(button).toBeInViewport();
  await button.click();
  await expect(page.locator("iframe")).toBeVisible();
}

export async function expectNoPageOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    verticalText: Array.from(document.querySelectorAll<HTMLElement>("body *")).some((element) => {
      const style = getComputedStyle(element);
      return style.writingMode !== "horizontal-tb" && element.offsetParent !== null;
    }),
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.verticalText).toBe(false);
}
