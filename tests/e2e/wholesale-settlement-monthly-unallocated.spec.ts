import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

import { loginWithAccount, setTestLocale } from "./helpers/auth";
import type { RegressionAccount } from "./helpers/accounts";
import { fillDateControl } from "./helpers/date-control";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";
import { chooseSelectOption } from "./helpers/select-control";
import { cleanupSettlementReleaseFixtures } from "./helpers/wholesale-settlement-fixtures";

test("本月未分配按收款月统计，三种角色均可查看并随分配刷新", async ({ browser }, testInfo) => {
  testInfo.setTimeout(300_000);
  const admin = getLocalSupabaseAdminClient();
  if (!admin) throw new Error("这项回归只允许使用本地 Supabase。");
  const token = randomUUID();
  const userIds: string[] = [];
  const notes = [`monthly-unallocated-${token}`, `monthly-cny-${token}`, `monthly-usd-${token}`, `previous-month-${token}`, `cancelled-${token}`];
  const customerId = randomUUID();
  const orderId = randomUUID();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const monthStart = `${date.slice(0, 7)}-01`;
  const previousDate = new Date(new Date(`${monthStart}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  const accounts: RegressionAccount[] = [];
  const pages: Page[] = [];
  const pageErrors: string[] = [];

  try {
    // 创建一次性角色和业务数据，不重置本地种子或修改已有账号。
    for (const role of ["administrator", "finance", "salesman"] as const) {
      const email = `monthly-${role}-${token}@pt5global.test`;
      const password = `Monthly!${randomUUID()}`;
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { name: `Monthly ${role}`, business_board: "wholesale" },
      });
      if (error || !data.user) throw error ?? new Error("创建测试账号失败。");
      const userId = data.user.id;
      userIds.push(userId);
      const { data: roleRow, error: roleError } = await admin.from("user_roles").select("id").eq("role", role).single();
      if (roleError) throw roleError;
      for (const result of [
        await admin.from("user_profiles").update({ status: "active" }).eq("user_id", userId),
        await admin.from("user_roles_data").upsert({ user_id: userId, role_id: roleRow.id }),
        await admin.from("user_workspace_business_access").upsert({ user_id: userId, business_key: "wholesale", is_enabled: true }),
      ]) if (result.error) throw result.error;
      accounts.push({ email, password, role, workspacePath: role === "administrator" ? "/admin" : `/${role}` });
    }
    const { error: customerError } = await admin.from("wholesale_customers").insert({
      id: customerId, unique_name: `Monthly customer ${token}`, customer_kind: "sales_created",
      assigned_sales_user_id: userIds[2], created_by_user_id: userIds[0],
    });
    if (customerError) throw customerError;
    const { error: orderError } = await admin.from("wholesale_orders").insert({
      id: orderId, order_number: `MONTHLY-${token}`, customer_id: customerId,
      sales_user_id: userIds[2], created_by_user_id: userIds[0], order_month: monthStart,
      customer_payment_currency: "CNY", customer_payment_amount: 10000, settlement_exchange_rate: 1,
    });
    if (orderError) throw orderError;

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

    const { error: releaseError } = await admin.from("wholesale_settlement_releases").insert([
      { note: notes[1], release_amount: 124293.70, release_currency: "CNY", received_on: date, status: "pending" },
      { note: notes[2], release_amount: 50203.40, release_currency: "USD", received_on: date, status: "pending" },
      { note: notes[3], release_amount: 999, release_currency: "USD", received_on: previousDate, status: "pending" },
      { note: notes[4], release_amount: 88, release_currency: "USD", received_on: date, status: "cancelled" },
    ].map((row) => ({
      ...row, customer_id: customerId, customer_name: `Monthly customer ${token}`, published_by_user_id: userIds[1],
      cancelled_by_user_id: row.status === "cancelled" ? userIds[1] : null,
      cancelled_at: row.status === "cancelled" ? new Date().toISOString() : null,
    })));
    if (releaseError) throw releaseError;
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
  } finally {
    await Promise.all(pages.map((page) => page.close()));
    await cleanupSettlementReleaseFixtures(notes);
    for (const [table, id] of [["wholesale_orders", orderId], ["wholesale_customers", customerId]]) {
      const { error } = await admin.from(table).delete().eq("id", id);
      if (error) throw error;
    }
    // 注册触发器也会给每个测试账号建立客户，先删这些专属客户再删账号。
    if (userIds.length > 0) {
      const { error } = await admin.from("wholesale_customers").delete().in("registered_user_id", userIds);
      if (error) throw error;
    }
    for (const userId of userIds) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
    }
  }
});
