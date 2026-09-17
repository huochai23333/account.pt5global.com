import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";
import { fillDateControl } from "./helpers/date-control";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";
import { chooseSelectOption } from "./helpers/select-control";
import {
  cleanupSettlementReleaseFixtures,
  getActiveAllocationTotal,
} from "./helpers/wholesale-settlement-fixtures";

test("本月有效分配缺少美元换算汇率时不展示部分合计", async ({ browser }) => {
  const note = `月度换算缺口 ${Date.now()}`;
  const admin = getLocalSupabaseAdminClient();
  if (!admin) throw new Error("这项回归必须连接本地 Supabase。");

  const missingDate = await findMissingUsdRateDate();
  const financePage = await browser.newPage();
  const salesmanPage = await browser.newPage();
  try {
    await loginAs(financePage, "finance");
    await financePage.goto("/finance/wholesale/settlement-releases");
    await financePage.getByRole("button", { name: "发布收款" }).click();
    const publishDialog = financePage.getByRole("dialog", {
      name: "发布结汇收款",
    });
    await chooseSelectOption(
      publishDialog.getByRole("combobox", { name: "选择客户" }),
      { label: "Wholesale Alpha" },
    );
    await publishDialog.getByLabel("结汇金额").fill("100");
    await chooseSelectOption(publishDialog.getByLabel("币种"), {
      value: "CNY",
    });
    await fillDateControl(publishDialog.getByLabel("收款日期"), missingDate);
    await publishDialog.getByLabel("备注").fill(note);
    await publishDialog.getByRole("button", { name: "发布收款" }).click();
    await expect(financePage.getByText("结汇收款已发布。")).toBeVisible();

    await loginAs(salesmanPage, "salesman");
    await salesmanPage.goto("/salesman/wholesale/settlement-releases");
    await salesmanPage.getByLabel("搜索收款").fill(note);
    const releaseRow = salesmanPage.getByRole("row").filter({ hasText: note });
    await releaseRow.getByRole("button", { name: "开始分配" }).click();
    const allocationDialog = salesmanPage.getByRole("dialog", {
      name: "分配收款",
    });
    await expect(allocationDialog.locator('input[type="number"]').first())
      .toHaveValue("100.00");
    await allocationDialog.getByRole("button", { name: "保存全部分配" }).click();

    await expect(salesmanPage.getByText("结汇收款分配已保存。")).toBeVisible();
    await expect.poll(() => getActiveAllocationTotal(note)).toBe(100);
    const monthlyCard = salesmanPage.locator('[data-slot="metric-card"]').filter({
      hasText: "本月已分配金额",
    });
    await expect(monthlyCard).toContainText("暂无法计算");
    await expect(monthlyCard).toContainText("1 笔分配缺少收款日美元汇率");
    await expect(monthlyCard).not.toContainText("US$0.00");

    // 独立查库确认缺口确实存在；整页刷新后仍必须是不可计算状态。
    const { data: rates, error } = await admin
      .from("exchange_rate")
      .select("id")
      .eq("original_currency", "USD")
      .eq("target_currency", "CNY")
      .eq("rate_date", missingDate);
    if (error) throw error;
    expect(rates).toHaveLength(0);
    await salesmanPage.reload();
    await expect(monthlyCard).toContainText("暂无法计算");

    await salesmanPage.getByLabel("搜索收款").fill(note);
    await releaseRow.getByRole("button", { name: "调整分配" }).click();
    const adjustDialog = salesmanPage.getByRole("dialog", {
      name: "调整收款分配",
    });
    await adjustDialog.getByRole("button", { name: "清空当前分配" }).click();
    await adjustDialog.getByRole("button", { name: "确认清空" }).click();
    await expect.poll(() => getActiveAllocationTotal(note)).toBe(0);
    await expect(monthlyCard).toContainText("US$0.00");
  } finally {
    await financePage.close();
    await salesmanPage.close();
    await cleanupSettlementReleaseFixtures([note]);
  }
});

async function findMissingUsdRateDate() {
  const admin = getLocalSupabaseAdminClient();
  if (!admin) throw new Error("缺少本地 Supabase 管理连接。");
  const now = new Date();
  // 收款日期可以早于分配月；寻找一个确实缺少 USD 汇率的过去业务日期。
  for (let daysAgo = 1; daysAgo <= 45; daysAgo += 1) {
    const candidate = new Date(now.getTime() - daysAgo * 86_400_000);
    const date = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "Asia/Shanghai",
      year: "numeric",
    }).format(candidate);
    const { data, error } = await admin
      .from("exchange_rate")
      .select("id")
      .eq("original_currency", "USD")
      .eq("target_currency", "CNY")
      .eq("rate_date", date)
      .limit(1);
    if (error) throw error;
    if (!data?.length) return date;
  }
  throw new Error("过去 45 天没有可用于缺汇率故障注入的业务日期。");
}
