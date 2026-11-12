import { expect, type Page, type TestInfo } from "@playwright/test";
import { test } from "./boc-suite-fixture";
import { assertBocSdkOrigin } from "./boc-suite-guard";
import { loginAs } from "./auth";
import { getLocalSupabaseAdminClient } from "./local-supabase-admin";
import { fillDateControl } from "./date-control";
import { runLocalSupabaseSql } from "./local-supabase";
import { createBocManualRateCase } from "../../test-support/boc-manual-rate-case";
import { cleanupFixtureResources } from "../../test-support/fixture-cleanup-sequence";

/** 保留原XTS页面流程；准备拒绝旧行，写入后完整版本由独立SQL能力核对。 */
export function registerBocManualRateCase() {
  test("页面人工录入原始买入价，修改、刷新、删除均有数据库凭证", async ({
    page,
  }, testInfo) => {
    const admin = getLocalSupabaseAdminClient()!;
    const today = new Date(Date.now() + 28_800_000).toISOString().slice(0, 10);
    assertBocSdkOrigin(admin);
    const fixture = createBocManualRateCase(runLocalSupabaseSql, today);
    let failure: { error: unknown } | undefined;
    try {
      fixture.prepare();
      await loginAs(page, "administrator");
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/admin/settings");
      await page.getByRole("button", { name: "新增汇率", exact: true }).click();
      const dialog = page.getByRole("dialog", {
        name: "新增汇率",
        exact: true,
      });
      // XTS 是专用测试货币代码；合成手工报价不计入中行外部核对。
      await dialog.getByLabel("原始货币").fill("XTS");
      await dialog.getByLabel("目标货币").fill("CNY");
      await dialog.getByLabel("原始现汇买入汇率（每 1 外币）").fill("7");
      await fillDateControl(
        dialog.getByLabel("中行报价时间（北京时间）"),
        today,
      );
      await dialog.getByLabel("发布时间（时:分:秒）").fill("00:01:00");
      await dialog
        .getByRole("button", { name: "新增汇率", exact: true })
        .click();
      await expect(dialog).toHaveCount(0);
      const { data: created, error } = await admin
        .from("exchange_rate")
        .select("*")
        .eq("original_currency", "XTS")
        .eq("rate_date", today)
        .single();
      expect(error).toBeNull();
      expect(fixture.saved().id).toBe(created.id);
      expect(Number(created.bank_quote)).toBe(700);
      expect(created.source).toBe("manual");
      await page.reload();
      const row = page
        .locator("table:visible tbody tr")
        .filter({ hasText: "XTS" });
      await expect(row).toContainText("6.93");
      await row.getByRole("button", { name: "编辑", exact: true }).click();
      const edit = page.getByRole("dialog", { name: "编辑汇率", exact: true });
      await edit.getByLabel("原始现汇买入汇率（每 1 外币）").fill("8");
      await edit.getByLabel("发布时间（时:分:秒）").fill("00:02:00");
      await edit.getByRole("button", { name: "保存修改", exact: true }).click();
      await expect(edit).toHaveCount(0);
      const { data: updated } = await admin
        .from("exchange_rate")
        .select("*")
        .eq("id", created.id)
        .single();
      expect(Number(updated.daily_exchange_rate)).toBe(8);
      expect(Number(updated.bank_quote)).toBe(800);
      expect(fixture.updated().id).toBe(created.id);
      await page.reload();
      await expect(row).toContainText("7.92");
      fixture.unchanged();
      await page.setViewportSize({ width: 390, height: 844 });
      const card = page
        .locator("article:visible")
        .filter({ hasText: "XTS/CNY" })
        .filter({
          has: page.getByRole("button", { name: "删除", exact: true }),
        });
      await card.getByRole("button", { name: "删除", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "确认操作", exact: true })
        .click();
      await expect(
        page.getByText("汇率 XTS/CNY 已删除。", { exact: true }),
      ).toBeVisible();
      const { count } = await admin
        .from("exchange_rate")
        .select("id", { count: "exact", head: true })
        .eq("id", created.id);
      expect(count).toBe(0);
      expect(fixture.deleted().id).toBe(created.id);
      await page.reload();
      await expect(
        page.locator("article:visible").filter({ hasText: "XTS/CNY" }),
      ).toHaveCount(0);

      fixture.unchanged();
    } catch (error) {
      failure = { error };
    } finally {
      await finalizeBocManualRateCase(page, testInfo, fixture, failure);
    }
  });
}

/** 先排空并关闭页面，再回收完整凭证；正文/清理/附件错误全部保留。 */
export async function finalizeBocManualRateCase(
  page: Page,
  info: TestInfo,
  fixture: ReturnType<typeof createBocManualRateCase>,
  failure?: { error: unknown },
) {
  let closed = false;
  let receipt: ReturnType<typeof fixture.cleanup> | undefined;
  await cleanupFixtureResources(
    async () => {
      if (failure) throw failure.error;
    },
    async () => {
      if (!page.isClosed()) {
        await page.unrouteAll({ behavior: "wait" });
        await page.close();
      }
      closed = true;
    },
    async () => {
      if (!closed) throw new Error("boc_manual_page_not_closed");
      receipt = fixture.cleanup();
    },
    async () =>
      info.attach("boc-manual-rate-case", {
        body: Buffer.from(
          JSON.stringify(
            {
              ...fixture.evidence(),
              pageClosed: closed,
              cleanupReceipt: receipt,
            },
            null,
            2,
          ),
        ),
        contentType: "application/json",
      }),
  );
}
