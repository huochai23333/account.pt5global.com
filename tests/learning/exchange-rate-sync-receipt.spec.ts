import { writeFile } from "node:fs/promises";
import type { Page } from "@playwright/test";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const origin = "http://localhost:3000";
const edge = "**/functions/v1/exchange-rate-sync";

async function dismissFixtureAnnouncement(page: Page, messages: typeof en | typeof zh) {
  const notice = messages.DashboardShell.announcements;
  const announcement = page.getByRole("dialog", { name: notice.newTitle, exact: true });
  await page.addLocatorHandler(announcement, () => announcement.getByRole("button", { name: notice.acknowledge }).click());
}

function readQuote(id: string) {
  return JSON.parse(executeLearningSql(`select row_to_json(entry) from (
    select id, original_currency, rate_date, daily_exchange_rate, provider_updated_at, source, is_day_final, xmin::text as version
    from public.exchange_rate where id='${id}'
  ) entry;`) || "null");
}

test.describe("财务汇率权限", () => {
  test.use({ learningRole: "finance" });

  test("财务只能查看汇率，刷新后仍无维护操作", async ({ page, learningUser }) => {
    await page.context().addCookies([{ name: "bs-locale", value: "zh", url: origin }]);
    await loginLearningUser(page, learningUser);
    await page.goto("/finance/settings");
    const copy = zh.ExchangeRates;
    const assertReadOnly = async () => {
      await expect(page).toHaveURL(/\/finance\/settings$/);
      await expect(page.getByRole("heading", { name: copy.history.title, exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: copy.actions.create, exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: copy.sync.fetchNow, exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: copy.sync.fetchHistorical, exact: true })).toHaveCount(0);
    };
    await assertReadOnly();
    await page.reload();
    await assertReadOnly();
  });
});

test("历史补充拒绝盘中报价凭证，并可核对刷新后的日末报价 en/390", async ({ page, learningUser }, testInfo) => {
  const copy = en.ExchangeRates;
  const baseCurrency = "XTS";
  const rateDate = executeLearningSql("select public.current_exchange_rate_date() - 1;");
  const quotedAt = `${rateDate}T08:00:00.000Z`;
  expect(executeLearningSql(`select count(*) from public.exchange_rate where original_currency='${baseCurrency}' and rate_date='${rateDate}';`)).toBe("0");
  const saveQuote = (dayFinal: boolean) => learningUser.client.rpc("save_boc_exchange_rate", {
    p_currency: baseCurrency, p_rate_date: rateDate, p_buying_rate: 1.005,
    p_bank_quote: 100.5, p_quoted_at: quotedAt, p_day_final: dayFinal,
  });
  const { data, error } = await saveQuote(false);
  expect(error).toBeNull();
  const rateRecordId: string = data[0].id;
  const requestBodies: unknown[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    expect(data[0]).toMatchObject({ changed: true, is_day_final: false });
    const intraday = readQuote(rateRecordId);
    // 同一条模拟结果在盘中标记时应失败，只有数据库中的日末版本可以通过。
    await page.route(edge, async (route) => {
      requestBodies.push(route.request().postDataJSON());
      await route.fulfill({ headers: { "access-control-allow-origin": origin }, json: {
        operationId: learningUser.runId, operationStatus: "succeeded", outcome: "succeeded",
        insertedCount: 0, skippedCount: 1, failedCount: 0,
        results: [{ baseCurrency, targetCurrency: "CNY", rateDate, rate: 1.005, rateRecordId, quotedAt, status: "skipped" }],
      } });
    });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.context().addCookies([{ name: "bs-locale", value: "en", url: origin }]);
    await dismissFixtureAnnouncement(page, en);
    await loginLearningUser(page, learningUser);
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: en.SystemSettings.header.title, exact: true })).toBeVisible();
    await page.getByRole("button", { name: copy.sync.fetchHistorical, exact: true }).click();
    const history = page.getByRole("dialog", { name: copy.historicalFetch.title });
    const currencies = history.getByPlaceholder(copy.historicalFetch.currencyPlaceholder);
    for (let count = await currencies.count(); count > 1; count--) {
      await history.getByRole("button", { name: copy.historicalFetch.removeCurrency.replace("{index}", String(count)), exact: true }).click();
    }
    await currencies.first().fill(baseCurrency);
    const submit = history.getByRole("button", { name: copy.historicalFetch.submit, exact: true });
    await submit.click();
    await expect(history.getByText(copy.historicalFetch.feedback.failed, { exact: true })).toBeVisible();
    await expect(history.getByText(rateRecordId, { exact: false })).toHaveCount(0);
    expect(readQuote(rateRecordId)).toEqual(intraday);

    const finalQuote = await saveQuote(true);
    expect(finalQuote.error).toBeNull();
    expect(finalQuote.data[0]).toMatchObject({ changed: true, id: rateRecordId, is_day_final: true });
    const stored = readQuote(rateRecordId);
    expect(stored.version).not.toBe(intraday.version);
    await submit.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await expect(history.getByText(rateRecordId, { exact: false })).toBeVisible();
    expect(requestBodies).toEqual(Array(2).fill({ trigger: "historical", baseCurrencies: [baseCurrency], fromDate: rateDate, toDate: rateDate }));
    await page.screenshot({ path: testInfo.outputPath("verified-history.png") });
    await page.reload();
    await page.getByPlaceholder(copy.filters.originalCurrencyPlaceholder).fill(baseCurrency);
    const historyCard = page.getByRole("heading", { name: `${baseCurrency}/CNY`, level: 3, exact: true }).locator("xpath=../..");
    await expect(historyCard.getByText("1.005", { exact: true })).toBeVisible();
    expect(readQuote(rateRecordId)).toEqual(stored);
    expect(errors).toEqual([]);
    await writeFile(testInfo.outputPath("history-sync-receipt.json"), JSON.stringify({ intraday, stored, requestBodies }, null, 2));
  } finally {
    executeLearningSql(`delete from public.exchange_rate where id='${rateRecordId}' and original_currency='${baseCurrency}' and rate_date='${rateDate}';`);
    expect(readQuote(rateRecordId)).toBeNull();
  }
});

for (const [locale, width, baseCurrency, messages] of [
  ["zh", 1440, "XTS", zh], ["en", 390, "ZZZ", en],
] as const) {
  test(`同步拒绝缺项和错计数并保留部分完成 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    const copy = messages.ExchangeRates;
    const quotedAt = new Date(executeLearningSql("select clock_timestamp() - interval '3 seconds';")).toISOString();
    const rateDate = new Date(Date.parse(quotedAt) + 28_800_000).toISOString().slice(0, 10);
    const requested = [baseCurrency, "XUA"];
    expect(executeLearningSql(`select count(*) from public.exchange_rate where original_currency='${baseCurrency}' and rate_date='${rateDate}';`)).toBe("0");
    const { data, error } = await learningUser.client.rpc("save_boc_exchange_rate", {
      p_currency: baseCurrency, p_rate_date: rateDate, p_buying_rate: 1.005,
      p_bank_quote: 100.5, p_quoted_at: quotedAt, p_day_final: false,
    });
    // 只使用为本用例插入的测试币种。清理按函数返回的唯一编号执行。
    expect(error).toBeNull();
    const rateRecordId: string = data[0].id;

    const okRow = { baseCurrency, targetCurrency: "CNY", ok: true, rate: 1.005, rateDate, rateRecordId, quotedAt };
    const failedRow = { baseCurrency: "XUA", targetCurrency: "CNY", ok: false };
    const operationId = learningUser.runId;
    const requestBodies: unknown[] = [];
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    try {
      expect(data[0]).toMatchObject({ changed: true, id: expect.any(String) });
      const stored = readQuote(rateRecordId);
      expect(stored).toMatchObject({ original_currency: baseCurrency, source: "nowapi", daily_exchange_rate: 1.005 });
      await page.route(edge, async (route) => {
        requestBodies.push(route.request().postDataJSON());
        // 仅模拟供应商/Edge 的 HTTP 回执，后续报价凭证仍从真实本地库读回。
        const base = { operationId, outcome: "succeeded", operationStatus: "succeeded", successCount: 2, failedCount: 0 };
        const payload = requestBodies.length === 1 ? { ...base, results: [okRow] }
          : requestBodies.length === 2 ? { ...base, results: [okRow, failedRow] }
          : { ...base, operationStatus: "queued", outcome: "partial_failed", successCount: 1, failedCount: 1, results: [okRow, failedRow] };
        await route.fulfill({ headers: { "access-control-allow-origin": origin }, json: payload });
      });
      await page.setViewportSize({ width, height: 900 });
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: origin }]);
      if (locale === "en") await dismissFixtureAnnouncement(page, messages);
      await loginLearningUser(page, learningUser);
      await page.goto("/admin/settings");
      await expect(page.getByRole("heading", { name: messages.SystemSettings.header.title, exact: true })).toBeVisible();
      const manual = page.getByText(copy.sync.manualTitle, { exact: true }).locator("xpath=../..");
      const currencies = manual.getByPlaceholder(copy.sync.currencyPlaceholder);
      const fetchNow = manual.getByRole("button", { name: copy.sync.fetchNow, exact: true });
      await currencies.first().fill(baseCurrency);
      await manual.getByRole("button", { name: copy.sync.addManualCurrency, exact: true }).click();
      await currencies.nth(1).fill("XUA");
      const success = copy.sync.feedback.manualFetched.replace("{count}", "2");
      for (let attempt = 0; attempt < 2; attempt++) {
        await fetchNow.click();
        await expect(page.getByText(copy.errors.unknown, { exact: true })).toBeVisible();
        await expect(page.getByText(success, { exact: true })).toHaveCount(0);
      }
      await fetchNow.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      const partial = copy.sync.feedback.manualPartial.replace("{count}", "1").replace("{failed}", "1");
      await expect(page.getByText(partial, { exact: true })).toBeVisible();
      expect(requestBodies).toEqual(Array(3).fill({ trigger: "manual", baseCurrencies: requested }));
      await expect(manual.getByText(rateRecordId, { exact: false })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("partial-sync.png") });
      await page.reload();
      await page.getByPlaceholder(copy.filters.originalCurrencyPlaceholder).fill(baseCurrency);
      await expect(page.getByRole("heading", { name: `${baseCurrency}/CNY`, level: 4, exact: true })).toBeVisible();
      expect(readQuote(rateRecordId)).toEqual(stored);
      expect(errors).toEqual([]);
      await writeFile(testInfo.outputPath("sync-receipt.json"), JSON.stringify({ operationId, stored, requestBodies }, null, 2));
    } finally {
      executeLearningSql(`delete from public.exchange_rate where id='${rateRecordId}' and original_currency='${baseCurrency}' and rate_date='${rateDate}';`);
      expect(readQuote(rateRecordId)).toBeNull();
    }
  });
}
