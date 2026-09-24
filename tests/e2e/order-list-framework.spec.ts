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
  "/admin/wholesale/order-claims",
  "/admin/wholesale/logistics",
] as const;

const DATE_PRESET_LABELS = [
  "最近 30 天",
  "本月",
  "上月",
  "最近 3 个月",
  "自定义",
] as const;

test.describe("三类批发订单列表统一框架", () => {
  test("三类页面使用同一日期工具条和列表数量底栏", async ({ page }) => {
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
    const loadMore = page.getByRole("button", { name: "继续加载" });
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

    await dateToolbar.getByRole("button", { name: "本月" }).click();
    await expect(
      dateToolbar.getByRole("button", { name: "本月" }),
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

  test("游标列表最后一页保留计数并隐藏继续加载", async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");

    const progress = getOrderListProgress(page);
    const loadMore = page.getByRole("button", { name: "继续加载" });
    await expect(progress).toBeVisible();

    // 本地种子数量可能调整，因此设置安全上限，并以按钮消失作为到达末页的信号。
    for (let batch = 0; batch < 10 && (await loadMore.isVisible()); batch += 1) {
      const previousProgress = await progress.textContent();
      await loadMore.click();
      // 必须等当前批次真正写入列表，避免下一轮在按钮的加载禁用状态下重复点击。
      await expect(progress).not.toHaveText(previousProgress ?? "");
    }

    await expect(loadMore).toHaveCount(0);
    await expect(progress).toBeVisible();
    await expect(progress).toHaveCount(1);
  });

  test("认领看板使用正确单位并只显示一条精确查询提示", async ({ page }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/order-claims");

    await page.getByRole("button", { name: /认领大厅/ }).click();
    await expect(getOrderListProgress(page)).toContainText("笔 1688 订单");

    await page.getByRole("button", { name: /已认领/ }).click();
    await expect(getOrderListProgress(page)).toContainText("个认领组");

    const search = page.getByLabel("搜索采购订单");
    await search.fill("1688-LOCAL-001");
    await page.getByRole("button", { name: "跨日期查此单号" }).click();
    await expect(
      page.getByText("全历史精确查询：1688-LOCAL-001", { exact: true }),
    ).toHaveCount(1);

    await page.getByRole("button", { name: "退出全历史查询" }).click();
    await expect(
      page.getByText("全历史精确查询：1688-LOCAL-001", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("group", { name: "日期快捷范围" })
        .getByRole("button", { name: "最近 30 天" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

function getOrderListProgress(page: Page) {
  return page.getByText(/^已显示 \d+(?:–\d+)? \/ \d+ /);
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
