import { expect, test, type Page } from "@playwright/test";

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

test.describe.configure({ mode: "serial" });

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
    await expect(page.getByText("已显示 3 / 3 笔")).toBeVisible();
    const freightSummary = page.locator(
      '[data-slot="dashboard-operational-summary"] [data-summary-tier="secondary"]',
    );
    await expect(freightSummary.getByText("国际运费", { exact: true })).toBeVisible();
    await expect(freightSummary.getByText("CNY", { exact: true })).toBeVisible();
    await expect(freightSummary.getByText(/CNY\s*150\.50/).first()).toBeVisible();
    await expect(freightSummary.getByText("USD", { exact: true })).toBeVisible();
    await expect(freightSummary.getByText(/USD\s*20\.00/).first()).toBeVisible();

    // 搜索使用延迟值，请求完成后只保留目标包裹；更换业务员也会查询完整档案。
    await page.getByLabel("搜索").fill("LOCAL-TRACK-003");
    await expect(page.getByText("已显示 1 / 1 笔")).toBeVisible();
    await expect(page.getByText("LOCAL-PKG-003").filter({ visible: true })).toBeVisible();
    await page.getByRole("button", { name: "恢复默认范围" }).click();
    await chooseSelectOption(page.getByLabel("业务员"), {
      label: "本地协作业务员",
    });
    await expect(page.getByText("LOCAL-PKG-004").filter({ visible: true })).toBeVisible();
    await expect(page.getByText("LOCAL-PKG-006").filter({ visible: true })).toBeVisible();

    // NULL 和 0 都是缺少运费；桌面行和移动卡片都必须有显眼的红色提示。
    await page.getByRole("button", { name: "恢复默认范围" }).click();
    await chooseSelectOption(page.getByLabel("运费记录"), { value: "missing" });
    await expect(page.getByText("已显示 2 / 2 笔")).toBeVisible();
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

  test("管理员可调整店铺历史归属并恢复原设置", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/logistics");
    await page.getByRole("button", { name: "店铺归属设置" }).click();
    const dialog = page.getByRole("dialog", { name: "店铺归属设置" });
    await expect(dialog).toBeVisible();

    const alphaHistory = dialog.locator("article").filter({
      hasText: "Local Shop Alpha",
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
    await expect(alphaHistory).toContainText("本地协作业务员");

    // 测试结束前恢复固定种子归属，保证本用例可重复执行且不影响后续角色测试。
    await alphaHistory.getByRole("button", { name: "调整" }).click();
    await chooseSelectOption(dialog.getByLabel("负责业务员"), {
      label: "本地业务员",
    });
    await chooseSelectOption(dialog.getByLabel("批发客户（可选）"), {
      label: "Wholesale Beta",
    });
    await dialog.getByRole("button", { name: "保存归属" }).click();
    await expect(alphaHistory).toContainText("本地业务员");
    await expectResponsiveLayout(page);
  });

  test("永久档案每页 50 条并可稳定继续加载", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/logistics");
    await chooseSelectOption(page.getByLabel("店小秘店铺"), {
      label: "Local Paging Shop",
    });
    await expect(page.getByText("已显示 50 / 55 笔").first()).toBeVisible();
    await page.getByRole("button", { name: "继续加载" }).click();
    await expect(page.getByText("已显示 55 / 55 笔")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(55);
    await expectResponsiveLayout(page);
  });

  test("业务员和财务都可查看全部物流并设置店铺归属", async ({ browser }) => {
    const salesmanPage = await browser.newPage({
      viewport: { height: 900, width: 1440 },
    });
    await loginAs(salesmanPage, "salesman");
    await salesmanPage.goto("/salesman/wholesale/logistics");
    await expectNotForbiddenPage(salesmanPage);
    await expect(
      salesmanPage.getByRole("button", { name: "店铺归属设置" }),
    ).toBeVisible();
    await expect(
      salesmanPage.getByText("LOCAL-PKG-001").filter({ visible: true }),
    ).toBeVisible();
    await chooseSelectOption(salesmanPage.getByLabel("业务员"), { value: "all" });
    await chooseSelectOption(salesmanPage.getByLabel("店小秘店铺"), {
      label: "Local Shop Peer",
    });
    await expect(
      salesmanPage.getByText("LOCAL-PKG-004").filter({ visible: true }),
    ).toBeVisible();

    const financePage = await browser.newPage({
      viewport: { height: 900, width: 1440 },
    });
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

    await salesmanPage.close();
    await financePage.close();
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

async function expectResponsiveLayout(page: Page) {
  await expectNoDocumentHorizontalOverflow(page);
  await expectNoCompressedText(page);
  await page.setViewportSize({ height: 844, width: 390 });
  await expectNoDocumentHorizontalOverflow(page);
  await expectNoCompressedText(page);
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflowPixels).toBeLessThanOrEqual(2);
}

async function expectNoCompressedText(page: Page) {
  const compressedText = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>("button, label, th, td, dt, dd"),
    );
    return candidates
      .filter((element) => {
        const text = element.innerText.trim();
        const rect = element.getBoundingClientRect();
        if (!text || rect.width === 0 || rect.height === 0) return false;
        // 正常换行允许两三行；极窄且高度远大于宽度通常表示中文被挤成竖排。
        return rect.width < 24 && rect.height > 48 && rect.height > rect.width * 2.5;
      })
      .map((element) => element.innerText.trim())
      .slice(0, 5);
  });
  expect(compressedText).toEqual([]);
}
