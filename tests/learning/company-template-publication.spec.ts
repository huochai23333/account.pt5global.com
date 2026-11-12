import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const copy = zh.CompanyTemplates;
const origin = "http://localhost:3000";
const publishEndpoint = "**/api/company-templates/publish";
const manageEndpoint = "**/api/company-templates/manage";
const html = (heading: string) => `<!doctype html><html><head><meta charset="utf-8"></head><body><h1>${heading}</h1>
<input id="client"><script>
const field = document.getElementById("client");
window.PT5Template = {
  version: 1,
  exportState: () => ({ client: field.value }),
  importState: (state) => { field.value = state.client ?? ""; },
  subscribe: (notify) => field.addEventListener("input", notify)
};
</script></body></html>`;
const guide = '<!doctype html><html><body><h1>Learning guide</h1></body></html>';
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

test("模板发布丢回执后保留编号并验证启停与历史版本", async ({ page, browser, learningUser, learningStaff }, testInfo) => {
  test.setTimeout(110_000);
  const slug = `learning-publish-${randomUUID()}`;
  const title = `Learning template ${slug.slice(-8)}`;
  const bodies = [html("Original publication"), html("Revised publication")];
  const errors: string[] = [];
  const read = () => JSON.parse(executeLearningSql(`select json_build_object(
    'template',(select row_to_json(t) from (select id,slug,status,revision,current_version_id from public.company_templates
      where slug='${slug}' and created_by='${learningUser.id}') t),
    'versions',(select coalesce(json_agg(v order by version_number),'[]') from (
      select v.id,v.version_number,v.html_sha256,v.guide_sha256,v.source_filename,v.guide_source_filename
      from public.company_template_versions v join public.company_templates t on t.id=v.template_id
      where t.slug='${slug}' and t.created_by='${learningUser.id}'
    ) v)
  );`));
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    page.setDefaultTimeout(12_000);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.context().addCookies([{ name: "bs-locale", value: "zh", url: origin }]);
    await loginLearningUser(page, learningUser);
    const notice = zh.DashboardShell.announcements;
    const announcement = page.getByRole("dialog", { name: notice.newTitle, exact: true });
    await page.addLocatorHandler(announcement, () => announcement.getByRole("button", { name: notice.acknowledge }).click());
    await page.goto("/admin/company-templates");
    await page.getByRole("button", { name: copy.actions.create, exact: true }).click();
    const create = page.getByRole("dialog", { name: copy.publish.createTitle, exact: true });
    const name = create.getByRole("textbox", { name: copy.fields.name, exact: true });
    const publish = create.getByRole("button", { name: copy.actions.publish, exact: true });
    await name.fill(title);
    await create.getByRole("textbox", { name: copy.fields.slug, exact: true }).fill(slug);
    await expect(publish).toBeDisabled();
    await create.locator('input[type="file"]').nth(0).setInputFiles({
      name: "learning-invalid.html", mimeType: "text/html", buffer: Buffer.from("<h1>Missing document</h1>"),
    });
    await publish.click();
    await expect(create.getByRole("alert")).toHaveText(copy.errors.company_template_file_document);
    await expect(name).toBeEditable();
    await expect(name).toHaveValue(title);
    expect(read()).toEqual({ template: null, versions: [] });
    await create.locator('input[type="file"]').nth(0).setInputFiles({ name: "learning-v1.html", mimeType: "text/html", buffer: Buffer.from(bodies[0]) });
    await create.locator('input[type="file"]').nth(1).setInputFiles({ name: "learning-guide.html", mimeType: "text/html", buffer: Buffer.from(guide) });

    // 数据库完成新建后只切断页面回执，随后仍由原弹窗重试。
    await page.route(publishEndpoint, async (route) => {
      const response = await route.fetch({ maxRetries: 0 });
      expect(response.ok()).toBe(true);
      await route.abort("connectionreset");
    }, { times: 1 });
    await publish.click();
    await expect(create.getByRole("alert")).toHaveText(copy.publish.recoveryNotice);
    const original = read();
    expect(original.template).toMatchObject({ revision: 1, status: "active" });
    expect(original.versions).toHaveLength(1);
    const [v1] = original.versions;
    expect(v1).toMatchObject({ version_number: 1, html_sha256: hash(bodies[0]), guide_sha256: hash(guide) });
    await expect(name).toHaveValue(title);
    await expect(name).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath("template-recovery.png"), animations: "disabled" });
    await publish.click();
    await expect(create).toHaveCount(0);
    expect(read()).toEqual(original);

    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await card.getByRole("button", { name: copy.actions.newVersion, exact: true }).click();
    const update = page.getByRole("dialog", { name: copy.publish.updateTitle, exact: true });
    await update.locator('input[type="file"]').nth(0).setInputFiles({ name: "learning-v2.html", mimeType: "text/html", buffer: Buffer.from(bodies[1]) });
    await update.getByRole("button", { name: copy.actions.publish, exact: true }).click();
    await expect(update).toHaveCount(0);
    const revised = read();
    expect(revised.versions).toHaveLength(2);
    const v2 = revised.versions[1];
    expect(v2).toMatchObject({ version_number: 2, html_sha256: hash(bodies[1]), guide_sha256: hash(guide) });
    expect(revised.template).toMatchObject({ current_version_id: v2.id, revision: 2 });

    // 不匹配的状态回执不能让页面报告成功。
    await page.route(manageEndpoint, (route) => route.fulfill({
      status: 200, json: { ok: true, receipt: { template_id: randomUUID(), version_id: v2.id, revision: 3, status: "inactive" } },
    }), { times: 1 });
    const disable = card.getByRole("button", { name: copy.actions.disable, exact: true });
    await disable.click();
    await expect(page.getByText(copy.errors.company_template_manage_failed, { exact: true })).toBeVisible();
    expect(read()).toEqual(revised);

    await page.route(manageEndpoint, async (route) => {
      expect((await route.fetch({ maxRetries: 0 })).ok()).toBe(true);
      await route.abort("connectionreset");
    }, { times: 1 });
    await disable.click();
    await expect(page.getByText(copy.errors.company_template_manage_failed, { exact: true })).toBeVisible();
    await expect(disable).toBeEnabled();
    const inactive = read();
    expect(inactive.template).toMatchObject({ status: "inactive", revision: 3, current_version_id: v2.id });
    await disable.click();
    const enable = card.getByRole("button", { name: copy.actions.enable, exact: true });
    await expect(enable).toBeVisible();
    expect(read()).toEqual(inactive);
    await enable.click();
    await expect(disable).toBeVisible();
    expect(read().template).toMatchObject({ status: "active", revision: 4, current_version_id: v2.id });

    await card.locator("summary").click();
    await card.getByRole("button", { name: copy.actions.restore, exact: true }).click();
    await expect.poll(() => read().template.current_version_id).toBe(v1.id);
    const restored = read();
    expect(restored.template).toMatchObject({ revision: 5, status: "active" });
    expect(restored.versions).toEqual(revised.versions);
    await page.reload();
    await expect(card.getByText("learning-v1.html", { exact: true }).first()).toBeVisible();
    await card.getByRole("link", { name: copy.actions.preview, exact: true }).click();
    await expect(page.frameLocator("iframe").getByRole("heading", { name: "Original publication" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("template-restored.png"), animations: "disabled" });
    // 指南第一次由本地测试挡住正文。缺少真实就绪通知时仍显示失败，重试再读取原指南。
    await page.route(/\/api\/company-templates\/[^/]+\/content\?kind=guide&/, (route) => route.fulfill({
      status: 503, contentType: "text/plain", body: "Unavailable",
    }), { times: 1 });
    await page.getByRole("link", { name: copy.actions.guide, exact: true }).click();
    await expect(page.getByText(copy.viewer.loading, { exact: true })).toBeVisible();
    const retry = page.getByRole("button", { name: copy.viewer.retry, exact: true });
    await expect(retry).toBeVisible({ timeout: 20_000 });
    await retry.click();
    await expect(page.frameLocator("iframe").getByRole("heading", { name: "Learning guide" })).toBeVisible();
    const staff = await browser.newPage({ viewport: { width: 390, height: 900 } });
    try {
      await loginLearningUser(staff, learningStaff);
      await staff.context().addCookies([{ name: "bs-locale", value: "en", url: origin }]);
      staff.on("pageerror", (error) => errors.push(error.message));
      const staffNotice = en.DashboardShell.announcements;
      const staffAnnouncement = staff.getByRole("dialog", { name: staffNotice.newTitle, exact: true });
      await staff.addLocatorHandler(staffAnnouncement, () =>
        staffAnnouncement.getByRole("button", { name: staffNotice.acknowledge }).click(),
      );
      await staff.goto(`${origin}/salesman/company-templates/${restored.template.id}`);
      const mobileNotice = staff.getByText(en.CompanyTemplates.viewer.desktopOnly, { exact: true });
      await mobileNotice.hover();
      await expect(staffAnnouncement).toBeHidden();
      await expect(mobileNotice).toBeInViewport();
      await expect(staff.locator("iframe")).toHaveCount(0);
      expect((await staff.request.post(`${origin}/api/company-templates/manage`, {
        data: { action: "status", templateId: restored.template.id, expectedRevision: 5, active: false },
      })).status()).toBe(403);
      expect(await staff.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await staff.screenshot({ path: testInfo.outputPath("template-mobile.png"), animations: "disabled" });
    } finally {
      await staff.close();
    }
    expect(read()).toEqual(restored);
    expect(errors).toEqual([]);
    await writeFile(testInfo.outputPath("publication-receipts.json"), JSON.stringify({ original, revised, inactive, restored }, null, 2));
  } finally {
    executeLearningSql(`delete from public.company_templates where slug='${slug}' and created_by='${learningUser.id}';`);
    expect(read()).toEqual({ template: null, versions: [] });
  }
});
