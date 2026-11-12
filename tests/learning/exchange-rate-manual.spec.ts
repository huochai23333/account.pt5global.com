import { writeFile } from "node:fs/promises";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

function readManualRates(currency: string, date: string) {
  // 数值转成数据库的十进制文本，独立核对牌价与每单位汇率的比例。
  return JSON.parse(executeLearningSql(`select coalesce(json_agg(entry order by id), '[]') from (
    select id, rate_date, trim_scale(daily_exchange_rate)::text as rate, trim_scale(bank_quote)::text as quote,
      source, bank_code, quote_type, provider_updated_at, xmin::text as row_version
    from public.exchange_rate where original_currency='${currency}' and rate_date='${date}'
  ) entry;`));
}

for (const [locale, width, currency, messages] of [
  ["zh", 1440, "XTS", zh], ["en", 390, "ZZZ", en],
] as const) {
  test(`汇率人工录入核对原目标和报价 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    const copy = messages.ExchangeRates;
    const nowInBeijing = new Date(Date.now() + 28_800_000).toISOString();
    const date = nowInBeijing.slice(0, 10);
    const time = nowInBeijing.slice(11, 19);
    expect(readManualRates(currency, date)).toEqual([]);
    const pageErrors: string[] = [];
    let createRequests = 0;
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/rest/v1/exchange_rate" && request.method() === "POST") createRequests += 1;
    });
    await page.setViewportSize({ width, height: 900 });
    await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
    await loginLearningUser(page, learningUser);
    // 登录夹具处理中文公告。英文公告在首页先确认，避免和报价弹窗争夺焦点。
    const notice = messages.DashboardShell.announcements;
    const announcement = page.getByRole("dialog", { name: notice.newTitle, exact: true });
    if (locale === "en" && await announcement.isVisible()) {
      await announcement.getByRole("button", { name: notice.acknowledge, exact: true }).click();
      await expect(announcement).toBeHidden();
    }
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: messages.SystemSettings.header.title, exact: true })).toBeVisible();

    try {
      await page.getByRole("button", { name: copy.actions.create, exact: true }).click();
      const create = page.getByRole("dialog", { name: copy.dialogs.create.title });
      await create.getByPlaceholder(copy.dialogs.placeholders.originalCurrency).fill(currency);
      await create.getByPlaceholder(copy.dialogs.placeholders.targetCurrency).fill("CNY");
      await create.getByPlaceholder(copy.dialogs.placeholders.dailyExchangeRate).fill("1.005");
      const dateField = create.locator('input[data-mode="date"]');
      await dateField.fill(date);
      await dateField.press("Tab");
      await create.getByPlaceholder(copy.dialogs.placeholders.quoteTime).fill(time);
      await expect(create).toHaveCSS("opacity", "1");
      expect(await create.evaluate((element) => element.getBoundingClientRect().width <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("manual-rate-form.png") });
      const inserted = page.waitForResponse((response) => new URL(response.url()).pathname === "/rest/v1/exchange_rate" && response.request().method() === "POST");
      // 两个事件在同一轮执行，实际只应发出一次写入。
      await create.getByRole("button", { name: copy.dialogs.create.submit, exact: true })
        .evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      const insertResponse = await inserted;
      expect(insertResponse.ok(), `数据库拒绝人工报价：${insertResponse.ok() ? "" : await insertResponse.text()}`).toBe(true);
      const insertedPayload = await insertResponse.json();
      await expect.poll(() => readManualRates(currency, date)).toMatchObject([
        { rate: "1.005", quote: "100.5", source: "manual", bank_code: "BOC", quote_type: "spot_buy" },
      ]);
      await expect(create).toHaveCount(0);
      expect(createRequests).toBe(1);
      const [created] = readManualRates(currency, date);
      expect(Date.parse(created.provider_updated_at)).toBe(Date.parse(`${date}T${time}+08:00`));

      await page.reload();
      const search = page.getByPlaceholder(copy.filters.originalCurrencyPlaceholder);
      await search.fill(currency);
      const editButton = page.getByRole("button", { name: copy.actions.edit, exact: true }).filter({ visible: true });
      await expect(editButton).toHaveCount(1);
      await editButton.click();
      const edit = page.getByRole("dialog", { name: copy.dialogs.edit.title });
      const rateInput = edit.getByPlaceholder(copy.dialogs.placeholders.dailyExchangeRate);
      await expect(rateInput).toHaveValue("1.005");
      await rateInput.fill("1.015");

      // 模拟成功传输却只返回原报价。原行存在，但不能证明本次改价已经保存。
      let interceptedOldReceipt = false;
      await page.route("**/rest/v1/exchange_rate?**", async (route) => {
        if (route.request().method() !== "PATCH" || interceptedOldReceipt) return route.continue();
        interceptedOldReceipt = true;
        await route.fulfill({ json: insertedPayload });
      });
      await edit.getByRole("button", { name: copy.dialogs.edit.submit, exact: true }).click();
      await expect(edit.getByRole("alert")).toBeVisible();
      await expect(rateInput).toHaveValue("1.015");
      expect(readManualRates(currency, date)).toEqual([created]);

      await edit.getByRole("button", { name: copy.dialogs.edit.submit, exact: true }).click();
      await expect.poll(() => readManualRates(currency, date)).toMatchObject([
        { id: created.id, rate: "1.015", quote: "101.5", source: "manual" },
      ]);
      await expect(edit).toHaveCount(0);
      const [updated] = readManualRates(currency, date);
      expect(updated.row_version).not.toBe(created.row_version);
      await page.reload();
      await search.fill(currency);
      await editButton.click();
      await expect(rateInput).toHaveValue("1.015");
      await edit.getByRole("button", { name: copy.dialogs.cancel, exact: true }).click();

      await page.getByRole("button", { name: copy.actions.delete, exact: true }).filter({ visible: true }).click();
      const confirmation = page.getByRole("dialog", { name: messages.DashboardFramework.confirm.title });
      await confirmation.getByRole("button", { name: messages.DashboardFramework.confirm.accept, exact: true }).click();
      await expect.poll(() => readManualRates(currency, date)).toEqual([]);
      await page.reload();
      await search.fill(currency);
      await expect(editButton).toHaveCount(0);
      expect(pageErrors).toEqual([]);
      await writeFile(testInfo.outputPath("rate-receipts.json"), JSON.stringify({ created, updated }, null, 2));
    } finally {
      // 启动前确认此币种与日期为空，清理只覆盖本次人工报价。
      executeLearningSql(`delete from public.exchange_rate where original_currency='${currency}' and rate_date='${date}' and source='manual';`);
      expect(readManualRates(currency, date)).toEqual([]);
    }
  });
}
