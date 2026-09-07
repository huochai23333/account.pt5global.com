import { expect, test, type Page, type Locator } from "@playwright/test";
import type { SalesLeadPageData } from "../../lib/sales-leads-types";
import { loginAs, setTestLocale } from "./helpers/auth";

const rows = (page: Page) => page.locator('[data-testid^="sales-lead-row-"]');
const mode = (page: Page, label: string) => page.getByRole("button", { name: label, exact: true });
async function checkLayout(page: Page, area: Locator) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await area.locator("p, h3, h4, dt, dd, button").evaluateAll((nodes) => nodes.filter((node) => {
    const box = node.getBoundingClientRect();
    if (!box.width || !box.height || node.classList.contains("sr-only")) return false;
    return box.width < 18 && (node.textContent?.length ?? 0) > 4 || node.scrollWidth > node.clientWidth + 2;
  }).map((node) => node.textContent?.slice(0, 50)))).toEqual([]);
}
async function expandedArea(page: Page, row: Locator, label: string) {
  const button = row.getByRole("button", { name: label, exact: true });
  const id = await button.getAttribute("aria-controls");
  await button.click();
  // 点击后文案会变成“收起资料”，用内容关联标识定位同一按钮，避免仍按旧文案查找。
  await expect(row.locator(`button[aria-controls="${id}"]`)).toHaveAttribute("aria-expanded", "true");
  return page.locator(`[id="${id}"]`);
}

test.describe("sales lead display modes", () => {
  test.setTimeout(180_000);
  for (const role of ["administrator", "salesman"] as const) {
    test(`${role}: preference, pagination, search and complete information`, async ({ page }) => {
      await loginAs(page, role);
      const path = `/${role === "administrator" ? "admin" : role}/wholesale/leads`;
      await page.goto(path);
      await expect(mode(page, "列表")).toHaveAttribute("aria-pressed", "true");
      await expect(rows(page).first()).toBeVisible();
      await page.getByRole("button", { name: "下一页", exact: true }).click();
      await expect(page.getByRole("button", { name: "上一页", exact: true })).toBeEnabled();
      const ids = await rows(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")));
      await mode(page, "卡片").click();
      await expect(page.getByTestId("sales-lead-cards")).toBeVisible();
      await expect(page.getByRole("button", { name: "上一页", exact: true })).toBeEnabled();
      await mode(page, "列表").click();
      expect(await rows(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")))).toEqual(ids);
      const name = await rows(page).first().getByRole("heading").innerText();
      const search = page.getByLabel("搜索线索");
      await search.fill(name);
      await expect(rows(page)).toHaveCount(1);
      await mode(page, "卡片").click();
      await expect(search).toHaveValue(name);
      await page.reload();
      await expect(mode(page, "卡片")).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "我的线索" }).click();
      await expect(mode(page, "卡片")).toHaveAttribute("aria-pressed", "true");
      await page.goto(path);
      await mode(page, "列表").click();

      let historyRequests = 0;
      page.on("request", (request) => { if (request.url().includes("get_sales_lead_detail")) historyRequests++; });
      const first = rows(page).first();
      const profile = await first.getByTestId("profile-summary").innerText();
      const info = await expandedArea(page, first, "展开资料");
      await expect(info.locator("dl > div").filter({ has: page.locator("dt").getByText("客户画像", { exact: true }) }).locator("dd")).toHaveText(profile);
      await expandedArea(page, rows(page).nth(1), "展开资料");
      expect(historyRequests).toBe(0);
      await first.getByRole("button", { name: "查看详情", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("dialog").locator("dl > div").filter({ has: page.locator("dt").getByText("客户画像", { exact: true }) }).locator("dd")).toHaveText(profile);
      expect(await page.locator("[id]").evaluateAll((nodes) => {
        const ids = nodes.map((node) => node.id); return ids.filter((id, index) => ids.indexOf(id) !== index);
      })).toEqual([]);
      await page.keyboard.press("Escape");

      if (role === "administrator") {
        await page.getByRole("button", { name: "全部认领" }).click();
        const filter = page.getByRole("combobox", { name: "筛选业务员" });
        await filter.click();
        const person = page.getByRole("option").nth(1);
        const personName = await person.innerText();
        await person.click();
        await mode(page, "卡片").click();
        await expect(filter).toContainText(personName);
        await mode(page, "列表").click();
        await expect(filter).toContainText(personName);
      }

      for (const locale of ["zh", "en"] as const) {
        await setTestLocale(page, locale);
        await page.goto(path);
        const info = await expandedArea(page, rows(page).first(), locale === "zh" ? "展开资料" : "Show information");
        for (const width of [1440, 1024, 375]) {
          await page.setViewportSize({ width, height: 900 });
          await rows(page).first().scrollIntoViewIfNeeded();
          await checkLayout(page, page.getByTestId("sales-lead-list"));
          await page.screenshot({ path: `output/lead-views-${role}-${locale}-${width}.png` });
          await info.scrollIntoViewIfNeeded();
          await checkLayout(page, info);
        }
      }
    });
  }

  test("long profiles, missing values and source error are readable in both languages", async ({ page }) => {
    await loginAs(page, "administrator");
    const profile = "公开客户画像 | ".repeat(250) + "\n结束标识";
    const website = "https://example.com/" + "long-contact-path-".repeat(40);
    // 登录与读取权限仍走本地真实账号，仅替换展示资料以覆盖极端长度。
    await page.route("**/rpc/get_sales_lead_page", async (route) => {
      const response = await route.fetch();
      const data = await response.json() as SalesLeadPageData;
      if (data.items.length) {
        data.items[0].customer_profile = profile;
        data.items[0].website_url = website;
        data.items[0].name = "很长的公开公司名称".repeat(20);
        if (data.items[1]) data.items[1].customer_profile = null;
      }
      data.syncState = { ...data.syncState, last_error: "source_json_missing:2026-09-07" };
      await route.fulfill({ response, json: data });
    });
    for (const locale of ["zh", "en"] as const) {
      await setTestLocale(page, locale);
      await page.goto("/admin/wholesale/leads");
      await expect(page.getByText(locale === "zh" ? "2026-09-07 的来源资料尚未补齐" : "Source information for 2026-09-07 is incomplete", { exact: false })).toBeVisible();
      await expect(rows(page).nth(1).getByTestId("profile-summary")).toHaveText(locale === "zh" ? "未提供" : "Not provided");
      const info = await expandedArea(page, rows(page).first(), locale === "zh" ? "展开资料" : "Show information");
      await expect(info.getByText(profile, { exact: true })).toBeVisible();
      await expect(info.getByText(website, { exact: true })).toBeVisible();
      for (const width of [1440, 1024, 375]) {
        await page.setViewportSize({ width, height: 900 });
        await checkLayout(page, page.getByTestId("sales-lead-list"));
        await rows(page).first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `output/lead-views-long-${locale}-${width}.png` });
      }
      await mode(page, locale === "zh" ? "卡片" : "Cards").click();
      await expect(page.getByTestId("sales-lead-cards").getByText(profile, { exact: true })).toBeVisible();
      await checkLayout(page, page.getByTestId("sales-lead-cards"));
      await mode(page, locale === "zh" ? "列表" : "List").click();
    }
  });

  test("blocked storage still allows switching and empty results retain controls", async ({ page }) => {
    await loginAs(page, "salesman");
    await page.addInitScript(() => {
      const get = Storage.prototype.getItem;
      const set = Storage.prototype.setItem;
      Storage.prototype.getItem = function (key) { if (key === "pt5-sales-leads-view") throw new Error("blocked"); return get.call(this, key); };
      Storage.prototype.setItem = function (key, value) { if (key === "pt5-sales-leads-view") throw new Error("blocked"); return set.call(this, key, value); };
    });
    await page.goto("/salesman/wholesale/leads");
    await mode(page, "卡片").click();
    await expect(mode(page, "卡片")).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(mode(page, "列表")).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("搜索线索").fill("没有匹配的线索-views-test");
    await expect(rows(page)).toHaveCount(0);
    await mode(page, "卡片").click();
    await expect(page.getByLabel("搜索线索")).toHaveValue("没有匹配的线索-views-test");
  });
});
