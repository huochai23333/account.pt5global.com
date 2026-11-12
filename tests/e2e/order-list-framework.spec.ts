import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import { fillDateControl } from "./helpers/date-control";
import { expandOrderFilters } from "./helpers/order-filter-visibility";

const ORDER_PAGES = [
  "/admin/wholesale/orders",
  "/admin/wholesale/logistics",
] as const;

const DATE_PRESET_LABELS = [
  "最近 30 天",
  "本月",
  "上月",
  "最近 3 个月",
  "自定义",
] as const;

test.describe("批发订单与物流列表统一框架", () => {
  test("两类页面使用同一日期工具条和列表数量底栏", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");

    for (const path of ORDER_PAGES) {
      await page.goto(path);
      await expandOrderFilters(page);
      await expectWorkspaceShell(page);
      await expectNotForbiddenPage(page);

      const dateToolbar = page.getByRole("group", { name: "日期快捷范围" });
      await expect(dateToolbar).toBeVisible();
      await expect(dateToolbar.getByRole("button")).toHaveCount(5);
      expect(await dateToolbar.getByRole("button").allTextContents()).toEqual(
        DATE_PRESET_LABELS,
      );
      await expect(
        dateToolbar.getByRole("button", { name: "最近 30 天" }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        page.getByRole("button", { name: "恢复默认范围" }),
      ).toBeDisabled();

      // 列表加载进度只在统一底栏出现一次，标题区域不再重复显示。
      const progress = getOrderListProgress(page);
      await expect(progress).toHaveCount(1);
      await expect(progress).toBeVisible();
      await expectNoDocumentHorizontalOverflow(page);
    }
  });

  test("桌面端左计数右操作，移动端改为上下排列", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");

    const desktopProgress = getOrderListProgress(page);
    const loadMore = page.getByRole("button", { name: "下一页" });
    await expect(desktopProgress).toBeVisible();
    await expect(loadMore).toBeVisible();
    await expectLeftOf(desktopProgress, loadMore);

    await page.setViewportSize({ height: 844, width: 390 });
    await expectNoDocumentHorizontalOverflow(page);
    await expectAbove(desktopProgress, loadMore);
  });

  test("日期快捷范围可恢复默认值并识别自定义范围", async ({ page }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");
    await expandOrderFilters(page);

    const dateToolbar = page.getByRole("group", { name: "日期快捷范围" });
    const reset = page.getByRole("button", { name: "恢复默认范围" });
    const startDate = page.getByLabel("下单日期从");

    // 月末时“本月”可能刚好等于“最近 30 天”，选择上月才能稳定验证切换。
    await dateToolbar.getByRole("button", { name: "上月" }).click();
    await expect(
      dateToolbar.getByRole("button", { name: "上月" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(reset).toBeEnabled();

    await reset.click();
    await expect(
      dateToolbar.getByRole("button", { name: "最近 30 天" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(reset).toBeDisabled();

    // 输入不属于快捷项的完整日期范围时，工具条应自动标记为“自定义”。
    await fillDateControl(startDate, "2026-05-02");
    await fillDateControl(page.getByLabel("下单日期到"), "2026-05-03");
    await expect(
      dateToolbar.getByRole("button", { name: "自定义" }),
    ).toHaveAttribute("aria-pressed", "true");

    await dateToolbar.getByRole("button", { name: "自定义" }).click();
    await expect(startDate).toBeFocused();
  });

  test("页码列表末页保留计数并禁用下一页", async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");

    const progress = getOrderListProgress(page);
    const loadMore = page.getByRole("button", { name: "下一页" });
    await expect(progress).toBeVisible();

    // 加载中也会禁用按钮；必须等分页空闲且当前页等于总页数，才能把禁用视作末页。
    await reachLastOrderListPage(page);

    await expect(loadMore).toBeDisabled();
    await expect(progress).toBeVisible();
    await expect(progress).toHaveCount(1);
  });

});

function getOrderListProgress(page: Page) {
  return page.getByText(/^第 \d+-\d+ 条，共 \d+ 条$/);
}

/** 只读翻页最多推进十次；等待真实分页就绪，不把暂时不可点击当作已经走到末页。 */
async function reachLastOrderListPage(page: Page) {
  const pagination = page.getByRole("navigation", { name: "列表分页", exact: true });
  const nextPage = pagination.getByRole("button", { name: "下一页", exact: true });
  const pageLabel = pagination.locator("p");
  const progress = getOrderListProgress(page);
  for (let step = 0; step <= 10; step += 1) {
    await expect(pagination).toHaveAttribute("aria-busy", "false");
    await expect(pageLabel).toHaveText(/^第 \d+ 页，共 \d+ 页$/);
    const match = /^第 (\d+) 页，共 (\d+) 页$/.exec((await pageLabel.textContent()) ?? "");
    expect(match).not.toBeNull();
    const currentPage = Number(match![1]);
    const pageCount = Number(match![2]);
    expect(currentPage).toBeGreaterThanOrEqual(1);
    expect(pageCount).toBeGreaterThanOrEqual(currentPage);
    if (currentPage === pageCount) {
      // 页码、范围计数和按钮共同证明终态；网络错误留下的旧列表不能仅凭按钮通过。
      const range = /^第 (\d+)-(\d+) 条，共 (\d+) 条$/.exec((await progress.textContent()) ?? "");
      expect(range).not.toBeNull();
      expect(Number(range![2])).toBe(Number(range![3]));
      await expect(nextPage).toBeDisabled();
      return;
    }
    expect(step, "本次种子超过十次翻页上限，请准备更小的专属数据").toBeLessThan(10);
    await expect(nextPage).toBeEnabled();
    const previousProgress = await progress.textContent();
    await nextPage.click();
    await expect(pageLabel).toHaveText(`第 ${currentPage + 1} 页，共 ${pageCount} 页`);
    await expect(progress).not.toHaveText(previousProgress ?? "");
  }
}

async function expectLeftOf(left: Locator, right: Locator) {
  const [leftBox, rightBox] = await Promise.all([
    left.boundingBox(),
    right.boundingBox(),
  ]);
  expect(leftBox).not.toBeNull();
  expect(rightBox).not.toBeNull();
  expect(leftBox!.x).toBeLessThan(rightBox!.x);
}

async function expectAbove(top: Locator, bottom: Locator) {
  const [topBox, bottomBox] = await Promise.all([
    top.boundingBox(),
    bottom.boundingBox(),
  ]);
  expect(topBox).not.toBeNull();
  expect(bottomBox).not.toBeNull();
  expect(topBox!.y + topBox!.height).toBeLessThanOrEqual(bottomBox!.y);
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}
