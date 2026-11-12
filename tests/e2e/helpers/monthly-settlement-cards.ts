import { expect, type Browser, type Page, type TestInfo } from "@playwright/test";
import { loginWithAccount, setTestLocale } from "./auth";
import { chooseSelectOption } from "./select-control";
import type { MonthlySettlementFixture } from "./monthly-settlement-fixture";

/** 三岗位共用原卡片/布局/筛选步骤；一创建就登记页面，失败时由调用方统一回收。 */
export async function verifyMonthlySettlementRoleCards(
  browser: Browser, accounts: MonthlySettlementFixture["accounts"], pages: Page[], pageErrors: string[], testInfo: TestInfo,
) {
    for (const account of accounts) {
      const page = await browser.newPage();
      pages.push(page);
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await loginWithAccount(page, account);
      await page.goto(`${account.workspacePath}/wholesale/settlement-releases`);
      const card = page.locator('[data-slot="metric-card"]').filter({ hasText: "本月未分配金额" });
      await expect(card).toContainText("¥124,393.70 / US$50,203.40");
      await page.setViewportSize({ width: 1440, height: 1000 });
      await expect.poll(() => card.locator("..").evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length)).toBe(3);
      if (account.role === "administrator") await page.screenshot({ path: testInfo.outputPath("monthly-unallocated-desktop.png") });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect.poll(() => card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      if (account.role === "administrator") await page.screenshot({ path: testInfo.outputPath("monthly-unallocated-mobile.png") });
      await page.getByLabel("搜索收款").fill("no-matching-release");
      await expect(card).toContainText("¥124,393.70 / US$50,203.40");
      await chooseSelectOption(page.getByLabel("处理状态"), { value: "allocated" });
      await expect(card).toContainText("¥124,393.70 / US$50,203.40");
      if (account.role === "administrator") {
        await setTestLocale(page, "en");
        await page.reload();
        await expect(page.locator('[data-slot="metric-card"]').filter({ hasText: "Unallocated this month" })).toContainText("¥124,393.70 / US$50,203.40");
      }
    }
}
