import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { loginAs, type RegressionRole } from "./helpers/auth";
import { fillQuotationRow, fillPublishDialog, htmlFile, publishMultipart, requireLocalAdminClient, readTemplateBySlug, readVersion, countTemplates, countVersions, deleteTemplate, sha256, clickStableTemplateButton, expectNoPageOverflow, withDocumentProtocol } from "./helpers/company-template-actions";

const SEEDED_TEMPLATE_ID = "a3200000-0000-4000-8000-000000000001";
const SEEDED_VERSION_ID = "a3200000-0000-4000-8000-000000000003";
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
  withDocumentProtocol(`<!doctype html><html><head><meta charset="utf-8"><title>${heading}</title></head><body><h1>${heading}</h1><button onclick="document.body.dataset.clicked='yes'">Use</button></body></html>`);

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

  test("模板正文等待失败后可从页面重试", async ({ page }) => {
    await loginAs(page, "administrator");
    const contentPath = `**/api/company-templates/${SEEDED_TEMPLATE_ID}/content*`;
    await page.route(contentPath, (route) => route.abort("timedout"));
    await page.goto(`/admin/company-templates/${SEEDED_TEMPLATE_ID}`);
    await expect(page.getByRole("status").getByText("模板暂时没有打开，请重试。")).toBeVisible({ timeout: 20_000 });
    const retry = page.getByRole("button", { name: "重新打开" });
    await expect(retry).toBeVisible({ timeout: 20_000 });
    await page.unroute(contentPath);
    await retry.click();
    await expect(page.frameLocator("iframe").getByText("PT5 Dropshipping", { exact: true })).toBeVisible();
    await expect(page.getByRole("status").getByText("正在打开模板，请稍候…")).toHaveCount(0);
    await page.reload();
    await expect(page.frameLocator("iframe").getByText("PT5 Dropshipping", { exact: true })).toBeVisible();
    // 手机切换回电脑会重新挂载 iframe，仍要等实际正文出现后才结束等待。
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.frameLocator("iframe").getByText("PT5 Dropshipping", { exact: true })).toBeVisible();
  });

  for (const getFails of [true, false]) {
    test(`正文 GET ${getFails ? "失败" : "成功"}时不依赖相反结果的 HEAD`, async ({ page }) => {
      await loginAs(page, "administrator");
      let getCount = 0;
      let headCount = 0;
      const contentPath = `**/api/company-templates/${SEEDED_TEMPLATE_ID}/content*`;
      await page.route(contentPath, async (route) => {
        if (route.request().method() === "HEAD") {
          headCount += 1;
          await route.fulfill({ status: getFails ? 200 : 503 });
        } else {
          getCount += 1;
          if (getFails) await route.fulfill({ status: 503, contentType: "text/html", body: "<p>Unavailable</p>" });
          else await route.continue();
        }
      });
      await page.goto(`/admin/company-templates/${SEEDED_TEMPLATE_ID}`);
      if (getFails) {
        // 来自父窗口的伪造通知不能让错误正文消除遮罩。
        const token = new URL((await page.locator("iframe").getAttribute("src"))!).searchParams.get("loadToken");
        await page.evaluate((token) => window.postMessage({ type: "pt5.company-template.ready", token }, "*"), token);
        await expect(page.getByText("正在打开模板，请稍候…")).toBeVisible();
        await expect(page.getByRole("button", { name: "重新打开" })).toBeVisible({ timeout: 20_000 });
        await page.unroute(contentPath);
        await page.getByRole("button", { name: "重新打开" }).click();
      }
      await expect(page.frameLocator("iframe").getByText("PT5 Dropshipping", { exact: true })).toBeVisible();
      await expect(page.getByRole("status")).toHaveCount(0);
      expect(getCount).toBe(1);
      expect(headCount).toBe(0);
      const head = await page.request.head(`/api/company-templates/${SEEDED_TEMPLATE_ID}/content`);
      expect(head.status()).toBe(405);
      await expectNoPageOverflow(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator("iframe")).toHaveCount(0);
      await expectNoPageOverflow(page);
    });
  }

  test("v33 可增加目的地和产品、上传图片、计算金额并触发打印", async ({ page }) => {
    test.setTimeout(120_000);
    // 使用产品已有的“减少动态效果”偏好，让跨 iframe 滚动即时完成。
    // Chrome 的滚动动画期间命中区域可能滞后于 DOM 坐标；真实按钮与业务断言保持原样。
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      // 浏览器自动化不能打开系统打印窗口，因此用页面内标记核对模板确实调用了 window.print。
      Object.defineProperty(window, "print", {
        configurable: true,
        value: () => document.documentElement.setAttribute("data-print-called", "yes"),
      });
    });
    const account = await loginAs(page, "salesman");
    await page.goto(`${account.workspacePath}/company-templates`);
    await page.getByRole("link", { name: "预览模板" }).click();
    const listResponse = await page.request.get(`${account.workspacePath}/company-templates`);
    expect(listResponse.headers()["x-frame-options"]).toBe("DENY");
    const contentResponse = await page.request.get(`/api/company-templates/${SEEDED_TEMPLATE_ID}/content`);
    expect(contentResponse.headers()["cache-control"]).toContain("no-store");
    expect(contentResponse.headers()["content-security-policy"]).toContain("connect-src 'none'");
    // 正文要能装入本站 iframe；其他页面仍由全站规则拒绝嵌入。
    expect(contentResponse.headers()["x-frame-options"]).toBe("SAMEORIGIN");
    expect(contentResponse.headers()["x-template-sha256"]).toBe((await readVersion(requireLocalAdminClient(), SEEDED_VERSION_ID)).html_sha256);
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
    await clickStableTemplateButton(page, frame, "+ Add product");
    // 等模板同步插入第二行后再新增目的地，避免两个 DOM 操作紧挨时把行数变化合并成不稳定断言。
    await expect(frame.locator("tr.prow")).toHaveCount(2);
    await clickStableTemplateButton(page, frame, "+ Add destination");
    await expect(frame.locator("section.page")).toHaveCount(2);
    await expect(frame.locator("tr.prow")).toHaveCount(3);
    await frame.locator(".f-dest").nth(1).fill("DE");

    for (let index = 0; index < 3; index += 1) {
      await fillQuotationRow(frame, index);
    }

    // 第一行额外走真实文件选择流程，确认 v33 的本地图片读取仍可用。
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

    await clickStableTemplateButton(page, frame, "Print all");
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
    await expect(page.getByRole("link", { name: "预览模板" })).toHaveCount(0);
  });

  test("模板脚本中的 HTML 片段不影响实际正文就绪和交互", async ({ page }) => {
    const admin = requireLocalAdminClient();
    const slug = `template-html-fragment-${Date.now()}`;
    const name = `脚本片段模板 ${Date.now()}`;
    // 报价单的打印脚本可能包含结束标签字符串，不能把它当成文档的真正结束标签。
    const html = withDocumentProtocol('<!doctype html><html><body><script>const printableEnd = "</body>";</script><h1>Fragment quotation</h1><button onclick="document.getElementById(\'result\').textContent=printableEnd">Use</button><p id="result"></p></body></html>');
    let templateId: string | null = null;
    try {
      await loginAs(page, "administrator");
      await page.goto("/admin/company-templates");
      await page.getByRole("button", { name: "新建模板" }).click();
      const dialog = page.getByRole("dialog", { name: "新建公司模板" });
      await fillPublishDialog(dialog, { html, name, slug });
      await dialog.getByRole("button", { name: "上传并启用" }).click();
      await expect(page.getByText("模板已创建并启用。")).toBeVisible();
      const saved = await readTemplateBySlug(admin, slug);
      templateId = saved.id;
      expect(saved).toMatchObject({ revision: 1, status: "active" });
      expect((await readVersion(admin, saved.current_version_id)).html_sha256).toBe(sha256(html));
      await page.locator("article").filter({ hasText: name }).getByRole("link", { name: "预览模板" }).click();
      const frame = page.frameLocator("iframe");
      await expect(frame.getByRole("heading", { name: "Fragment quotation" })).toBeVisible();
      await expect(page.getByRole("status")).toHaveCount(0);
      await frame.getByRole("button", { name: "Use", exact: true }).click();
      await expect(frame.locator("#result")).toHaveText("</body>");
      await page.reload();
      await expect(page.getByRole("status")).toHaveCount(0);
      await frame.getByRole("button", { name: "Use", exact: true }).click();
      await expect(frame.locator("#result")).toHaveText("</body>");
    } finally { if (templateId) await deleteTemplate(admin, templateId); }
  });

  test("管理员从页面完成新建、更新、指南、回退和停用，并核对数据库最终记录", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
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
      await article.getByRole("link", { name: "预览模板" }).click();
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
      const otherArticle = page.locator("article").filter({ hasText: "PT5 DS 报价单（多目的国版）" });
      const otherHeightBefore = (await otherArticle.boundingBox())?.height;
      expect(otherHeightBefore).toBeDefined();
      await updatedArticle.getByText("版本记录").click();
      await expect(updatedArticle.locator("details")).toHaveAttribute("open", "");
      // 双列卡片的高度应彼此独立，避免一侧展开后把另一侧也视觉上拉开。
      expect((await updatedArticle.boundingBox())?.height).toBeGreaterThan(otherHeightBefore!);
      await expect.poll(async () => (await otherArticle.boundingBox())?.height).toBe(otherHeightBefore);
      await page.reload();
      const otherHeightAfterReload = (await otherArticle.boundingBox())?.height;
      await updatedArticle.getByText("版本记录").click();
      await expect(updatedArticle.locator("details")).toHaveAttribute("open", "");
      await expect.poll(async () => (await otherArticle.boundingBox())?.height).toBe(otherHeightAfterReload);
      await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(0);
      expect(browserErrors).toEqual([]);
      await updatedArticle.getByRole("button", { name: "恢复此版本" }).click();
      await expect(page.getByText("已恢复所选版本。")).toBeVisible();
      await expect.poll(async () => (await readTemplateBySlug(admin, slug)).current_version_id).toBe(version1.id);
      expect((await readTemplateBySlug(admin, slug)).revision).toBe(3);

      await page.locator("article").filter({ hasText: name }).getByRole("button", { name: "停用" }).click();
      await expect(page.getByText("模板已停用。")).toBeVisible();
      const disabled = await readTemplateBySlug(admin, slug);
      expect(disabled).toMatchObject({ revision: 4, status: "inactive" });
      await expect(page.locator("article").filter({ hasText: name }).getByRole("link", { name: "预览模板" })).toHaveCount(0);

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
    const originalHash = (await readVersion(admin, SEEDED_VERSION_ID)).html_sha256;
    try {
      const { error } = await admin.from("company_template_versions")
        .update({ html_sha256: "0".repeat(64) }).eq("id", SEEDED_VERSION_ID);
      if (error) throw error;
      const response = await page.request.get(`/api/company-templates/${SEEDED_TEMPLATE_ID}/content`);
      expect(response.status()).toBe(409);
      expect(await response.text()).toBe("Template verification failed");
    } finally {
      const { error } = await admin.from("company_template_versions")
        .update({ html_sha256: originalHash }).eq("id", SEEDED_VERSION_ID);
      if (error) throw error;
    }
  });
});

async function dismissAnnouncement(page: Page) {
  const button = page.getByRole("button", { name: "我知道了" });
  if (await button.isVisible().catch(() => false)) await button.click();
}
