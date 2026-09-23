import { createHash, randomUUID } from "node:crypto";

import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { loginAs, type RegressionRole } from "./helpers/auth";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";

const SEEDED_TEMPLATE_ID = "a3200000-0000-4000-8000-000000000001";
const SEEDED_VERSION_ID = "a3200000-0000-4000-8000-000000000002";
const SEEDED_HTML_HASH = "483d7f0a338fde91d5fa77bf4ec6325df044bd40cbeff91e07f13b98fab1062c";
const INTERNAL_ROLES: RegressionRole[] = [
  "administrator",
  "manager",
  "operator",
  "recruiter",
  "salesman",
  "promoter",
  "finance",
];

const SIMPLE_HTML = (heading: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${heading}</title></head><body><h1>${heading}</h1><button onclick="document.body.dataset.clicked='yes'">Use</button></body></html>`;

test.describe("公司模板", () => {
  test("没有业务工作区的岗位在手机服务说明页不显示模板入口", async ({ page }) => {
    await loginAs(page, "manager");
    await page.goto("/business-unavailable");
    const templateLink = page.locator('a[href="/manager/company-templates"]');
    await expect(templateLink).toHaveCount(1);
    await expect(templateLink).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("link", { name: "公司模板" })).toHaveCount(0);
  });

  for (const role of INTERNAL_ROLES) {
    test(`${role} 可以从工作栏进入当前模板`, async ({ page }) => {
      const account = await loginAs(page, role);
      await page.goto(`${account.workspacePath}/company-templates`);
      await dismissAnnouncement(page);

      await expect(page.getByRole("heading", { name: "公司模板" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "PT5 DS 报价单（多目的国版）" })).toBeVisible();
      await expect(page.getByRole("link", { name: "公司模板" }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "新建模板" })).toHaveCount(
        role === "administrator" ? 1 : 0,
      );
    });
  }

  test("客户不能访问公司模板或发布接口", async ({ page }) => {
    await loginAs(page, "client");
    const pageResponse = await page.goto("/client/company-templates");
    expect(pageResponse?.status()).toBe(404);
    await expect(page.getByText("PT5 DS 报价单（多目的国版）")).toHaveCount(0);

    const templateId = randomUUID();
    const response = await page.request.post("/api/company-templates/publish", {
      multipart: publishMultipart({
        html: SIMPLE_HTML("client denied"),
        slug: `client-denied-${Date.now()}`,
        templateId,
        versionId: randomUUID(),
      }),
    });
    expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "company_template_forbidden",
      ok: false,
    });
    const admin = requireLocalAdminClient();
    expect(await countTemplates(admin, templateId)).toBe(0);
  });

  test("v32 可增加目的地和产品、上传图片、计算金额并触发打印", async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      // 浏览器自动化不能打开系统打印窗口，因此用页面内标记核对模板确实调用了 window.print。
      Object.defineProperty(window, "print", {
        configurable: true,
        value: () => document.documentElement.setAttribute("data-print-called", "yes"),
      });
    });
    const account = await loginAs(page, "salesman");
    await page.goto(`${account.workspacePath}/company-templates`);
    await page.getByRole("link", { name: "开始使用" }).click();
    const listResponse = await page.request.get(`${account.workspacePath}/company-templates`);
    expect(listResponse.headers()["x-frame-options"]).toBe("DENY");
    const contentResponse = await page.request.get(`/api/company-templates/${SEEDED_TEMPLATE_ID}/content`);
    expect(contentResponse.headers()["cache-control"]).toContain("no-store");
    expect(contentResponse.headers()["content-security-policy"]).toContain("connect-src 'none'");
    // 正文要能装入本站 iframe；其他页面仍由全站规则拒绝嵌入。
    expect(contentResponse.headers()["x-frame-options"]).toBe("SAMEORIGIN");
    expect(contentResponse.headers()["x-template-sha256"]).toBe(SEEDED_HTML_HASH);
    const sandbox = await page.locator("iframe").getAttribute("sandbox");
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).toContain("allow-downloads");
    expect(sandbox).not.toContain("allow-same-origin");
    const frame = page.frameLocator("iframe");
    await expect(frame.getByText("PT5 Dropshipping", { exact: true })).toBeVisible();

    await frame.locator("#client").fill("Playwright Store");
    await frame.locator("#quoter").fill("Local Sales");
    await frame.locator("#lhMail").fill("sales@example.test");
    await expect(frame.locator("tr.prow")).toHaveCount(1);
    await frame.getByRole("button", { name: "+ Add product" }).first().click();
    // 等模板同步插入第二行后再新增目的地，避免两个 DOM 操作紧挨时把行数变化合并成不稳定断言。
    await expect(frame.locator("tr.prow")).toHaveCount(2);
    await frame.getByRole("button", { name: "+ Add destination" }).click();
    await expect(frame.locator("section.page")).toHaveCount(2);
    await expect(frame.locator("tr.prow")).toHaveCount(3);
    await frame.locator(".f-dest").nth(1).fill("DE");

    for (let index = 0; index < 3; index += 1) {
      await fillQuotationRow(frame, index);
    }

    // 第一行额外走真实文件选择流程，确认 v32 的本地图片读取仍可用。
    await frame.locator(".photo").first().click();
    await frame.locator("body").evaluate(() => {
      (window as unknown as { ensurePhotoFile: () => void }).ensurePhotoFile();
    });
    await frame.locator("#photoFileInput").setInputFiles({
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4l8AAAAASUVORK5CYII=",
        "base64",
      ),
      mimeType: "image/png",
      name: "product.png",
    });
    await expect(frame.locator(".photo img").first()).toBeVisible();
    await expect(frame.locator("#needBadge")).toContainText("all required fields filled");
    for (const total of await frame.locator(".o-tot").all()) {
      await expect(total).not.toHaveText("—");
    }

    await frame.getByRole("button", { name: "Print all" }).click();
    await expect(frame.locator("html")).toHaveAttribute("data-print-called", "yes");

    // 整页刷新会重新载入模板，防止仅首次客户端跳转正常而直接进入时再次被浏览器拦截。
    await page.reload();
    await expect(page.frameLocator("iframe").getByText("PT5 Dropshipping", { exact: true })).toBeVisible();

    await page.setViewportSize({ height: 844, width: 390 });
    await expectNoPageOverflow(page);
    await expect(page.getByText("公司模板请在电脑上填写和打印。")).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
    const mobileHeader = page.locator("header").first();
    await mobileHeader.getByRole("button", { exact: true, name: "公司模板" }).click();
    await expect(mobileHeader.locator('nav[aria-hidden="false"]').getByRole("link", { name: "公司模板" })).toHaveCount(0);
    await mobileHeader.getByRole("button", { exact: true, name: "公司模板" }).click();
    await page.getByRole("link", { name: "使用指南" }).click();
    await expect(page.getByText("公司模板请在电脑上填写和打印。")).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
    await expectNoPageOverflow(page);

    await page.goto(`${account.workspacePath}/company-templates`);
    await expect(page.getByText("公司模板请在电脑上填写和打印。")).toBeVisible();
    await expect(page.getByRole("link", { name: "开始使用" })).toHaveCount(0);
  });

  test("管理员从页面完成新建、更新、指南、回退和停用，并核对数据库最终记录", async ({ page }) => {
    test.setTimeout(120_000);
    const admin = requireLocalAdminClient();
    const account = await loginAs(page, "administrator");
    const marker = Date.now();
    const name = `回归模板 ${marker}`;
    const slug = `company-template-${marker}`;
    const htmlV1 = SIMPLE_HTML(`Template v1 ${marker}`);
    const htmlV2 = SIMPLE_HTML(`Template v2 ${marker}`);
    const guide = SIMPLE_HTML(`Guide ${marker}`);
    let templateId: string | null = null;

    try {
      await page.goto(`${account.workspacePath}/company-templates`);
      await page.getByRole("button", { name: "新建模板" }).click();
      const createDialog = page.getByRole("dialog", { name: "新建公司模板" });
      await fillPublishDialog(createDialog, { guide, html: htmlV1, name, slug });
      await createDialog.getByRole("button", { name: "上传并启用" }).click();
      await expect(page.getByText("模板已创建并启用。")).toBeVisible();

      const created = await readTemplateBySlug(admin, slug);
      templateId = created.id;
      expect(created).toMatchObject({ revision: 1, status: "active" });
      expect(created.current_version_id).toBeTruthy();
      const version1 = await readVersion(admin, created.current_version_id);
      expect(version1).toMatchObject({
        guide_sha256: sha256(guide),
        html_sha256: sha256(htmlV1),
        version_number: 1,
      });

      const article = page.locator("article").filter({ hasText: name });
      await article.getByRole("link", { name: "开始使用" }).click();
      await expect(page.frameLocator("iframe").getByRole("heading", { name: `Template v1 ${marker}` })).toBeVisible();
      await page.getByRole("link", { name: "使用指南" }).click();
      await expect(page.frameLocator("iframe").getByRole("heading", { name: `Guide ${marker}` })).toBeVisible();

      await page.goto(`${account.workspacePath}/company-templates`);
      const refreshedArticle = page.locator("article").filter({ hasText: name });
      await refreshedArticle.getByRole("button", { name: "上传新版本" }).click();
      const updateDialog = page.getByRole("dialog", { name: "上传模板新版本" });
      await updateDialog.getByLabel("互动 HTML").setInputFiles(htmlFile("v2.html", htmlV2));
      await updateDialog.getByRole("button", { name: "上传并启用" }).click();
      await expect(page.getByText("新版本已上传并启用。")).toBeVisible();

      const updated = await readTemplateBySlug(admin, slug);
      expect(updated.revision).toBe(2);
      const version2 = await readVersion(admin, updated.current_version_id);
      expect(version2).toMatchObject({
        guide_sha256: version1.guide_sha256,
        html_sha256: sha256(htmlV2),
        version_number: 2,
      });

      const updatedArticle = page.locator("article").filter({ hasText: name });
      await updatedArticle.getByText("版本记录").click();
      await updatedArticle.getByRole("button", { name: "恢复此版本" }).click();
      await expect(page.getByText("已恢复所选版本。")).toBeVisible();
      await expect.poll(async () => (await readTemplateBySlug(admin, slug)).current_version_id).toBe(version1.id);
      expect((await readTemplateBySlug(admin, slug)).revision).toBe(3);

      await page.locator("article").filter({ hasText: name }).getByRole("button", { name: "停用" }).click();
      await expect(page.getByText("模板已停用。")).toBeVisible();
      const disabled = await readTemplateBySlug(admin, slug);
      expect(disabled).toMatchObject({ revision: 4, status: "inactive" });
      await expect(page.locator("article").filter({ hasText: name }).getByRole("link", { name: "开始使用" })).toHaveCount(0);

    await page.setViewportSize({ height: 844, width: 390 });
    await expectNoPageOverflow(page);
    await expect(page.getByText("公司模板请在电脑上填写和打印。")).toBeVisible();
    await expect(page.getByRole("button", { name: "上传新版本" })).toHaveCount(0);
      await expectNoPageOverflow(page);
    } finally {
      if (templateId) await deleteTemplate(admin, templateId);
    }
  });

  test("上传拒绝缺失、错误类型、超限和不安全 HTML，并保证指南失败时整笔回滚", async ({ page }) => {
    test.setTimeout(120_000);
    const admin = requireLocalAdminClient();
    await loginAs(page, "administrator");

    const cases: Array<{ expected: string; file?: { buffer: Buffer; mimeType: string; name: string } }> = [
      { expected: "company_template_file_required" },
      { expected: "company_template_file_type", file: htmlFile("template.txt", SIMPLE_HTML("wrong extension")) },
      { expected: "company_template_file_too_large", file: htmlFile("large.html", Buffer.alloc(5 * 1024 * 1024 + 1, 97)) },
      { expected: "company_template_file_document", file: htmlFile("fragment.html", "<div>fragment</div>") },
      { expected: "company_template_file_unsafe", file: htmlFile("script.html", "<!doctype html><html><body><script src='https://example.com/app.js'></script></body></html>") },
      { expected: "company_template_file_unsafe", file: htmlFile("frame.html", "<!doctype html><html><body><iframe src='https://example.com'></iframe></body></html>") },
      { expected: "company_template_file_unsafe", file: htmlFile("form.html", "<!doctype html><html><body><form action=https://example.com></form></body></html>") },
    ];

    for (const item of cases) {
      const response = await page.request.post("/api/company-templates/publish", {
        multipart: publishMultipart({ htmlFileValue: item.file, slug: `invalid-${randomUUID()}`, templateId: randomUUID(), versionId: randomUUID() }),
      });
      expect(response.status()).toBe(400);
      expect(await response.json()).toMatchObject({ error: item.expected, ok: false });
    }

    const rollbackId = randomUUID();
    const rollbackResponse = await page.request.post("/api/company-templates/publish", {
      multipart: publishMultipart({
        guideFileValue: htmlFile("bad-guide.html", "<!doctype html><html><body><object data='bad'></object></body></html>"),
        html: SIMPLE_HTML("valid template"),
        slug: `rollback-${Date.now()}`,
        templateId: rollbackId,
        versionId: randomUUID(),
      }),
    });
    expect(rollbackResponse.status()).toBe(400);
    expect(await countTemplates(admin, rollbackId)).toBe(0);

    const staleResponse = await page.request.post("/api/company-templates/publish", {
      multipart: publishMultipart({
        expectedRevision: "999",
        html: SIMPLE_HTML("stale"),
        slug: "pt5-ds-cost-list",
        templateId: SEEDED_TEMPLATE_ID,
        versionId: randomUUID(),
      }),
    });
    expect(staleResponse.status()).toBe(409);
    expect(await staleResponse.json()).toMatchObject({ error: "company_template_revision_conflict", ok: false });
  });

  test("重复发布只生成一个版本，业务失败和响应中断不会显示成功", async ({ page }) => {
    test.setTimeout(120_000);
    const admin = requireLocalAdminClient();
    const account = await loginAs(page, "administrator");
    const templateId = randomUUID();
    const versionId = randomUUID();
    const marker = Date.now();
    const multipart = publishMultipart({
      html: SIMPLE_HTML(`retry ${marker}`),
      slug: `retry-${marker}`,
      templateId,
      versionId,
    });

    try {
      // 第一份成功响应视为客户端断线丢失，随后使用同一组权威 ID 重试。
      await page.request.post("/api/company-templates/publish", { multipart });
      const retry = await page.request.post("/api/company-templates/publish", { multipart });
      expect(retry.ok()).toBeTruthy();
      const retryBody = await retry.json();
      expect(retryBody).toMatchObject({ ok: true, receipt: { revision: 1, template_id: templateId, version_id: versionId, version_number: 1 } });
      expect(await countVersions(admin, templateId)).toBe(1);

      await page.goto(`${account.workspacePath}/company-templates`);
      await page.getByRole("button", { name: "新建模板" }).click();
      let dialog = page.getByRole("dialog", { name: "新建公司模板" });
      await fillPublishDialog(dialog, { html: SIMPLE_HTML("200 business failure"), name: `失败模板 ${marker}`, slug: `business-failure-${marker}` });
      await page.route("**/api/company-templates/publish", (route) => route.fulfill({
        body: JSON.stringify({ error: "company_template_publish_failed", ok: false }),
        contentType: "application/json",
        status: 200,
      }));
      await dialog.getByRole("button", { name: "上传并启用" }).click();
      await expect(dialog.getByRole("alert")).toContainText("模板没有上传成功");
      await expect(page.getByText("模板已创建并启用。")).toHaveCount(0);
      await page.unroute("**/api/company-templates/publish");
      await dialog.getByRole("button", { name: "取消" }).click();

      await page.getByRole("button", { name: "新建模板" }).click();
      dialog = page.getByRole("dialog", { name: "新建公司模板" });
      await fillPublishDialog(dialog, { html: SIMPLE_HTML("connection interrupted"), name: `断线模板 ${marker}`, slug: `interrupted-${marker}` });
      await page.route("**/api/company-templates/publish", (route) => route.abort("timedout"));
      await dialog.getByRole("button", { name: "上传并启用" }).click();
      await expect(dialog.getByRole("alert")).toContainText("模板没有上传成功");
      await expect(page.getByText("模板已创建并启用。")).toHaveCount(0);
      await page.unroute("**/api/company-templates/publish");
    } finally {
      await deleteTemplate(admin, templateId);
    }
  });

  test("故意篡改当前版本哈希后内容接口拒绝返回 HTML", async ({ page }) => {
    const admin = requireLocalAdminClient();
    await loginAs(page, "salesman");
    try {
      const { error } = await admin.from("company_template_versions")
        .update({ html_sha256: "0".repeat(64) }).eq("id", SEEDED_VERSION_ID);
      if (error) throw error;
      const response = await page.request.get(`/api/company-templates/${SEEDED_TEMPLATE_ID}/content`);
      expect(response.status()).toBe(409);
      expect(await response.text()).toBe("Template verification failed");
    } finally {
      const { error } = await admin.from("company_template_versions")
        .update({ html_sha256: SEEDED_HTML_HASH }).eq("id", SEEDED_VERSION_ID);
      if (error) throw error;
    }
  });
});

async function dismissAnnouncement(page: Page) {
  const button = page.getByRole("button", { name: "我知道了" });
  if (await button.isVisible().catch(() => false)) await button.click();
}

async function fillQuotationRow(frame: FrameLocator, index: number) {
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

async function fillPublishDialog(
  dialog: ReturnType<Page["getByRole"]>,
  input: { guide?: string; html: string; name: string; slug: string },
) {
  await dialog.getByLabel("模板名称").fill(input.name);
  await dialog.getByLabel("模板标识").fill(input.slug);
  await dialog.getByLabel("模板说明").fill("Playwright 公司模板回归");
  await dialog.getByLabel("互动 HTML").setInputFiles(htmlFile("template.html", input.html));
  if (input.guide) await dialog.getByLabel("使用指南 HTML（可选）").setInputFiles(htmlFile("guide.html", input.guide));
}

function htmlFile(name: string, content: string | Buffer) {
  return {
    buffer: Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8"),
    mimeType: "text/html",
    name,
  };
}

function publishMultipart(input: {
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

function requireLocalAdminClient() {
  const admin = getLocalSupabaseAdminClient();
  test.skip(!admin, "必须连接本地 Docker Supabase 才能核对最终业务凭证。");
  if (!admin) throw new Error("local_supabase_admin_required");
  return admin;
}

async function readTemplateBySlug(admin: SupabaseClient, slug: string) {
  const { data, error } = await admin.from("company_templates")
    .select("id,current_version_id,revision,status").eq("slug", slug).single();
  if (error) throw error;
  return data as { current_version_id: string; id: string; revision: number; status: string };
}

async function readVersion(admin: SupabaseClient, id: string) {
  const { data, error } = await admin.from("company_template_versions")
    .select("id,version_number,html_sha256,guide_sha256").eq("id", id).single();
  if (error) throw error;
  return data as { guide_sha256: string | null; html_sha256: string; id: string; version_number: number };
}

async function countTemplates(admin: SupabaseClient, templateId: string) {
  const { count, error } = await admin.from("company_templates")
    .select("id", { count: "exact", head: true }).eq("id", templateId);
  if (error) throw error;
  return count ?? 0;
}

async function countVersions(admin: SupabaseClient, templateId: string) {
  const { count, error } = await admin.from("company_template_versions")
    .select("id", { count: "exact", head: true }).eq("template_id", templateId);
  if (error) throw error;
  return count ?? 0;
}

async function deleteTemplate(admin: SupabaseClient, templateId: string) {
  const { error: clearError } = await admin.from("company_templates")
    .update({ current_version_id: null }).eq("id", templateId);
  if (clearError) throw clearError;
  const { error } = await admin.from("company_templates").delete().eq("id", templateId);
  if (error) throw error;
  if (await countTemplates(admin, templateId)) throw new Error("company_template_test_cleanup_failed");
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function expectNoPageOverflow(page: Page) {
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
