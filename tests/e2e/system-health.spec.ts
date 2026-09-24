import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";

test.beforeAll(async () => {
  const supabase = getLocalSupabaseAdminClient();
  test.skip(!supabase, "系统运行页面状态夹具只允许写入本地 Supabase。");
  if (!supabase) return;

  const marker = `e2e-system-health-${Date.now()}`;
  await createState(supabase, "ai-assistant-generation", `${marker}-success`, "succeeded");
  await createState(supabase, "user-media-upload", `${marker}-partial`, "partial_failed");
  await createState(supabase, "user-media-delete", `${marker}-failed`, "failed");
  await createState(supabase, "exchange-rate-sync", `${marker}-queued`, "failed");
  await createState(supabase, "ai-order-assessment", `${marker}-running`, null);
});

test("管理员可以查看真实运行状态且桌面和移动端不溢出", async ({ page }) => {
  await loginAs(page, "administrator");

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin/system-health");
    await expect(page.getByRole("heading", { name: "系统运行" })).toBeVisible();
    await expect(page.getByText("已完成", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("部分未完成", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("未完成", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("等待处理", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("正在处理", { exact: true }).first()).toBeVisible();

    const widths = await page.locator("body").evaluate((body) => ({
      client: body.clientWidth,
      scroll: body.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  }
});

test("非管理员不能进入系统运行页面", async ({ page }) => {
  await loginAs(page, "finance");
  await page.goto("/finance/system-health");
  await expect(page.getByRole("heading", { name: "这个页面不在你的工作范围内" })).toBeVisible();
});

async function createState(
  supabase: NonNullable<ReturnType<typeof getLocalSupabaseAdminClient>>,
  operationKey: string,
  idempotencyKey: string,
  outcome: "succeeded" | "partial_failed" | "failed" | null,
) {
  const { data, error } = await supabase.rpc("create_service_operation_run", {
    p_idempotency_key: idempotencyKey,
    p_operation_key: operationKey,
    p_request_payload: { source: "playwright" },
    p_requested_by_user_id: null,
    p_trigger_source: "manual",
  });
  if (error) throw error;

  const operationId = readOperationId(data);
  if (!outcome) return;

  // 服务端任务从第 1 次运行开始；夹具也使用带尝试编号的正式回写接口。
  const { error: finishError } = await supabase.rpc("finish_operation_attempt_checked", {
    p_attempt_number: 1,
    p_error_code: outcome === "succeeded" ? null : "injected_failure",
    p_error_message: outcome === "succeeded" ? null : "本地故障注入",
    p_expected_count: 2,
    p_failed_count: outcome === "succeeded" ? 0 : 1,
    p_operation_id: operationId,
    p_outcome: outcome,
    p_result_proof: { source: "playwright" },
    p_succeeded_count: outcome === "failed" ? 0 : 1,
  });
  if (finishError) throw finishError;
}

function readOperationId(value: unknown) {
  if (
    typeof value !== "object"
    || value === null
    || !("operationId" in value)
    || typeof value.operationId !== "string"
  ) {
    throw new Error("系统运行夹具没有返回 operationId。");
  }
  return value.operationId;
}
