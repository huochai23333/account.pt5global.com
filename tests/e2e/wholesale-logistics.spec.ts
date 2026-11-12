import { readFileSync } from "node:fs";
import { expect } from "@playwright/test";
import { test } from "./helpers/logistics-assignment-case";
import {
  expectResponsiveLayout,
  isolateSourceRefresh,
  waitForPagingResponse,
  readRenderedPagingRows,
} from "./helpers/logistics-page-assertions";

import {
  expectForbiddenPage,
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import {
  chooseSelectOption,
  expectSelectValue,
} from "./helpers/select-control";

import {
  assertLogisticsPaging,
  validateLogisticsFixture,
} from "./helpers/logistics-paging-oracle";

test.describe.configure({ mode: "serial" });

// 本文件验收已有档案的查询/归属；外部同步写入由专用同步用例完成，避免本地 cron 重试外发。
test.beforeEach(async ({ page }) => {
  await isolateSourceRefresh(page);
});

test.describe("店小秘物流永久档案", () => {
  test("管理员可筛选业务员、店铺、日期与运费并查看分币种汇总", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/logistics");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
    await expect(page.getByRole("heading", { name: "物流管理" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("最近更新时间")).toBeVisible();

    // 店铺筛选会同时收窄列表和汇总；RMB 必须合入 CNY，USD 仍单独显示。
    const storeFilter = page.getByLabel("店小秘店铺");
    await chooseSelectOption(storeFilter, { label: "Local Shop Alpha" });
    await expectSelectValue(storeFilter, "Local Shop Alpha");
    await expect(page.getByText("第 1-3 条，共 3 条")).toBeVisible();
    const freightSummary = page.locator(
      '[data-slot="dashboard-operational-summary"] [data-summary-tier="secondary"]',
    );
    await expect(
      freightSummary.getByText("国际运费", { exact: true }),
    ).toBeVisible();
    await expect(
      freightSummary.getByText("CNY", { exact: true }),
    ).toBeVisible();
    await expect(
      freightSummary.getByText(/CNY\s*150\.50/).first(),
    ).toBeVisible();
    await expect(
      freightSummary.getByText("USD", { exact: true }),
    ).toBeVisible();
    await expect(
      freightSummary.getByText(/USD\s*20\.00/).first(),
    ).toBeVisible();

    // 搜索使用延迟值，请求完成后只保留目标包裹；更换业务员也会查询完整档案。
    await page.getByLabel("搜索").fill("LOCAL-TRACK-003");
    await expect(page.getByText("第 1-1 条，共 1 条")).toBeVisible();
    await expect(
      page.getByText("LOCAL-PKG-003").filter({ visible: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "恢复默认范围" }).click();
    await chooseSelectOption(page.getByLabel("业务员"), {
      label: "本地协作业务员",
    });
    await expect(
      page.getByText("LOCAL-PKG-004").filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByText("LOCAL-PKG-006").filter({ visible: true }),
    ).toBeVisible();

    // NULL 和 0 都是缺少运费；桌面行和移动卡片都必须有显眼的红色提示。
    await page.getByRole("button", { name: "恢复默认范围" }).click();
    await chooseSelectOption(page.getByLabel("运费记录"), { value: "missing" });
    await expect(page.getByText("第 1-2 条，共 2 条")).toBeVisible();
    const missingDesktopRow = page
      .getByText("LOCAL-PKG-004")
      .filter({ visible: true })
      .locator("xpath=ancestor::tr[1]");
    // 缺少运费使用设计系统的警示表面，不再依赖领域内硬编码色值。
    await expect(missingDesktopRow).toHaveClass(/bg-status-danger-soft/);
    await expect(missingDesktopRow.getByText("缺少运费")).toBeVisible();

    await expectResponsiveLayout(page);
    const missingMobileCard = page
      .getByText("LOCAL-PKG-004")
      .filter({ visible: true })
      .locator("xpath=ancestor::article[1]");
    await expect(missingMobileCard).toHaveClass(/border-status-danger/);
    await expect(missingMobileCard.getByText("缺少运费")).toBeVisible();
  });

  test("管理员可调整店铺历史归属并恢复原设置", async ({ page, storeCase }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/logistics");
    await page.getByRole("button", { name: "店铺归属设置" }).click();
    const dialog = page.getByRole("dialog", { name: "店铺归属设置" });
    await expect(dialog).toBeVisible();

    const alphaHistory = dialog.locator("article").filter({
      hasText: storeCase.storeName,
    });
    await expect(alphaHistory).toContainText("本地业务员");
    await alphaHistory.getByRole("button", { name: "调整" }).click();
    await expectSelectValue(
      dialog.getByLabel("负责业务员"),
      "55555555-5555-4555-8555-555555555555",
    );
    await chooseSelectOption(dialog.getByLabel("负责业务员"), {
      label: "本地协作业务员",
    });
    await chooseSelectOption(dialog.getByLabel("批发客户（可选）"), {
      label: "Wholesale Alpha",
    });
    await dialog.getByRole("button", { name: "保存归属" }).click();
    storeCase.confirm("peer");
    await expect(alphaHistory).toContainText("本地协作业务员");
    await page.reload();
    await page.getByRole("button", { name: "店铺归属设置" }).click();
    await expect(alphaHistory).toContainText("本地协作业务员");
    storeCase.unchanged();

    // 通过原页面恢复本次独占区间的原归属；失败也不影响固定Alpha/其他角色的种子。
    await alphaHistory.getByRole("button", { name: "调整" }).click();
    await chooseSelectOption(dialog.getByLabel("负责业务员"), {
      label: "本地业务员",
    });
    await chooseSelectOption(dialog.getByLabel("批发客户（可选）"), {
      label: "Wholesale Beta",
    });
    await dialog.getByRole("button", { name: "保存归属" }).click();
    storeCase.confirm("initial");
    await expect(alphaHistory).toContainText("本地业务员");
    await page.reload();
    await page.getByRole("button", { name: "店铺归属设置" }).click();
    await expect(alphaHistory).toContainText("本地业务员");
    storeCase.unchanged();
    await expectResponsiveLayout(page);
  });

  test("永久档案每页二十条，翻页保留完整数量", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/logistics");
    // 55条清单来自独立夹具准备，不能从被测分页接口或页面反向生成期望。
    const manifestPath = process.env.PT5_E2E_LOGISTICS_PAGING_FIXTURE;
    if (!manifestPath)
      throw new Error(
        "PT5_E2E_LOGISTICS_PAGING_FIXTURE must point to an independent 55-row synthetic fixture manifest",
      );
    const fixture = validateLogisticsFixture(
      JSON.parse(readFileSync(manifestPath, "utf8")),
    );
    const firstRequest = waitForPagingResponse(page, 1);
    await chooseSelectOption(page.getByLabel("店小秘店铺"), {
      label: "Local Paging Shop",
    });
    await expect(page.getByText("第 1-20 条，共 55 条").first()).toBeVisible();
    const first = await readRenderedPagingRows(page, await firstRequest, 20);
    const secondRequest = waitForPagingResponse(page, 2);
    await page.getByRole("button", { name: "下一页" }).click();
    await expect(page.getByText("第 21-40 条，共 55 条")).toBeVisible();
    const second = await readRenderedPagingRows(page, await secondRequest, 20);
    const thirdRequest = waitForPagingResponse(page, 3);
    await page.getByRole("button", { name: "下一页" }).click();
    await expect(page.getByText("第 41-55 条，共 55 条")).toBeVisible();
    const third = await readRenderedPagingRows(page, await thirdRequest, 15);
    await expect(page.getByRole("button", { name: "下一页" })).toBeDisabled();
    const returnRequest = waitForPagingResponse(page, 2);
    await page.getByRole("button", { name: "上一页" }).click();
    await expect(page.getByText("第 21-40 条，共 55 条")).toBeVisible();
    const returnedSecond = await readRenderedPagingRows(
      page,
      await returnRequest,
      20,
    );
    assertLogisticsPaging(fixture, [first, second, third], returnedSecond);
    await expectResponsiveLayout(page);
  });

  test("业务员和财务都可查看全部物流并设置店铺归属", async ({
    browser,
    trackLogisticsPage,
  }) => {
    const salesmanPage = await browser.newPage({
      viewport: { height: 900, width: 1440 },
    });
    trackLogisticsPage(salesmanPage);
    await isolateSourceRefresh(salesmanPage);
    await loginAs(salesmanPage, "salesman");
    await salesmanPage.goto("/salesman/wholesale/logistics");
    await expectNotForbiddenPage(salesmanPage);
    await expect(
      salesmanPage.getByRole("button", { name: "店铺归属设置" }),
    ).toBeVisible();
    await expect(
      salesmanPage.getByText("LOCAL-PKG-001").filter({ visible: true }),
    ).toBeVisible();
    await chooseSelectOption(salesmanPage.getByLabel("业务员"), {
      value: "all",
    });
    await chooseSelectOption(salesmanPage.getByLabel("店小秘店铺"), {
      label: "Local Shop Peer",
    });
    await expect(
      salesmanPage.getByText("LOCAL-PKG-004").filter({ visible: true }),
    ).toBeVisible();

    const financePage = await browser.newPage({
      viewport: { height: 900, width: 1440 },
    });
    trackLogisticsPage(financePage);
    await isolateSourceRefresh(financePage);
    await loginAs(financePage, "finance");
    await financePage.goto("/finance/wholesale/logistics");
    await expectNotForbiddenPage(financePage);
    await expect(
      financePage.getByRole("button", { name: "店铺归属设置" }),
    ).toBeVisible();
    await chooseSelectOption(financePage.getByLabel("店小秘店铺"), {
      label: "Local Shop Peer",
    });
    await expect(
      financePage.getByText("LOCAL-PKG-004").filter({ visible: true }),
    ).toBeVisible();
    await expectResponsiveLayout(financePage);

    // 两个自建角色上下文由命名夹具收尾；中途失败同样回收。
  });

  for (const [role, path] of [
    ["client", "/client/wholesale/logistics"],
    ["manager", "/manager/wholesale/logistics"],
    ["operator", "/operator/wholesale/logistics"],
    ["promoter", "/promoter/wholesale/logistics"],
  ] as const) {
    test(`${role} 不显示物流入口`, async ({ page }) => {
      await loginAs(page, role);
      await page.goto(path);

      // 经理和推广当前没有启用业务，路由守卫会先把账号带回业务停用说明；
      // 客户和运营仍有可用工作区，因此访问物流页面时应进入权限提示页。
      if (role === "manager" || role === "promoter") {
        await expect(page).toHaveURL(/\/business-unavailable(?:[?#].*)?$/);
        await expect(
          page.getByRole("heading", { name: "当前没有可使用的业务" }),
        ).toBeVisible();
      } else {
        await expectForbiddenPage(page);
      }
    });
  }
});
