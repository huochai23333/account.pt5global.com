import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";
import { localSqlValue, readLocalPostgresRows } from "./helpers/local-postgres-query";
import { prepareCurrentExchangeRateFixture } from "./helpers/current-exchange-rate-fixture";

test("完整费用集合超过二百条仍可分页、筛选、刷新，桌面和手机共用页码", async ({ page }) => {
  test.setTimeout(120_000);
  const admin = getLocalSupabaseAdminClient();
  if (!admin) throw new Error("需要本地测试数据库。");
  const marker = `pagination-${randomUUID()}`;
  const rows = Array.from({ length: 205 }, (_, index) => ({
    id: randomUUID(), title: `${marker}-${String(index).padStart(3, "0")}`,
    category: "other", amount: 1, currency_code: "USD", expense_month: "2026-01-01",
    created_by_user_id: "11111111-1111-4111-8111-111111111111",
  }));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  try {
    expect((await admin.from("company_expenses").insert(rows)).error).toBeNull();
    // 测试夹具只在本地创建；结果总数从独立 PostgreSQL 连接读取。
    const [{ count }] = readLocalPostgresRows<{ count: number }>(
      `select count(*) from public.company_expenses where title like ${localSqlValue(`${marker}%`)}`,
    );
    expect(count).toBe(205);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, "administrator");
    await page.goto("/admin/company-expenses");
    const search = page.getByPlaceholder("搜索费用名称、收款方或备注");
    await search.fill(marker);
    await expect(page.getByText("第 1-20 条，共 205 条", { exact: true })).toBeVisible();
    await expect(page.locator("main h3").filter({ hasText: marker })).toHaveCount(20);
    const firstTitles = await page.locator("main h3").filter({ hasText: marker }).allTextContents();
    await page.getByRole("button", { name: "下一页" }).click();
    await expect(page.getByText("第 21-40 条，共 205 条", { exact: true })).toBeVisible();
    const nextTitles = await page.locator("main h3").filter({ hasText: marker }).allTextContents();
    expect(nextTitles.some((title) => firstTitles.includes(title))).toBe(false);
    await search.fill(`${marker}-204`);
    await expect(page.getByText("第 1-1 条，共 1 条", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "上一页" })).toBeDisabled();
    await search.fill(`${marker}-missing`);
    await expect(page.getByText("第 0-0 条，共 0 条", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "下一页" })).toBeDisabled();
    await search.fill(marker);
    for (let index = 0; index < 10; index += 1) await page.getByRole("button", { name: "下一页" }).click();
    await expect(page.getByText("第 201-205 条，共 205 条", { exact: true })).toBeVisible();
    await expect(page.locator("main h3").filter({ hasText: marker })).toHaveCount(5);
    await expect(page.getByRole("button", { name: "下一页" })).toBeDisabled();
    await expectLayout(page, "expenses-desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await expectLayout(page, "expenses-mobile");
    await page.reload();
    await search.fill(marker);
    await expect(page.getByText("第 1-20 条，共 205 条", { exact: true })).toBeVisible();
    await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    const cleanup = await admin.from("company_expenses").delete().in("id", rows.map((row) => row.id)).select("id");
    expect(cleanup.error).toBeNull();
    expect(cleanup.data).toHaveLength(205);
  }
});

test("所有启用的完整列表均可渲染，并在两个宽度保持分页底栏可用", async ({ page }) => {
  test.setTimeout(240_000);
  await loginAs(page, "administrator");
  const cleanupRate = await prepareCurrentExchangeRateFixture();
  const paths = ["accounts", "announcements", "feedback", "company-expenses", "reviews", "settings", "wholesale/leads",
    "wholesale/customers", "wholesale/people", "wholesale/vip", "wholesale/referrals",
    "wholesale/commission", "wholesale/incentives", "wholesale/inventory-orders", "wholesale/settlement-releases"];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  try { for (const path of paths) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/admin/${path}`);
    await expect(page).toHaveURL(new RegExp(`/admin/${path}$`));
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("heading", { name: "当前页面暂时出错" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "当前页面暂时打不开" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "你访问的页面不存在" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "这个页面不在你的工作范围内" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "继续加载", exact: true })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "列表分页", exact: true }).first()).toBeVisible();
    if (path === "wholesale/referrals") {
      // 分页只限制客户卡片数量，下级人数仍必须来自完整推荐关系。
      await expect(page.getByText("下级 1", { exact: true })).toBeVisible();
    }
    for (const nav of await page.getByRole("navigation", { name: "列表分页", exact: true }).all()) {
      await expect(nav.getByRole("button", { name: "上一页" })).toBeDisabled();
      await expect(nav).toContainText("第 1 页");
    }
    await expectLayout(page, path.replaceAll("/", "-") + "-desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await expectLayout(page, path.replaceAll("/", "-") + "-mobile");
    if (path === "wholesale/inventory-orders") {
      await page.getByRole("button", { name: /^信贷管理/ }).click();
      await expect(page.getByRole("navigation", { name: "列表分页", exact: true }).first()).toBeVisible();
      await expectLayout(page, "inventory-credit-mobile");
      await page.setViewportSize({ width: 1440, height: 900 });
      await expectLayout(page, "inventory-credit-desktop");
    }
  }
  expect(errors).toEqual([]);
  } finally { await cleanupRate(); }
});

async function expectLayout(page: Page, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  const lastPager = page.getByRole("navigation", { name: "列表分页", exact: true }).last();
  if (await lastPager.count()) await lastPager.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `output/pagination/${name}.png` });
}
