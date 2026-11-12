import { createBocRecalculationCohort } from "../test-support/boc-recalculation-cohort";
import { runLocalSupabaseSql } from "./helpers/local-supabase";
import { finalizeBocRecalculationCohort } from "./helpers/boc-recalculation-lifecycle";
import { registerBocManualRateCase } from "./helpers/boc-manual-rate-page";
import { requestRecalculationPreview } from "./helpers/recalculation-preview-response";
import { expect } from "@playwright/test";
import { finishBocSuite, test } from "./helpers/boc-suite-fixture";
import { assertBocSdkOrigin } from "./helpers/boc-suite-guard";
import { loginAs } from "./helpers/auth";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";
import { chooseSelectOption } from "./helpers/select-control";
import { fillDateControl } from "./helpers/date-control";
import {
  companyExchangeRate,
  multiplyRoundedDecimal,
} from "../../lib/company-exchange-rate";

test.describe.serial("中行买入汇率业务核验", () => {
  test.setTimeout(180_000);
  test.use({ serviceWorkers: "block" });
  test.beforeAll(({ bocSuite }) => bocSuite.job.prepare());
  test.afterAll(({ bocSuite }, info) => finishBocSuite(bocSuite, info));

  test("页面获取当日报价，独立数据库核对编号、时间及刷新一致", async ({
    page,
  }, testInfo) => {
    const admin = getLocalSupabaseAdminClient();
    expect(admin).not.toBeNull();
    assertBocSdkOrigin(admin);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await loginAs(page, "administrator");
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "立即获取", exact: true }).click();
    await expect(page.getByText("已获取 1 个币种的当日汇率。")).toBeVisible({
      timeout: 60_000,
    });
    const today = new Date(Date.now() + 28_800_000).toISOString().slice(0, 10);
    const { data: quote, error } = await admin!
      .from("exchange_rate")
      .select("*")
      .eq("original_currency", "USD")
      .eq("rate_date", today)
      .single();
    expect(error).toBeNull();
    expect(quote.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(quote.bank_code).toBe("BOC");
    expect(quote.source).toBe("nowapi");
    expect(Number(quote.daily_exchange_rate)).toBe(
      Number(multiplyRoundedDecimal(String(quote.bank_quote), "0.01", 8)),
    );
    expect(quote.provider_updated_at).toBeTruthy();
    const rate = String(companyExchangeRate("USD", quote.daily_exchange_rate));
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "最新汇率", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(rate, { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "生成核算预览", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: testInfo.outputPath("boc-exchange-desktop.png"),
    });
    await page
      .getByRole("heading", { name: "历史记录", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("boc-history-desktop.png"),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(2);
    await page
      .getByRole("heading", { name: "最新汇率", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("boc-exchange-mobile.png"),
    });
    await page
      .getByRole("heading", { name: "历史记录", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("boc-history-mobile.png"),
    });
    expect(errors).toEqual([]);
    await expect(
      page
        .locator("nextjs-portal")
        .getByText(
          /Unhandled Runtime Error|Application error|Hydration failed/,
        ),
    ).toHaveCount(0);
    expect(multiplyRoundedDecimal("100", rate, 2)).toBe(
      (Number(rate) * 100).toFixed(2),
    );
  });

  registerBocManualRateCase();
  test("页面结汇并重算，凭证与独立数据库查询一致；错误成功回包被拒绝", async ({
    page,
  }, testInfo) => {
    const admin = getLocalSupabaseAdminClient()!;
    assertBocSdkOrigin(admin);
    const cohort = createBocRecalculationCohort(runLocalSupabaseSql);
    const note = cohort.note;
    let failure: { error: unknown } | undefined;
    try {
      cohort.prepare();
      await loginAs(page, "administrator");
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/admin/wholesale/orders");
      await page.getByRole("button", { name: "新建订单", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "新建批发订单" });
      await chooseSelectOption(dialog.getByLabel("客户名"), {
        label: "Wholesale Alpha",
      });
      await dialog.getByLabel("小单数量").fill("1");
      await dialog.getByLabel("产品采购金额").fill("10");
      await dialog.getByLabel("国际运费").fill("1");
      await dialog.getByLabel("其他费用").fill("0");
      await dialog.getByLabel("推荐佣金费用").fill("0");
      await dialog.getByLabel("快递公司").fill("DHL");
      await chooseSelectOption(dialog.getByLabel("客户支付币种"), {
        value: "USD",
      });
      await dialog.getByLabel("客户支付金额").fill("300");
      await chooseSelectOption(dialog.getByLabel("收款平台"), {
        label: "Wise",
      });
      const today = new Date(Date.now() + 28_800_000)
        .toISOString()
        .slice(0, 10);
      await fillDateControl(
        dialog.getByLabel("订单计入月份"),
        today.slice(0, 7),
      );
      await dialog.getByLabel("备注").fill(note);
      await dialog
        .getByRole("button", { name: "保存订单", exact: true })
        .click();
      await expect(dialog).toHaveCount(0);
      await page.getByLabel("搜索订单").fill(note);
      await page.getByRole("button", { name: "查看全部字段" }).click();
      const row = page.locator('[data-testid^="wholesale-order-row-"]');
      await expect(row).toHaveCount(1);
      await row.getByRole("button", { name: "登记结汇", exact: true }).click();
      const settlementDialog = page.getByRole("dialog", { name: "确认结汇" });
      await settlementDialog.getByLabel("本次结汇金额").fill("100");
      await settlementDialog
        .getByRole("button", { name: "保存结汇记录", exact: true })
        .click();
      await expect(settlementDialog).toHaveCount(0);
      const { data: order } = await admin
        .from("wholesale_orders")
        .select("*")
        .eq("notes", note)
        .single();
      expect(order?.id).toBeTruthy();
      const { data: settlement, error } = await admin
        .from("wholesale_order_settlements")
        .select("*")
        .eq("order_id", order.id)
        .single();
      expect(error).toBeNull();
      expect(settlement.exchange_rate_id).toBeTruthy();
      const rate = companyExchangeRate("USD", settlement.buying_exchange_rate)!;
      expect(Number(settlement.settlement_exchange_rate)).toBe(rate);
      expect(Number(settlement.settlement_rmb_amount)).toBe(
        Number(multiplyRoundedDecimal("100", String(rate), 2)),
      );
      await page.reload();
      await page.getByLabel("搜索订单").fill(note);
      await page
        .getByRole("button", { name: "查看全部字段", exact: true })
        .click();
      await expect(
        page.getByTestId(`wholesale-order-row-${order.id}`),
      ).toContainText("已结 US$100.00");

      cohort.settled(order.id, settlement.id);
      cohort.unchanged();
      await page.goto("/admin/settings");
      const runId = await requestRecalculationPreview(page, () =>
        page.getByRole("button", { name: "生成核算预览", exact: true }).click(),
      );
      await expect(
        page.getByText("预览已保存，请核对逐笔金额。", { exact: true }),
      ).toBeVisible({ timeout: 60_000 });
      const { data: run, error: runError } = await admin
        .from("exchange_rate_recalculation_runs")
        .select("*")
        .eq("id", runId)
        .single();
      expect(runError).toBeNull();
      expect(run?.id).toBeTruthy();
      const { data: previewItem } = await admin
        .from("exchange_rate_recalculation_items")
        .select("*")
        .eq("run_id", run.id)
        .eq("order_id", order.id)
        .single();
      expect(previewItem?.status).toBe("ready");
      cohort.preview(runId);
      expect(
        Number(previewItem.after_snapshot.settlements[0].settlement_rmb_amount),
      ).toBe(Number(settlement.settlement_rmb_amount));
      await page
        .getByRole("button", { name: "执行这份预览", exact: true })
        .click();
      await expect(
        page.getByText(
          /核算完成，结果已核对并保存。|部分完成，请检查未完成订单。|本次核算未完成，请检查明细。/,
        ),
      ).toBeVisible({ timeout: 60_000 });
      const { data: finished } = await admin
        .from("exchange_rate_recalculation_runs")
        .select("*")
        .eq("id", run.id)
        .single();
      const { data: applied } = await admin
        .from("exchange_rate_recalculation_items")
        .select("*")
        .eq("id", previewItem.id)
        .single();
      expect(["succeeded", "partial_failed"]).toContain(finished.status);
      expect(Number(finished.proof.affectedRows)).toBeGreaterThan(0);
      expect(applied.status).toBe("succeeded");
      expect(applied.after_snapshot.settlements[0].id).toBe(settlement.id);
      // 凭证快照之外，再通过管理员连接独立核对真正的业务表。
      const { data: actualSettlement } = await admin
        .from("wholesale_order_settlements")
        .select("*")
        .eq("id", settlement.id)
        .single();
      const { data: actualOrder } = await admin
        .from("wholesale_orders")
        .select("*")
        .eq("id", order.id)
        .single();
      const { data: actualCommissions } = await admin
        .from("wholesale_commissions")
        .select("*")
        .eq("order_id", order.id);
      expect(actualSettlement).toMatchObject({
        id: settlement.id,
        exchange_rate_id:
          applied.after_snapshot.settlements[0].exchange_rate_id,
      });
      expect(Number(actualSettlement?.settlement_rmb_amount)).toBe(
        Number(applied.after_snapshot.settlements[0].settlement_rmb_amount),
      );
      expect(Number(actualSettlement?.settlement_exchange_rate)).toBe(
        Number(applied.after_snapshot.settlements[0].settlement_exchange_rate),
      );
      expect(Number(actualOrder?.customer_payment_rmb_amount)).toBe(
        Number(applied.after_snapshot.order.customer_payment_rmb_amount),
      );
      expect(Number(actualOrder?.gross_profit)).toBe(
        Number(applied.after_snapshot.order.gross_profit),
      );
      expect(actualOrder?.salesman_commission_parameter_version_id).toBe(
        applied.after_snapshot.order.salesman_commission_parameter_version_id,
      );
      expect(actualCommissions?.map((item) => item.id)).toEqual(
        applied.after_snapshot.commissions.map(
          (item: { id: string }) => item.id,
        ),
      );
      for (const item of actualCommissions ?? []) {
        expect(Number(item.commission_amount_rmb)).toBe(
          Number(
            applied.after_snapshot.commissions.find(
              (record: { id: string }) => record.id === item.id,
            ).commission_amount_rmb,
          ),
        );
      }
      cohort.applied(runId);
      await page.reload();
      await expect(
        page.getByText(`核算凭证：${run.id}`, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(
          finished.status === "succeeded"
            ? "核算完成，结果已核对并保存。"
            : "部分完成，请检查未完成订单。",
          { exact: true },
        ),
      ).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(2);

      const nextId = await requestRecalculationPreview(page, () =>
        page.getByRole("button", { name: "生成核算预览", exact: true }).click(),
      );
      await expect(
        page.getByText("预览已保存，请核对逐笔金额。", { exact: true }),
      ).toBeVisible({ timeout: 60_000 });
      const { data: next, error: nextError } = await admin
        .from("exchange_rate_recalculation_runs")
        .select("*")
        .eq("id", nextId)
        .single();
      expect(nextError).toBeNull();
      cohort.preview(nextId);
      // 故障注入：返回 HTTP 200 和成功文字，但不写数据库；页面必须拒绝这个假凭证。
      await page.route(
        "**/rest/v1/rpc/execute_exchange_rate_recalculation",
        (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              runId: next.id,
              status: "succeeded",
              affectedRows: 0,
            }),
          }),
      );
      await page
        .getByRole("button", { name: "执行这份预览", exact: true })
        .click();
      await expect(
        page.getByText(
          "核算尚未完成，请刷新查看凭证；缺少报价或数据变化时请补齐后重新预览。",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByText("核算完成，结果已核对并保存。", { exact: true }),
      ).toHaveCount(0);
      const { data: unchanged } = await admin
        .from("exchange_rate_recalculation_runs")
        .select("status")
        .eq("id", next.id)
        .single();
      expect(unchanged?.status).toBe("preview");
      cohort.unchanged();
    } catch (error) {
      failure = { error };
    } finally {
      await finalizeBocRecalculationCohort(page, testInfo, cohort, failure);
    }
  });
});
