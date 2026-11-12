import { expect, test, type Page } from "@playwright/test";

import {
  expectDateControlValue,
  fillDateControl,
} from "./helpers/date-control";
import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import {
  createQuoteFixture,
  prepareQuoteFixture,
  cleanupQuoteFixture,
  readQuoteFixture,
  assertQuoteProviderUnavailable,
} from "./helpers/current-exchange-rate-fixture";
import { runLocalSupabaseSql } from "./helpers/local-supabase";
import {
  readLocalPostgresRows,
  localSqlValue,
} from "./helpers/local-postgres-query";
import { shanghaiDate } from "../test-support/shanghai-calendar";
import { cleanupFixtureResources } from "../test-support/fixture-cleanup-sequence";
const fixtureToday = shanghaiDate(),
  fixtureYesterday = addDays(fixtureToday, -1);
const todayFixture = createQuoteFixture(fixtureToday),
  yesterdayFixture = createQuoteFixture(fixtureYesterday, true);
test.beforeAll(async () => {
  assertQuoteProviderUnavailable();
  prepareQuoteFixture(todayFixture);
  const previous = prepareQuoteFixture(yesterdayFixture);
  // 合成日末样本只属于专属实例，不代表真实银行验收；不覆盖不满足前提的已有报价。
  expect(previous.source).toBe("nowapi");
  expect(previous.is_day_final).toBe(true);
  expect(previous.bank_code).toBe("BOC");
});
test.beforeEach(async () => {
  expect(
    runLocalSupabaseSql("select public.current_exchange_rate_date()::text;"),
  ).toBe(fixtureToday);
});
test.afterEach(async ({ page }) => {
  await page.close();
});
test.afterAll(async () => {
  await cleanupFixtureResources(
    async () => cleanupQuoteFixture(yesterdayFixture),
    async () => cleanupQuoteFixture(todayFixture),
  );
});

test.describe("汇率按日期补充", () => {
  test("管理员可校验并提交历史范围，结果和输入保留在弹窗内", async ({
    page,
  }) => {
    await loginAs(page, "administrator");
    await page.setViewportSize({ height: 950, width: 1440 });
    await page.goto("/admin/settings");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    const yesterday = fixtureYesterday;
    const edgeRequests: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/functions/v1/exchange-rate-sync"))
        edgeRequests.push(request.postDataJSON());
    });
    const thirtyTwoDayRangeStart = addDays(yesterday, -31);

    await page.getByRole("button", { name: "按日期补充" }).click();
    const dialog = page.getByRole("dialog", { name: "按日期补充汇率" });
    const fromDate = dialog.getByRole("textbox", {
      exact: true,
      name: "开始日期",
    });
    const toDate = dialog.getByRole("textbox", {
      exact: true,
      name: "结束日期",
    });

    await expectDateControlValue(fromDate, yesterday);
    await expectDateControlValue(toDate, yesterday);
    await expect(dialog.getByLabel("币种 1")).toHaveValue("USD");
    // 32 个含首尾的日历日期必须在浏览器端被拦住，且不清空用户已经填写的范围。
    await fillDateControl(fromDate, toChineseDate(thirtyTwoDayRangeStart));
    await dialog.getByRole("button", { name: "获取并保存" }).click();
    await expect(
      dialog.getByText("一次最多补充连续 31 天的汇率。"),
    ).toBeVisible();
    await expectDateControlValue(fromDate, thirtyTwoDayRangeStart);

    await fillDateControl(fromDate, toChineseDate(yesterday));
    await dialog.getByLabel("币种 1").fill("US");
    await dialog.getByRole("button", { name: "获取并保存" }).click();
    await expect(
      dialog.getByText("币种代码需要是 3 位字母，例如 USD。"),
    ).toBeVisible();
    await expect(dialog.getByLabel("币种 1")).toHaveValue("US");
    expect(edgeRequests).toHaveLength(0);

    // 页面提交已有昨日美元与本地失败币种；供应商凭据已明确禁用，部分完成必须保留凭证和失败明细。
    const currencyInputs = dialog.getByRole("textbox", { name: /^币种 \d+$/ });
    while ((await currencyInputs.count()) > 1)
      await dialog
        .getByRole("button", { name: /移除第/ })
        .last()
        .click();
    await dialog.getByLabel("币种 1").fill("usd");
    await dialog.getByRole("button", { name: "添加币种" }).click();
    await dialog.getByLabel("币种 2").fill("ZZZ");
    const operationResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/functions/v1/exchange-rate-sync") &&
        response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "获取并保存" }).click();
    await expect(
      dialog.getByText(/已新增 0 条，跳过已有 1 条，失败 1 条/),
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      dialog.getByRole("region", { name: "未能获取的日期" }),
    ).toContainText(`${yesterday} · ZZZ`);

    const batch = await (await operationResponse).json();
    expect(batch.operationId).toMatch(/^[a-f0-9-]{36}$/i);
    expect(batch.outcome).toBe("partial_failed");
    expect(edgeRequests).toHaveLength(1);
    // 单次尝试已部分失败；全局规则仍可能排队重试，queued绝不当作整个任务已完成。
    const [run] = readLocalPostgresRows<Record<string, unknown>>(
      `select * from private.operation_runs where id=${localSqlValue(batch.operationId)}::uuid`,
    );
    const attempts = readLocalPostgresRows<Record<string, unknown>>(
      `select * from private.operation_attempts where operation_run_id=${localSqlValue(batch.operationId)}::uuid order by attempt_number`,
    );
    expect(run).toBeDefined();
    expect(run.operation_key).toBe("exchange-rate-sync");
    expect(run.request_payload).toEqual({
      trigger: "historical",
      baseCurrencies: ["USD", "ZZZ"],
      fromDate: yesterday,
      toDate: yesterday,
    });
    expect(run.succeeded_count).toBe(1);
    expect(run.failed_count).toBe(1);
    expect(run.expected_count).toBe(2);
    expect(run.status).toBe(batch.operationStatus);
    expect(["queued", "partial_failed", "needs_attention"]).toContain(
      run.status,
    );
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe("partial_failed");
    expect(attempts[0].completed_at).toBeTruthy();
    console.log(
      "[历史汇率本地失败凭证]",
      JSON.stringify({
        operationId: run.id,
        status: run.status,
        attemptStatus: attempts[0].status,
      }),
    );
    const saved = readQuoteFixture(yesterday);
    if (!saved) throw new Error("historical_fixture_quote_missing");
    expect(saved.is_day_final).toBe(true);
    expect(saved.bank_code).toBe("BOC");
    await expect(dialog.getByText(new RegExp(saved.id))).toBeVisible();
    await expectDateControlValue(fromDate, yesterday);
    // 同一个长弹窗缩到 390px 后，固定底部操作、失败明细和表单都不能撑出屏幕。
    await page.setViewportSize({ height: 844, width: 390 });
    await expect(dialog).toBeVisible();
    const dialogActions = dialog.getByTestId("dashboard-dialog-actions");
    await expect(dialogActions).toBeVisible();
    await expectMinimumHeight(
      dialogActions.getByRole("button", { name: "关闭", exact: true }),
      44,
    );
    await expectMinimumHeight(
      dialogActions.getByRole("button", { name: "获取并保存" }),
      44,
    );
    await expectNoHorizontalOverflow(page);
    const dialogLayout = await dialog.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dialogLayout.scrollWidth).toBeLessThanOrEqual(
      dialogLayout.clientWidth + 1,
    );
  });

  test("历史日期优先决定最新汇率，桌面表格和移动卡片完整展示来源", async ({
    page,
  }) => {
    await loginAs(page, "administrator");
    await page.setViewportSize({ height: 950, width: 1440 });
    await page.goto("/admin/settings");

    // 页面与数据库核对本批报价；专属合成数据不作为真实银行来源验收。

    const today = fixtureToday;
    const quote = readQuoteFixture(today);
    if (!quote) throw new Error("current_fixture_quote_missing");
    const latestUsdCard = page
      .locator("article:visible")
      .filter({ hasText: "USD/CNY" })
      .first();
    await expect(latestUsdCard).toContainText(
      String(Number(quote.daily_exchange_rate)),
    );
    const historicalRateDate = addDays(today, -1);
    const desktopHistoryRow = page
      .locator("table:visible tbody tr")
      .filter({ hasText: toChineseDate(historicalRateDate) })
      .filter({ hasText: "USD" });
    await expect(desktopHistoryRow).toContainText("NowAPI");
    await expect(desktopHistoryRow).toContainText(
      toChineseDate(historicalRateDate),
    );
    await expectNoHorizontalOverflow(page);

    await page.reload();
    await page.setViewportSize({ height: 900, width: 390 });
    const responsiveHistory = page
      .locator('[data-slot="responsive-data-view"]')
      .last();
    await expect(responsiveHistory.locator("table")).toBeHidden();
    const mobileHistoryCard = responsiveHistory
      .locator("article:visible")
      .filter({ hasText: toChineseDate(historicalRateDate) })
      .filter({ hasText: "USD/CNY" });
    await expect(mobileHistoryCard).toHaveCount(1);
    await expect(mobileHistoryCard).toContainText("USD/CNY");
    await expect(mobileHistoryCard).toContainText("汇率日期");
    await expect(mobileHistoryCard).toContainText(
      toChineseDate(historicalRateDate),
    );
    await expect(mobileHistoryCard).toContainText("获取方式");
    await expect(
      mobileHistoryCard.getByRole("button", { name: "编辑" }),
    ).toBeVisible();
    await expect(
      mobileHistoryCard.getByRole("button", { name: "删除" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

function addDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount))
    .toISOString()
    .slice(0, 10);
}

function toChineseDate(value: string) {
  return value.replaceAll("-", "/");
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
}

async function expectMinimumHeight(
  locator: import("@playwright/test").Locator,
  minimum: number,
) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(minimum);
}
