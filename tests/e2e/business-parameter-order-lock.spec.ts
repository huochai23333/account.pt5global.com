import { requireDisposableFixture } from "../test-support/disposable-fixture";
import { expect, test, type BrowserContext } from "@playwright/test";

import { loginAs } from "./helpers/auth";
import { cleanupRateFixtures, ensureLocalUsdRate } from "./helpers/wholesale-settlement-fixtures";

import { readOrderByNote, deleteOrdersByNotes, readLatestVersion, requireLocalAdminClient, resetParameter } from "./helpers/business-parameter-data";
import { publishSalesmanTier, createWholesaleOrder, settleOrderFromPage } from "./helpers/business-parameter-order-page";
import { shanghaiDate, nextShanghaiMonthStartLocal } from "../test-support/shanghai-calendar";

const SALESMAN_CODE = "wholesale_salesman_customer_commission";
const MONTHLY_CODE = "wholesale_referral_waybill_bonus";

// 在任何准备/清理 hook 前拒绝默认共享环境；专用声明仍需实际夹具隔离。
test.beforeAll(async ({ baseURL }) => {
  requireDisposableFixture({ baseURL, supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL, mode: process.env.PT5_E2E_FIXTURE_MODE });
});

test.describe("批发业务参数版本与订单", () => {
  test("页面创建的新旧订单锁定各自版本，旧订单结汇仍使用原版本", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const admin = requireLocalAdminClient();
    // 新旧订单同日结汇需要当天精确汇率；仅清理本次插入的测试报价。
    let createdRateId: string | null = null;
    const firstNote = `参数版本旧单 ${Date.now()}`;
    const secondNote = `参数版本新单 ${Date.now()}`;
    let adminContext: BrowserContext | undefined;
    let salesmanContext: BrowserContext | undefined;

    try {
      // 从准备阶段开始收尾保护，第二个上下文或页面创建失败也能关闭已取得的资源。
      createdRateId = await ensureLocalUsdRate(shanghaiDate());
      await resetParameter(admin, SALESMAN_CODE);
      adminContext = await browser.newContext();
      salesmanContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      const salesmanPage = await salesmanContext.newPage();
      await loginAs(adminPage, "administrator");
      await publishSalesmanTier(adminPage, {
        reason: "旧订单锁定版本回归",
        tier1Rate: "11",
        tier2Rate: "13",
      });
      const version2 = await readLatestVersion(admin, SALESMAN_CODE);

      await loginAs(salesmanPage, "salesman");
      await createWholesaleOrder(salesmanPage, firstNote);
      const firstOrder = await readOrderByNote(admin, firstNote);
      expect(firstOrder.salesman_commission_parameter_version_id).toBe(
        version2.id,
      );

      await publishSalesmanTier(adminPage, {
        reason: "新订单锁定版本回归",
        tier1Rate: "20",
        tier2Rate: "30",
      });
      const version3 = await readLatestVersion(admin, SALESMAN_CODE);
      await createWholesaleOrder(salesmanPage, secondNote);
      const secondOrder = await readOrderByNote(admin, secondNote);
      expect(secondOrder.salesman_commission_parameter_version_id).toBe(
        version3.id,
      );

      await settleOrderFromPage(adminPage, firstNote);
      await expect
        .poll(async () => {
          const refreshed = await readOrderByNote(admin, firstNote);
          return {
            commissionRate: Number(refreshed.commission_rate),
            versionId: refreshed.salesman_commission_parameter_version_id,
          };
        })
        .toEqual({ commissionRate: 0.11, versionId: version2.id });

      console.log(
        "[订单锁定凭证]",
        JSON.stringify({
          newOrderId: secondOrder.id,
          newOrderVersionId: secondOrder.salesman_commission_parameter_version_id,
          oldOrderId: firstOrder.id,
          oldOrderVersionId: firstOrder.salesman_commission_parameter_version_id,
          oldOrderRateAfterSettlement: 0.11,
        }),
      );
    } finally {
      try {
        await deleteOrdersByNotes(admin, [firstNote, secondNote]);
        await resetParameter(admin, SALESMAN_CODE);
        if (createdRateId) await cleanupRateFixtures([createdRateId]);
      } finally {
        // 数据清理失败仍释放浏览器，清理错误继续向测试报告传播。
        await Promise.all([adminContext?.close(), salesmanContext?.close()]);
      }
    }
  });

  test("月度运单奖励页面只允许预约到下一个上海自然月", async ({ page }) => {
    const admin = requireLocalAdminClient();
    await resetParameter(admin, MONTHLY_CODE);
    await loginAs(page, "administrator");

    try {
      await page.goto("/admin/wholesale/settings");
      await page
        .getByTestId(`business-parameter-row-${MONTHLY_CODE}`)
        .getByRole("button", { name: "修改" })
        .click();
      const dialog = page.getByRole("dialog", { name: /修改批发推荐月运单奖励/ });
      await expect(dialog.getByLabel("发布后立即使用")).toHaveCount(0);
      // 月度规则没有可切换的生效方式，只展示固定的下月预约说明和时间。
      await expect(
        dialog.getByText("月度运单奖励按上海自然月计算，只能预约到下一个月的第一天。"),
      ).toBeVisible();
      await expect(
        dialog.getByTestId("business-parameter-effective-time"),
      ).toHaveAttribute("data-value", nextShanghaiMonthStartLocal());
    } finally {
      await resetParameter(admin, MONTHLY_CODE);
    }
  });
});
