import { expect, test, type Page } from "@playwright/test";

import { loginAs, setTestLocale } from "./helpers/auth";

async function openLead(page: Page, name: string) {
  await page.getByTestId("sales-lead-list").locator('[data-testid^="sales-lead-row-"]').filter({ has: page.getByRole("heading", { name, exact: true }) })
    .getByRole("button", { name: "查看详情" }).click();
}

test.describe("lead rules and administrator claims", () => {
  test.setTimeout(120_000);

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
          ? ["3 天内首次联系", "每 7 天持续跟进", "每次认领最多 30 天"]
          : ["First contact within 3 days", "Keep in touch every 7 days", "Up to 30 days per claim"]);
        await expect(rules.locator("dd").last()).toContainText(locale === "zh" ? "即使持续联系" : "even if contact continues");
        await expect(rules.locator("p")).toContainText(locale === "zh" ? "管理员和业务员遵循相同规则" : "The same rules apply to administrators and salespeople");
        for (const width of [1440, 375]) {
          await page.setViewportSize({ width, height: 900 });
          await rules.scrollIntoViewIfNeeded();
          const board = page.getByRole("button", { name: locale === "zh" ? "我的线索" : "My Leads" });
          const rulesBox = await rules.boundingBox();
          const boardBox = await board.boundingBox();
          expect(rulesBox!.y + rulesBox!.height).toBeLessThanOrEqual(boardBox!.y);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
          // 检查提示内每段文字，而非仅检查页面外框，防止三列在手机上挤成竖排。
          expect(await rules.locator("dt, dd, p").evaluateAll((elements) => elements.every((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width >= 100 && element.scrollWidth <= element.clientWidth + 1;
          }))).toBe(true);
          await page.screenshot({ path: `output/lead-rules-${role}-${locale}-${width}.png` });
        }
        await page.getByRole("button", { name: locale === "zh" ? "我的线索" : "My Leads" }).click();
        await expect(rules).toBeVisible();
      }
      await context.close();
    }
  });

  test("administrator claims for self, records contact, returns, reclaims and uses the lead", async ({ page }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/leads");
    const card = page.getByTestId("sales-lead-list").locator('[data-testid^="sales-lead-row-"]').first();
    const name = (await card.getByRole("heading").innerText()).trim();
    const claimId = (await card.getByRole("button", { name: "认领给自己" }).getAttribute("data-testid"))!;
    await page.getByTestId(claimId).click();
    await expect(page.getByRole("button", { name: "我的线索" })).toHaveAttribute("aria-pressed", "true");
    await openLead(page, name);
    await expect(page.getByRole("region", { name: "跟进进度" }).getByText("本次联系截止")).toBeVisible();
    await page.getByRole("button", { name: "记录联系", exact: true }).click();
    await page.getByTestId("sales-lead-action-note").fill("管理员已联系客户，等待确认采购清单。");
    await page.getByTestId("submit-lead-contact").click();
    await openLead(page, name);
    await expect(page.getByText("管理员已联系客户，等待确认采购清单。", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "退回大厅", exact: true }).click();
    await page.getByTestId("sales-lead-action-note").fill("调整跟进计划后退回。");
    await page.getByTestId("submit-lead-return").click();
    await page.getByRole("button", { name: "线索大厅" }).click();
    await page.getByTestId(claimId).click();
    await openLead(page, name);
    await expect(page.getByText("管理员已联系客户，等待确认采购清单。", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "标记已使用" }).click();
    await page.getByTestId("sales-lead-action-note").fill("管理员跟进的客户已确认订单。");
    await page.getByTestId("submit-lead-use").click();
    await page.getByRole("button", { name: "我已使用" }).click();
    await openLead(page, name);
    await expect(page.getByRole("region", { name: "跟进进度" }).getByText("管理员跟进的客户已确认订单。", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "重新开放" }).click();
    await page.getByTestId("sales-lead-action-note").fill("恢复本地测试线索。");
    await page.getByTestId("submit-lead-reopen").click();
  });

  test("administrator and salesperson cannot claim the same lead together", async ({ browser }) => {
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
    expect(await results.find((response) => !response.ok())!.json()).toMatchObject({ message: "sales_lead_already_claimed" });
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
