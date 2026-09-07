import { expect, test, type Locator, type Page } from "@playwright/test";

import type { SalesLeadDetail } from "../../lib/sales-leads-types";
import { loginAs, setTestLocale } from "./helpers/auth";

const publicFields = {
  primary_source_lead_id: "线索编号", latest_source_date: "线索日期", category: "类型",
  country: "国家或地区", region_timezone: "所在地区与时区", email: "邮箱", phone: "电话",
  whatsapp: "WhatsApp", website_url: "网站", public_contact: "公开联系方式", community_url: "社群入口",
  target_customer: "目标客户", public_pricing: "公开收费与门槛", recommended_approach: "建议联系方法",
  customer_profile: "客户画像",
  contact_talking_points: "联系话术", source_url: "资料来源", source_notes: "注意事项",
} as const;

function field(container: Locator, label: string) {
  return container.locator("dl > div").filter({ has: container.page().locator("dt").getByText(label, { exact: true }) }).locator("dd");
}

async function openFirstDetail(page: Page) {
  const response = page.waitForResponse((item) => item.url().endsWith("/rpc/get_sales_lead_detail") && item.request().method() === "POST");
  await page.getByTestId("sales-lead-list").getByRole("button", { name: /查看详情|View details/ }).first().click();
  const result = await response;
  expect(result.ok()).toBe(true);
  return await result.json() as SalesLeadDetail;
}

async function checkLayout(page: Page, container: Locator) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const issues = await container.locator("dd, dt, a, p, button, h3, h4").evaluateAll((elements) => elements.filter((element) => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const squeezed = (element.textContent?.trim().length ?? 0) >= 4 && rect.width < 18 && rect.height > 54;
    return squeezed || element.scrollWidth > element.clientWidth + 2 && getComputedStyle(element).display !== "inline";
  }).map((element) => element.tagName + ": " + element.textContent?.slice(0, 60)));
  expect(issues).toEqual([]);
}

test.describe("sales lead complete details", () => {
  test.setTimeout(120_000);
  for (const role of ["administrator", "salesman"] as const) {
    test(`${role} sees every public field from the actual local response`, async ({ page }) => {
      await loginAs(page, role);
      await page.goto(`/${role === "administrator" ? "admin" : role}/wholesale/leads`);
      // 此用例继续专门验证完整卡片，列表和展开资料在双视图用例中验收。
      await page.getByRole("button", { name: "卡片", exact: true }).click();
      const detail = await openFirstDetail(page);
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: detail.lead.name, exact: true })).toBeVisible();
      // 逐字段与实际数据库响应比较，而不是只检查新增标题；空值也必须有明确提示。
      for (const [key, label] of Object.entries(publicFields)) {
        const value = detail.lead[key as keyof typeof publicFields];
        await expect(field(dialog, label)).toHaveText(value?.trim() || "未提供");
      }
      await expect(field(dialog, "联系优先级")).toContainText(detail.lead.priority);
      await expect(field(dialog, "今日联系建议")).toHaveText(detail.lead.contact_today ? "建议今天联系" : "按计划联系");
      for (const width of [1440, 375]) {
        await page.setViewportSize({ width, height: 900 });
        await checkLayout(page, dialog);
        await dialog.getByRole("heading", { name: "基本资料" }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `output/lead-details-${role}-${width}-top.png` });
        await field(dialog, "注意事项").scrollIntoViewIfNeeded();
        await expect(field(dialog, "注意事项")).toBeInViewport();
        await page.screenshot({ path: `output/lead-details-${role}-${width}-source.png` });
        await dialog.getByRole("heading", { name: "认领记录" }).scrollIntoViewIfNeeded();
        await expect(dialog.getByRole("heading", { name: "认领记录" })).toBeInViewport();
      }
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      const card = page.getByTestId("sales-lead-list").locator("article").first();
      for (const key of ["email", "phone", "whatsapp", "website_url", "public_contact", "community_url"] as const) {
        await expect(field(card, publicFields[key])).toHaveText(detail.lead[key]?.trim() || "未提供");
      }
      await checkLayout(page, card);
      await page.screenshot({ path: `output/lead-list-${role}-375.png`, fullPage: true });
    });
  }

  test("long mixed contacts remain readable in both languages and unsafe addresses are plain text", async ({ page }) => {
    await loginAs(page, "administrator");
    const longUrl = `https://example.com/community/${"contact-team-".repeat(25)}`;
    // 使用真实账号和真实读取权限，仅替换浏览器响应里的展示内容，不修改共享数据库。
    await page.route("**/rpc/get_sales_lead_detail", async (route) => {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      const data = await response.json() as SalesLeadDetail;
      Object.assign(data.lead, {
        community_url: longUrl, whatsapp: "+1 (202) 555-0123", email: null,
        website_url: "javascript:alert(1)", public_contact: `联系团队：${longUrl}\n备用入口：https://example.org/contact`,
        source_notes: "先确认服务范围。\n" + "公开信息需在联系前核实。".repeat(60),
        contact_talking_points: "第一步：介绍业务。\n第二步：确认客户需求。\n第三步：约定后续联系。",
      });
      await route.fulfill({ response, json: data });
    });
    for (const locale of ["zh", "en"] as const) {
      await setTestLocale(page, locale);
      await page.goto("/admin/wholesale/leads");
      await openFirstDetail(page);
      const dialog = page.getByRole("dialog");
      await expect(dialog.locator('a[href="javascript:alert(1)"]')).toHaveCount(0);
      await expect(dialog.getByText("javascript:alert(1)", { exact: true })).toHaveCount(1);
      await expect(dialog.locator('a[href="https://wa.me/12025550123"]')).toHaveCount(1);
      await expect(dialog.locator(`a[href="${longUrl}"]`)).toHaveCount(2);
      await expect(field(dialog, locale === "zh" ? "邮箱" : "Email")).toHaveText(locale === "zh" ? "未提供" : "Not provided");
      for (const width of [1440, 375]) {
        await page.setViewportSize({ width, height: 900 });
        await checkLayout(page, dialog);
        const source = field(dialog, locale === "zh" ? "注意事项" : "Things to know");
        await field(dialog, locale === "zh" ? "公开联系方式" : "Public contact details").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `output/lead-details-contacts-${locale}-${width}.png` });
        await source.scrollIntoViewIfNeeded();
        await expect(source).toBeInViewport();
        await page.screenshot({ path: `output/lead-details-long-${locale}-${width}.png` });
      }
      await page.keyboard.press("Escape");
    }
  });
});
