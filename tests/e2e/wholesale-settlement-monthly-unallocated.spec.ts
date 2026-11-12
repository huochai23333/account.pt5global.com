import { expect, test, type Page } from "@playwright/test";

import { loginWithAccount } from "./helpers/auth";
import { fillDateControl } from "./helpers/date-control";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";
import { chooseSelectOption } from "./helpers/select-control";
import { cleanupSettlementReleaseFixtures } from "./helpers/wholesale-settlement-fixtures";
import { createMonthlySettlementFixture, prepareMonthlySettlementFixture, insertMonthlySettlementBalances } from "./helpers/monthly-settlement-fixture";
import { verifyMonthlySettlementRoleCards } from "./helpers/monthly-settlement-cards";
import { assertMonthlySettlementTarget, cleanupMonthlySettlementFixture } from "../test-support/monthly-settlement-lifecycle";

test("本月未分配按收款月统计，三种角色均可查看并随分配刷新", async ({ browser }, testInfo) => {
  testInfo.setTimeout(300_000);
  const admin = getLocalSupabaseAdminClient();
  if (!admin) throw new Error("这项回归只允许使用本地 Supabase。");
  // 准入发生在任何准备写入之前；专属模式还须匹配实际DB/API项目。
  assertMonthlySettlementTarget();
  const fixture = createMonthlySettlementFixture();
  const { notes, customerId, date, accounts } = fixture;
  const pages: Page[] = [];
  const pageErrors: string[] = [];

  let bodyFailed = false;
  let bodyError: unknown;
  try {
    await prepareMonthlySettlementFixture(admin, fixture);

    // 确认本地夹具的初始余额；预期金额不从被测函数生成。
    const financePage = await browser.newPage();
    pages.push(financePage);
    financePage.on("pageerror", (error) => pageErrors.push(error.message));
    await loginWithAccount(financePage, accounts[1]);
    await financePage.goto("/finance/wholesale/settlement-releases");
    const monthly = financePage.locator('[data-slot="metric-card"]').filter({ hasText: "本月未分配金额" });
    const value = monthly.locator(":scope > div").last();
    const baseline = await value.innerText();
    // 现有本地测试环境无收款种子；若改用已有业务数据的环境，明确中止而非清空业务数据。
    expect(baseline, "请在没有本月未分配余额的本地夹具中运行此回归。").toBe("已全部分配");

    await insertMonthlySettlementBalances(admin, fixture);
    await financePage.reload();
    await expect(value).toHaveText("¥124,293.70 / US$50,203.40");
    await expect(financePage.locator('[data-slot="metric-card"]')).toHaveCount(6);
    await expect(financePage.locator('[data-slot="metric-card"]').filter({ hasText: "尚未分配金额" })).toContainText("US$51,202.40");

    await financePage.getByRole("button", { name: "发布收款" }).click();
    const publish = financePage.getByRole("dialog", { name: "发布结汇收款" });
    await chooseSelectOption(publish.getByRole("combobox", { name: "选择客户" }), { value: customerId });
    await publish.getByLabel("结汇金额").fill("100");
    await chooseSelectOption(publish.getByLabel("币种"), { value: "CNY" });
    await fillDateControl(publish.getByLabel("收款日期"), date);
    await publish.getByLabel("备注").fill(notes[0]);
    await publish.getByRole("button", { name: "发布收款" }).click();
    await expect(value).toHaveText("¥124,393.70 / US$50,203.40");

    await verifyMonthlySettlementRoleCards(browser, accounts, pages, pageErrors, testInfo);

    const salesmanPage = pages[pages.length - 1];
    await salesmanPage.setViewportSize({ width: 1440, height: 1000 });
    await chooseSelectOption(salesmanPage.getByLabel("处理状态"), { value: "all" });
    await salesmanPage.getByLabel("搜索收款").fill(notes[0]);
    const row = salesmanPage.getByRole("row").filter({ hasText: notes[0] });
    const salesmanValue = salesmanPage.locator('[data-slot="metric-card"]').filter({ hasText: "本月未分配金额" }).locator(":scope > div").last();
    for (const [amount, expected, buttonName] of [
      ["40", "¥124,353.70 / US$50,203.40", "开始分配"],
      ["60", "¥124,333.70 / US$50,203.40", "继续分配"],
      ["100", "¥124,293.70 / US$50,203.40", "继续分配"],
    ]) {
      await row.getByRole("button", { name: buttonName }).click();
      const dialog = salesmanPage.getByRole("dialog");
      await dialog.locator('input[type="number"]').first().fill(amount);
      await dialog.getByRole("button", { name: "保存全部分配" }).click();
      await expect(salesmanValue).toHaveText(expected);
    }
    await row.getByRole("button", { name: "调整分配" }).click();
    const clear = salesmanPage.getByRole("dialog");
    await clear.getByRole("button", { name: "清空当前分配" }).click();
    await clear.getByRole("button", { name: "确认清空" }).click();
    await expect(salesmanValue).toHaveText("¥124,393.70 / US$50,203.40");
    await salesmanPage.reload();
    await expect(salesmanValue).toHaveText("¥124,393.70 / US$50,203.40");

    await financePage.reload();
    await financePage.getByLabel("搜索收款").fill(notes[0]);
    await financePage.getByRole("row").filter({ hasText: notes[0] }).getByRole("button", { name: "取消", exact: true }).click();
    await expect(value).toHaveText("¥124,293.70 / US$50,203.40");
    expect(pageErrors).toEqual([]);
  } catch (error) {
    bodyFailed = true;
    bodyError = error;
    throw error;
  } finally {
    try {
      await cleanupMonthlySettlementFixture(admin, fixture, pages, () => cleanupSettlementReleaseFixtures(notes));
    } catch (cleanupError) {
      // 页面断言失败与清理失败同时保留，不能用最后一个异常掩盖最初问题。
      if (bodyFailed) throw new AggregateError([bodyError, cleanupError], "monthly_unallocated_cleanup_failed");
      throw cleanupError;
    }
  }
});
