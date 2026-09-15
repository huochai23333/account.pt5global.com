import { expect, test, type Page } from "@playwright/test";

import {
  expectDateControlValue,
  fillDateControl,
} from "./helpers/date-control";
import { expectNotForbiddenPage, expectWorkspaceShell, loginAs } from "./helpers/auth";

test.describe("汇率按日期补充", () => {
  test("管理员可校验并提交历史范围，结果和输入保留在弹窗内", async ({
    page,
  }) => {
    await loginAs(page, "administrator");
    await page.setViewportSize({ height: 950, width: 1440 });
    await page.goto("/admin/settings");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    const yesterday = addDays(getShanghaiDate(), -1);
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
    await expect(dialog.getByText(/将检查 1 天、3 个币种，共 3 条日期汇率/))
      .toBeVisible();

    // 32 个含首尾的日历日期必须在浏览器端被拦住，且不清空用户已经填写的范围。
    await fillDateControl(fromDate, toChineseDate(thirtyTwoDayRangeStart));
    await dialog.getByRole("button", { name: "获取并保存" }).click();
    await expect(dialog.getByText("一次最多补充连续 31 天的汇率。"))
      .toBeVisible();
    await expectDateControlValue(fromDate, thirtyTwoDayRangeStart);

    await fillDateControl(fromDate, toChineseDate(yesterday));
    await dialog.getByLabel("币种 1").fill("US");
    await dialog.getByRole("button", { name: "获取并保存" }).click();
    await expect(dialog.getByText("币种代码需要是 3 位字母，例如 USD。"))
      .toBeVisible();
    await expect(dialog.getByLabel("币种 1")).toHaveValue("US");

    // 第二行故意与第一行重复，提交时应自动转成大写并去重。
    await dialog.getByLabel("币种 1").fill("usd");
    await dialog.getByLabel("币种 2").fill("USD");
    await dialog.getByRole("button", { name: "添加币种" }).click();
    await dialog.getByLabel("币种 4").fill("AUD");

    let releaseResponse: () => void = () => undefined;
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    let requestStarted: () => void = () => undefined;
    const requestStartedPromise = new Promise<void>((resolve) => {
      requestStarted = resolve;
    });
    let requestBody: Record<string, unknown> | null = null;

    await page.route("**/functions/v1/exchange-rate-sync", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if (body.trigger !== "historical") {
        await route.continue();
        return;
      }

      requestBody = body;
      requestStarted();
      await responseGate;
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          operationId: "11111111-1111-4111-8111-111111111111",
          operationStatus: "queued",
          failedCount: 1,
          insertedCount: 1,
          skippedCount: 1,
          results: [
            {
              baseCurrency: "USD",
              rate: 7.01,
              rateDate: yesterday,
              status: "inserted",
              targetCurrency: "CNY",
            },
            {
              baseCurrency: "JPY",
              rate: 0.046,
              rateDate: yesterday,
              status: "skipped",
              targetCurrency: "CNY",
            },
            {
              baseCurrency: "AUD",
              message: "这个日期暂时没有可用汇率。",
              rateDate: yesterday,
              status: "failed",
              targetCurrency: "CNY",
            },
          ],
        }),
      });
    });

    await dialog.getByRole("button", { name: "获取并保存" }).click();
    await requestStartedPromise;
    await expect(dialog.getByRole("button", { name: "正在获取" }))
      .toBeDisabled();
    await expect(fromDate).toBeDisabled();
    await expect(dialog.getByLabel("币种 1")).toBeDisabled();

    expect(requestBody).toEqual({
      baseCurrencies: ["USD", "JPY", "AUD"],
      fromDate: yesterday,
      toDate: yesterday,
      trigger: "historical",
    });

    releaseResponse();
    await expect(dialog.getByText("已新增 1 条，跳过已有 1 条，失败 1 条。"))
      .toBeVisible();
    const failures = dialog.getByRole("region", { name: "未能获取的日期" });
    await expect(failures.getByText(`${yesterday} · AUD 暂时没有可用汇率`))
      .toBeVisible();
    await expect(failures).not.toContainText("USD");
    await expect(dialog.getByLabel("币种 1")).toHaveValue("USD");
    await expect(dialog.getByLabel("币种 2")).toHaveValue("JPY");
    await expect(dialog.getByLabel("币种 3")).toHaveValue("AUD");
    await expectDateControlValue(fromDate, yesterday);
    await expectDateControlValue(toDate, yesterday);

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

    // 夹具中的旧日期汇率抓取时间更晚；最新卡仍必须选择今天的 7.18。
    const latestUsdCard = page
      .locator("article:visible")
      .filter({ hasText: "USD/CNY" })
      .first();
    await expect(latestUsdCard).toContainText("7.18");
    await expect(latestUsdCard).not.toContainText("6.99");

    const yesterday = addDays(getShanghaiDate(), -1);
    const desktopHistoryRow = page
      .locator("table:visible tbody tr")
      // 历史获取回归可能留下其他币种记录，这里只定位本用例固定验证的 USD 夹具。
      .filter({ hasText: "按日期补充" })
      .filter({ hasText: "USD" });
    await expect(desktopHistoryRow).toHaveCount(1);
    await expect(desktopHistoryRow).toContainText("USD");
    await expect(desktopHistoryRow).toContainText("6.99");
    await expect(desktopHistoryRow).toContainText(toChineseDate(yesterday));
    await expectNoHorizontalOverflow(page);

    await page.reload();
    await page.setViewportSize({ height: 900, width: 390 });
    const responsiveHistory = page
      .locator('[data-slot="responsive-data-view"]')
      .last();
    await expect(responsiveHistory.locator("table")).toBeHidden();
    const mobileHistoryCard = responsiveHistory
      .locator("article:visible")
      .filter({ hasText: "按日期补充" })
      .filter({ hasText: "USD/CNY" });
    await expect(mobileHistoryCard).toHaveCount(1);
    await expect(mobileHistoryCard).toContainText("USD/CNY");
    await expect(mobileHistoryCard).toContainText("汇率日期");
    await expect(mobileHistoryCard).toContainText(toChineseDate(yesterday));
    await expect(mobileHistoryCard).toContainText("获取方式");
    await expect(mobileHistoryCard.getByRole("button", { name: "编辑" }))
      .toBeVisible();
    await expect(mobileHistoryCard.getByRole("button", { name: "删除" }))
      .toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

function getShanghaiDate() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

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
