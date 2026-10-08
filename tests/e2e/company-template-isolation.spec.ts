import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { countVersions, deleteTemplate, withDocumentProtocol, publishMultipart, requireLocalAdminClient } from "./helpers/company-template-actions";

// 此用例验证卡片独立展开，不要求两个版本记录互斥。预期来自原生 details 的独立操作语义。
test("two template histories keep their own open state and height after clicks and reload", async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  if (!baseURL || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)) {
    throw new Error("template isolation regression requires a local application endpoint");
  }
  const admin = requireLocalAdminClient();
  const fixtures = ["A", "B"].map((label) => ({ id: randomUUID(), slug: `isolation-${label.toLowerCase()}-${randomUUID()}` }));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, "administrator");
  try {
    // 两卡固定为两版本、相同文案；不依赖当前种子模板或通过重复名称误定位。
    // API 只准备夹具；被验证的开关操作全部从真实页面触发。
    for (const fixture of fixtures) {
      for (const version of [1, 2]) {
        const versionId = randomUUID();
        const response = await page.request.post("/api/company-templates/publish", {
          multipart: {
            ...publishMultipart({ templateId: fixture.id, versionId, slug: fixture.slug,
              expectedRevision: version === 1 ? "" : "1",
              html: withDocumentProtocol(`<!doctype html><html><head></head><body><h1>Isolation fixture v${version}</h1></body></html>`) }),
            name: "Template isolation fixture",
            description: "Two fixed versions for independent card interaction",
          },
        });
        expect(response.ok()).toBe(true);
        expect(await response.json()).toMatchObject({ ok: true, receipt: {
          template_id: fixture.id, version_id: versionId, version_number: version, revision: version,
        } });
      }
      expect(await countVersions(admin, fixture.id)).toBe(2);
    }
    await page.goto("/admin/company-templates");
    const announcement = page.getByRole("button", { name: "我知道了" });
    if (await announcement.isVisible()) await announcement.click();
    const card = (id: string) => page.locator("article").filter({
      has: page.locator(`a[href="/admin/company-templates/${id}"]`),
    });
    const a = card(fixtures[0].id);
    const b = card(fixtures[1].id);
    await exerciseCards(page, a, b);
    await page.reload();
    await exerciseCards(page, a, b);
    await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    // 只清理此用例生成的两个 ID，不修改种子模板和历史失败证据。
    const results = await Promise.allSettled(fixtures.map((fixture) => deleteTemplate(admin, fixture.id)));
    const failures = results.filter((result) => result.status === "rejected");
    expect(failures, "both isolated fixtures must be cleaned up").toEqual([]);
  }
});

async function exerciseCards(page: Page, a: Locator, b: Locator) {
  await expect(a).toHaveCount(1);
  await expect(b).toHaveCount(1);
  await expect(a.locator("details")).toHaveCount(1);
  await expect(b.locator("details")).toHaveCount(1);
  const closed = async (card: Locator) => {
    await expect(card.locator("details")).not.toHaveAttribute("open", "");
  };
  const height = async (card: Locator) => (await card.boundingBox())!.height;
  const toggle = (card: Locator) => card.locator("summary").click();
  await closed(a); await closed(b);
  const aBox = await a.boundingBox(); const bBox = await b.boundingBox();
  expect(aBox).not.toBeNull(); expect(bBox).not.toBeNull();
  expect(Math.abs(aBox!.y - bBox!.y), "fixtures must share the same two-column grid row").toBeLessThanOrEqual(1);
  expect(Math.abs(aBox!.x - bBox!.x)).toBeGreaterThan(1);
  const aHeight = aBox!.height; const bHeight = bBox!.height;
  await toggle(a);
  await expect(a.locator("details")).toHaveAttribute("open", "");
  await closed(b);
  await expect.poll(() => height(a)).toBeGreaterThan(aHeight);
  await expect.poll(() => height(b)).toBe(bHeight);
  await toggle(a);
  await closed(a); await closed(b);
  await expect.poll(() => height(a)).toBe(aHeight);
  await toggle(b);
  await expect(b.locator("details")).toHaveAttribute("open", "");
  await closed(a);
  await expect.poll(() => height(b)).toBeGreaterThan(bHeight);
  await expect.poll(() => height(a)).toBe(aHeight);
  await toggle(a);
  await expect(a.locator("details")).toHaveAttribute("open", "");
  await expect(b.locator("details")).toHaveAttribute("open", "");
  const bOpenHeight = await height(b);
  await toggle(a); await closed(a);
  await expect(b.locator("details")).toHaveAttribute("open", "");
  await expect.poll(() => height(b)).toBe(bOpenHeight);
  await toggle(b); await closed(b);
  await expect.poll(() => height(a)).toBe(aHeight);
  await expect.poll(() => height(b)).toBe(bHeight);
  await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(0);
}
