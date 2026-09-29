import { saveOpenLeadAsCustomer, cleanupSalesLeadConversion } from "./helpers/sales-lead-conversion";
import { expect, test, type Page } from "@playwright/test";

import { loginAs, setTestLocale } from "./helpers/auth";
import { getRegressionAccount } from "./helpers/accounts";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";

async function openLead(page: Page, name: string) {
  await page.getByTestId("sales-lead-list").locator('[data-testid^="sales-lead-row-"]').filter({ has: page.getByRole("heading", { name, exact: true }) })
    .getByRole("button", { name: "查看详情" }).click();
}

/** 浏览器回归共用本地账号；只在本用例期间腾出当日额度，结束后恢复既有认领日期。 */
async function reserveClaimQuota(roles: Array<"administrator" | "salesman">) {
  const admin = getLocalSupabaseAdminClient();
  if (!admin) throw new Error("本地数据库管理员连接不可用。");
  const emails = roles.map((role) => getRegressionAccount(role).email.toLowerCase());
  const { data: profiles, error: profilesError } = await admin.from("user_profiles")
    .select("user_id,email").in("email", emails);
  if (profilesError || !profiles || profiles.length !== roles.length) throw new Error("线索测试账号资料缺失。");
  const userIds = profiles.map((profile) => String(profile.user_id));
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const dayStart = new Date(`${day}T00:00:00+08:00`).toISOString();
  const dayEnd = new Date(Date.parse(dayStart) + 86_400_000).toISOString();
  const { data: previous, error: previousError } = await admin.from("sales_lead_assignments")
    .select("id,claimed_at").in("assignee_user_id", userIds).gte("claimed_at", dayStart).lt("claimed_at", dayEnd);
  if (previousError || !previous) throw new Error("线索当日额度暂时无法核对。");
  const previousIds = previous.map((row) => String(row.id));
  const shiftedAt = new Date(Date.now() - 31 * 86_400_000).toISOString();
  const startedAt = new Date(Date.now() - 5_000).toISOString();
  if (previousIds.length > 0) {
    const { error } = await admin.from("sales_lead_assignments").update({ claimed_at: shiftedAt }).in("id", previousIds);
    if (error) throw error;
  }
  // 先独立核对双方本日领取次数均为 0，竞争测试才能排除额度拦截这个替代原因。
  for (const userId of userIds) {
    const { count, error } = await admin.from("sales_lead_assignments").select("id", { count: "exact", head: true })
      .eq("assignee_user_id", userId).gte("claimed_at", dayStart).lt("claimed_at", dayEnd);
    if (error) throw error;
    expect(count).toBe(0);
  }
  return async () => {
    // 本用例新建的认领记录也移出当日额度，避免影响下一条共享账号回归。
    const { data: recent, error: recentError } = await admin.from("sales_lead_assignments")
      .select("id").in("assignee_user_id", userIds).gte("claimed_at", startedAt);
    if (recentError || !recent) throw new Error("线索测试新增记录暂时无法核对。");
    const createdIds = recent.map((row) => String(row.id)).filter((id) => !previousIds.includes(id));
    if (createdIds.length > 0) {
      const { error } = await admin.from("sales_lead_assignments").update({ claimed_at: shiftedAt }).in("id", createdIds);
      if (error) throw error;
    }
    for (const row of previous) {
      const { error } = await admin.from("sales_lead_assignments")
        .update({ claimed_at: row.claimed_at }).eq("id", row.id);
      if (error) throw error;
    }
  };
}

test.describe("lead rules and administrator claims", () => {
  test.setTimeout(120_000);
  let restoreClaimQuota: (() => Promise<void>) | null = null;
  test.afterEach(async () => {
    if (restoreClaimQuota) await restoreClaimQuota();
    restoreClaimQuota = null;
  });

  test("both roles see complete rules above the boards in Chinese and English", async ({ browser }) => {
    for (const role of ["administrator", "salesman"] as const) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await loginAs(page, role);
      for (const locale of ["zh", "en"] as const) {
        await setTestLocale(page, locale);
        await page.goto(`/${role === "administrator" ? "admin" : role}/wholesale/leads`);
        const rules = page.getByTestId("sales-lead-rules");
        await expect(rules.locator("dt")).toHaveText(locale === "zh"
          ? ["30天内成为客户"]
          : ["Convert within 30 days"]);
        await expect(rules.locator("dd").last()).toContainText(locale === "zh" ? "记录联系不会延长期限" : "Contact records do not extend");
        await expect(rules.locator("p")).toContainText(locale === "zh" ? "管理员和业务员遵循相同规则" : "Administrators and salespeople follow the same rules");
        for (const width of [1440, 375]) {
          await page.setViewportSize({ width, height: 900 });
          // 手机规则默认折叠，先按用户实际操作展开后再检查完整内容。
          const visibleRules = width < 768 ? rules : page.getByTestId("sales-lead-rules-desktop");
          if (width < 768) await visibleRules.locator("summary").click();
          await visibleRules.scrollIntoViewIfNeeded();
          const board = page.getByRole("button", { name: locale === "zh" ? "我的线索" : "My Leads" });
          const rulesBox = await visibleRules.boundingBox();
          const boardBox = await board.boundingBox();
          expect(rulesBox!.y + rulesBox!.height).toBeLessThanOrEqual(boardBox!.y);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
          // 检查提示内每段文字，而非仅检查页面外框，防止三列在手机上挤成竖排。
          expect(await visibleRules.locator("dt, dd, p").evaluateAll((elements) => elements.every((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width >= 100 && element.scrollWidth <= element.clientWidth + 1;
          }))).toBe(true);
          await page.screenshot({ path: `output/lead-rules-${role}-${locale}-${width}.png` });
        }
        await page.getByRole("button", { name: locale === "zh" ? "我的线索" : "My Leads" }).click();
        await expect(page.getByTestId("sales-lead-rules")).toBeVisible();
      }
      await context.close();
    }
  });

  test("administrator claims for self, records contact, returns, reclaims and converts the lead", async ({ page }) => {
    // 历史运行会在同一线索留下旧备注；本次使用唯一文字，避免把旧记录误当成新写入。
    const contactNote = `管理员已联系客户，等待确认采购清单 ${Date.now()}`;
    restoreClaimQuota = await reserveClaimQuota(["administrator"]);
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/leads");
    const card = page.getByTestId("sales-lead-list").locator('[data-testid^="sales-lead-row-"]').first();
    const name = (await card.getByRole("heading").innerText()).trim();
    const claimId = (await card.getByRole("button", { name: "认领给自己" }).getAttribute("data-testid"))!;
    await page.getByTestId(claimId).click();
    await expect(page.getByRole("button", { name: "我的线索" })).toHaveAttribute("aria-pressed", "true");
    await openLead(page, name);
    await expect(page.getByRole("region", { name: "跟进进度" }).getByText("成为客户截止时间")).toBeVisible();
    await page.getByRole("button", { name: "记录联系", exact: true }).click();
    await page.getByTestId("sales-lead-action-note").fill(contactNote);
    await page.getByTestId("submit-lead-contact").click();
    await openLead(page, name);
    await expect(page.getByText(contactNote, { exact: true })).toBeVisible();
    const admin = getLocalSupabaseAdminClient();
    if (!admin) throw new Error("本地数据库管理员连接不可用。");
    const { data: savedNotes, error: savedNotesError } = await admin.from("sales_lead_contact_notes")
      .select("id").eq("note", contactNote);
    if (savedNotesError) throw savedNotesError;
    expect(savedNotes).toHaveLength(1);
    await page.getByRole("button", { name: "退回大厅", exact: true }).click();
    await page.getByTestId("sales-lead-action-note").fill("调整跟进计划后退回。");
    await page.getByTestId("submit-lead-return").click();
    await page.getByRole("button", { name: "线索大厅" }).click();
    await page.getByTestId(claimId).click();
    await openLead(page, name);
    await expect(page.getByText(contactNote, { exact: true })).toBeVisible();
    const leadId = claimId.replace("claim-lead-", "");
    try {
      const proof = await saveOpenLeadAsCustomer(page, leadId, "管理员跟进的客户已确认合作。");
      expect(proof.owner).toBe("11111111-1111-4111-8111-111111111111");
      await page.reload();
      await page.getByRole("button", { name: /^已成为客户/ }).click();
      await openLead(page, name);
      await expect(page.getByRole("region", { name: "跟进进度" }).getByText(proof.customer_id!, { exact: true })).toBeVisible();
    } finally { cleanupSalesLeadConversion(leadId); }

  });

  test("administrator and salesperson cannot claim the same lead together", async ({ browser }) => {
    restoreClaimQuota = await reserveClaimQuota(["administrator", "salesman"]);
    const adminContext = await browser.newContext();
    const salesContext = await browser.newContext();
    const admin = await adminContext.newPage();
    const sales = await salesContext.newPage();
    await loginAs(admin, "administrator");
    await loginAs(sales, "salesman");
    await admin.goto("/admin/wholesale/leads");
    await sales.goto("/salesman/wholesale/leads");
    const card = admin.getByTestId("sales-lead-list").locator('[data-testid^="sales-lead-row-"]').first();
    const name = (await card.getByRole("heading").innerText()).trim();
    const id = (await card.getByRole("button", { name: "认领给自己" }).getAttribute("data-testid"))!;
    await expect(sales.getByTestId(id)).toBeVisible();
    const claimResponses = [admin, sales].map((page) => page.waitForResponse((response) =>
      response.url().endsWith("/rpc/claim_sales_lead") && response.request().method() === "POST"));
    // 同时触发两个已渲染按钮，验证实际数据库争抢，而非模拟接口结果。
    await Promise.all([admin, sales].map((page) => page.getByTestId(id).evaluate((button: HTMLElement) => button.click())));
    const results = await Promise.all(claimResponses);
    expect(results.filter((response) => response.ok())).toHaveLength(1);
    // 双方额度已通过独立查询确认充足，败方只能因为另一人已经认领而失败。
    const rejected = await results.find((response) => !response.ok())!.json();
    expect(rejected.message).toBe("sales_lead_already_claimed");
    const database = getLocalSupabaseAdminClient();
    if (!database) throw new Error("本地数据库管理员连接不可用。");
    const { data: assignments, error: assignmentError } = await database.from("sales_lead_assignments")
      .select("id,assignee_user_id,ended_at").eq("lead_id", id.replace("claim-lead-", "")).is("ended_at", null);
    if (assignmentError) throw assignmentError;
    expect(assignments).toHaveLength(1);
    const winnerAccount = getRegressionAccount(results[0].ok() ? "administrator" : "salesman");
    const { data: winnerProfile, error: winnerError } = await database.from("user_profiles")
      .select("user_id").eq("email", winnerAccount.email).single();
    if (winnerError) throw winnerError;
    expect(assignments![0].assignee_user_id).toBe(winnerProfile.user_id);
    // 两边请求都结束后重新读取看板，避免把切换中的大厅卡片误当作“我的线索”。
    await Promise.all([admin, sales].map((page) => page.reload()));
    await Promise.all([admin, sales].map((page) => page.getByRole("button", { name: "我的线索" }).click()));
    const winner = results[0].ok() ? admin : sales;
    const loser = results[0].ok() ? sales : admin;
    await expect(winner.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(loser.getByRole("heading", { name, exact: true })).toHaveCount(0);
    await openLead(winner, name);
    await winner.getByRole("button", { name: "退回大厅", exact: true }).click();
    await winner.getByTestId("sales-lead-action-note").fill("并发验证后退回大厅。");
    await winner.getByTestId("submit-lead-return").click();
    await adminContext.close();
    await salesContext.close();
  });
});
