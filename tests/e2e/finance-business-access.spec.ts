import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import {
  expectForbiddenPage,
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import { getRegressionAccount } from "./helpers/accounts";
import { readLocalEnvValue } from "./helpers/local-supabase-admin";
import { getWholesaleReferralCommissionRows } from "@/lib/wholesale-referral-commissions";

test("财务和管理员看到的推荐佣金与数据库一致，刷新后仍一致", async ({ page }) => {
  const supabaseUrl = readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readLocalEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  test.skip(!supabaseUrl || !anonKey || !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/i.test(supabaseUrl), "需要本地数据库核对推荐佣金。");
  if (!supabaseUrl || !anonKey) return;

  for (const role of ["finance", "administrator"] as const) {
    // 佣金函数按当前账号权限计算，独立查询也必须使用与页面相同的身份。
    const db = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const account = getRegressionAccount(role);
    const { error } = await db.auth.signInWithPassword({ email: account.email, password: account.password });
    expect(error).toBeNull();
    const rows = await getWholesaleReferralCommissionRows(db);
    expect(rows.length).toBeGreaterThan(0);
    const total = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
    const amount = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total);
    await loginAs(page, role);
    await page.goto(`/${role === "administrator" ? "admin" : role}/wholesale/commission`);
    const totalCard = page.locator('[data-slot="metric-card"]').filter({ hasText: "佣金合计" });
    const countCard = page.locator('[data-slot="metric-card"]').filter({ hasText: "月度记录" });
    await expect(totalCard).toContainText(amount);
    await expect(countCard).toContainText(String(rows.length));
    for (const row of rows) await expect(page.getByText(row.monthKey, { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(totalCard).toContainText(amount);
    await expect(countCard).toContainText(String(rows.length));
    await page.goto("/auth/sign-out?next=%2Flogin");
    await page.getByRole("button", { name: "退出登录" }).click();
  }
});

test.describe("finance business access", () => {
  test("finance can open salesman-like wholesale sections", async ({ page }) => {
    await loginAs(page, "finance");

    for (const workspacePath of [
      "/finance/wholesale/orders",
      "/finance/wholesale/settlement-releases",
      "/finance/wholesale/order-claims",
      "/finance/wholesale/logistics",
      "/finance/wholesale/customers",
      "/finance/wholesale/vip",
      "/finance/wholesale/referrals",
      "/finance/wholesale/commission",
      "/finance/wholesale/incentives",
    ]) {
      await page.goto(workspacePath);
      await expectWorkspaceShell(page);
      await expectNotForbiddenPage(page);
    }
  });

  test("finance only sees wholesale business on desktop and mobile", async ({
    page,
  }) => {
    await loginAs(page, "finance");
    await page.goto("/finance/wholesale/orders");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    const desktopSidebar = page.locator("aside").first();
    await expect(
      desktopSidebar.getByText("旅游业务", { exact: true }),
    ).toHaveCount(0);
    await expect(
      desktopSidebar.getByText("批发业务", { exact: true }),
    ).toBeVisible();
    await expect(
      desktopSidebar.getByRole("link", { name: "公司费用" }),
    ).toBeVisible();
    await expect(
      desktopSidebar.getByRole("link", { name: "批发订单" }),
    ).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/finance/wholesale/orders");

    const mobileHeader = page.locator("header").first();
    await expect(page.getByRole("heading", { name: "批发订单" })).toBeVisible();
    await mobileHeader
      .getByRole("button", { name: "批发业务 / 批发订单" })
      .click();

    const mobileNav = mobileHeader.locator("nav");
    await expect(
      mobileNav.getByText("旅游业务", { exact: true }),
    ).toHaveCount(0);
    await expect(
      mobileNav.getByText("批发业务", { exact: true }),
    ).toBeVisible();
    await expect(
      mobileNav.getByRole("link", { name: "公司费用" }),
    ).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
  });

  test("finance cannot open administrator-only wholesale pages", async ({
    page,
  }) => {
    await loginAs(page, "finance");

    await page.goto("/finance/wholesale/people");

    await expectForbiddenPage(page);
  });

  test("finance can manage claim groups while administrator-only pages stay protected", async ({
    page,
  }) => {
    await loginAs(page, "finance");
    await page.goto("/finance/wholesale/order-claims");

    await expect(
      page.getByRole("button", { name: "上传 1688 文件" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /已认领/ }).click();
    await expect(page.getByText("1688-LOCAL-001").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "调整关联" }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: /认领大厅/ }).click();
    await expect(
      page.getByRole("button", { exact: true, name: "认领" }),
    ).not.toHaveCount(0);
    await page.setViewportSize({ height: 844, width: 390 });
    await expectNoDocumentHorizontalOverflow(page);
  });

  test("finance cannot open tourism business", async ({ page }) => {
    await loginAs(page, "finance");

    await page.goto("/finance/tourism/commission");

    await expect(page).toHaveURL(
      /\/business-unavailable\?business=tourism$/,
    );
    await expect(
      page.getByRole("heading", { name: "旅游业务暂时停止服务" }),
    ).toBeVisible();
  });
});

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflowPixels).toBeLessThanOrEqual(2);
}
