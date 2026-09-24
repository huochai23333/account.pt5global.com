import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { loginAs } from "./helpers/auth";
import { fillDateControl } from "./helpers/date-control";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";
import { chooseSelectOption } from "./helpers/select-control";
import { cleanupRateFixtures, ensureLocalUsdRate } from "./helpers/wholesale-settlement-fixtures";

const SALESMAN_CODE = "wholesale_order_salesman_tier";
const MONTHLY_CODE = "wholesale_referral_waybill_bonus";

test.describe("批发业务参数版本与订单", () => {
  test("页面创建的新旧订单锁定各自版本，旧订单结汇仍使用原版本", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const admin = requireLocalAdminClient();
    // 新旧订单同日结汇需要当天精确汇率；仅清理本次插入的测试报价。
    const createdRateId = await ensureLocalUsdRate(shanghaiDate());
    const firstNote = `参数版本旧单 ${Date.now()}`;
    const secondNote = `参数版本新单 ${Date.now()}`;
    await resetParameter(admin, SALESMAN_CODE);

    const adminContext = await browser.newContext();
    const salesmanContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const salesmanPage = await salesmanContext.newPage();

    try {
      await loginAs(adminPage, "administrator");
      const version2 = await publishSalesmanTier(adminPage, {
        reason: "旧订单锁定版本回归",
        tier1Rate: "11",
        tier2Rate: "13",
      });

      await loginAs(salesmanPage, "salesman");
      await createWholesaleOrder(salesmanPage, firstNote);
      const firstOrder = await readOrderByNote(admin, firstNote);
      expect(firstOrder.salesman_commission_parameter_version_id).toBe(
        version2.id,
      );

      const version3 = await publishSalesmanTier(adminPage, {
        reason: "新订单锁定版本回归",
        tier1Rate: "20",
        tier2Rate: "30",
      });
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
      await deleteOrdersByNotes(admin, [firstNote, secondNote]);
      await resetParameter(admin, SALESMAN_CODE);
      if (createdRateId) await cleanupRateFixtures([createdRateId]);
      await adminContext.close();
      await salesmanContext.close();
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

async function publishSalesmanTier(
  page: Page,
  input: { reason: string; tier1Rate: string; tier2Rate: string },
) {
  await page.goto("/admin/wholesale/settings");
  const row = page.getByTestId(`business-parameter-row-${SALESMAN_CODE}`);
  await row.getByRole("button", { name: "修改" }).click();
  const dialog = page.getByRole("dialog", { name: /修改批发订单业务员佣金/ });
  await dialog
    .getByTestId("business-parameter-input-tier_1_rate")
    .fill(input.tier1Rate);
  await dialog
    .getByTestId("business-parameter-input-tier_2_rate")
    .fill(input.tier2Rate);
  await dialog
    .getByTestId("business-parameter-change-reason")
    .fill(input.reason);
  await dialog.getByTestId("business-parameter-review-publish").click();
  await page
    .getByRole("dialog", { name: "确认发布这次修改？" })
    .getByRole("button", { name: "确认发布" })
    .click();
  await expect(page.getByText(/已发布第 [23] 版/)).toBeVisible();
  return readLatestVersion(requireLocalAdminClient(), SALESMAN_CODE);
}

async function createWholesaleOrder(page: Page, note: string) {
  await page.goto("/salesman/wholesale/orders");
  await page.getByRole("button", { name: "新建订单" }).click();
  const dialog = page.getByRole("dialog", { name: "新建批发订单" });
  await chooseSelectOption(dialog.getByLabel("客户名"), {
    label: "Wholesale Alpha",
  });
  await chooseSelectOption(dialog.getByLabel("关联业务员"), {
    label: "本地业务员",
  });
  await dialog.getByLabel("小单数量").fill("1");
  await dialog.getByLabel("产品采购金额").fill("100");
  await dialog.getByLabel("国际运费").fill("20");
  await dialog.getByLabel("其他费用").fill("0");
  await dialog.getByLabel("推荐佣金费用").fill("0");
  await dialog.getByLabel("快递公司").fill("DHL");
  await chooseSelectOption(dialog.getByLabel("客户支付币种"), { value: "USD" });
  await dialog.getByLabel("客户支付金额").fill("200");
  await chooseSelectOption(dialog.getByLabel("收款平台"), { label: "Wise" });
  await fillDateControl(dialog.getByLabel("订单计入月份"), shanghaiDate().slice(0, 7));
  await dialog.getByLabel("备注").fill(note);
  await dialog.getByRole("button", { name: "保存订单" }).click();
  await expect(page.getByText("批发订单已保存。")).toBeVisible();
}

async function settleOrderFromPage(page: Page, note: string) {
  await page.goto("/admin/wholesale/orders");
  await page.getByLabel("搜索订单").fill(note);
  // 备注属于完整字段；展开后再用该唯一备注定位新建的订单。
  await page.getByRole("button", { name: "查看全部字段" }).click();
  const row = page.getByRole("row").filter({ hasText: note });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "登记结汇" }).click();
  const dialog = page.getByRole("dialog", { name: "确认结汇" });
  await dialog.getByLabel("本次结汇金额").fill("200");
  await fillDateControl(dialog.getByLabel("结汇日期"), shanghaiDate());
  await dialog.getByRole("button", { name: "保存结汇记录" }).click();
  await expect(page.getByText("结汇记录已保存。")).toBeVisible();
}

function requireLocalAdminClient() {
  const admin = getLocalSupabaseAdminClient();
  test.skip(!admin, "必须连接本地 Docker Supabase 才能核对订单版本凭证。");
  if (!admin) throw new Error("local_supabase_admin_required");
  return admin;
}

async function readLatestVersion(admin: SupabaseClient, code: string) {
  const { data, error } = await admin
    .from("business_parameter_versions")
    .select("id,version_number")
    .eq("parameter_code", code)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data as { id: string; version_number: number };
}

async function readOrderByNote(admin: SupabaseClient, note: string) {
  const { data, error } = await admin
    .from("wholesale_orders")
    .select("id,salesman_commission_parameter_version_id,commission_rate")
    .eq("notes", note)
    .single();
  if (error) throw error;
  return data as {
    commission_rate: number | null;
    id: string;
    salesman_commission_parameter_version_id: string;
  };
}

async function deleteOrdersByNotes(admin: SupabaseClient, notes: string[]) {
  const { error } = await admin.from("wholesale_orders").delete().in("notes", notes);
  if (error) throw error;
}

async function resetParameter(admin: SupabaseClient, code: string) {
  const { error: deleteError } = await admin
    .from("business_parameter_versions")
    .delete()
    .eq("parameter_code", code)
    .gt("version_number", 1);
  if (deleteError) throw deleteError;
  const { error: updateError } = await admin
    .from("business_parameter_definitions")
    .update({ current_revision: 1 })
    .eq("parameter_code", code);
  if (updateError) throw updateError;
}

function shanghaiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(new Date());
}

function nextShanghaiMonthStartLocal() {
  const now = new Date();
  const shanghai = new Date(
    new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "Asia/Shanghai",
      year: "numeric",
    }).format(now),
  );
  shanghai.setMonth(shanghai.getMonth() + 1, 1);
  return `${shanghai.toISOString().slice(0, 7)}-01T00:00`;
}
