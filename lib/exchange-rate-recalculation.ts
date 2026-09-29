import type { SupabaseClient } from "@supabase/supabase-js";
import { withRequestTimeout } from "./request-timeout";

export type RecalculationItem = {
  id: string; order_kind: "ordinary" | "wholesale"; order_id: string;
  status: "ready" | "failed" | "succeeded"; message: string | null; affected_rows: number;
  delta: { oldRmb: number; newRmb: number | null; difference: number | null };
  before_snapshot: Record<string, unknown>; after_snapshot: Record<string, unknown> | null;
};
export type RecalculationRun = {
  id: string; preview_token: string; status: "preview" | "succeeded" | "partial_failed" | "failed";
  scope_counts: Record<string, number>; proof: { affectedRows?: number; succeededCount?: number; failedCount?: number };
  created_at: string; expires_at: string;
};
export type RecalculationPreview = { run: RecalculationRun; items: RecalculationItem[] };

/** 页面重载和断线恢复都读取同一份数据库预览与执行凭证。 */
export async function readRecalculation(supabase: SupabaseClient, runId?: string): Promise<RecalculationPreview | null> {
  let query = supabase.from("exchange_rate_recalculation_runs").select("*");
  if (runId) query = query.eq("id", runId);
  const { data: run, error } = await withRequestTimeout(query.order("created_at", { ascending: false }).limit(1).maybeSingle<RecalculationRun>());
  if (error) throw error;
  if (!run) return null;
  // 分页读取全部明细，不能把数据库的单页上限当成实际修复范围。
  const items: RecalculationItem[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data: batch, error: itemError } = await withRequestTimeout(supabase.from("exchange_rate_recalculation_items").select("*")
      .eq("run_id", run.id).order("order_kind").order("order_id").range(offset, offset + 499).returns<RecalculationItem[]>());
    if (itemError) throw itemError;
    items.push(...(batch ?? []));
    if (!batch || batch.length < 500) break;
  }
  if (!items.length) throw new Error("历史核算明细暂时无法确认。");
  return { run, items };
}
export async function createRecalculationPreview(supabase: SupabaseClient) {
  // 预览前先让服务端按真实业务日期补齐报价；供应商部分失败时仍生成逐笔失败预览。
  const { data: rates, error: syncError } = await withRequestTimeout(supabase.functions.invoke("exchange-rate-sync", {
    body: { trigger: "recalculation_rates" },
  }), { timeoutMs: 120_000, message: "历史报价仍在获取，请稍后刷新查看。" });
  if (syncError || typeof rates?.operationId !== "string" || !["succeeded", "partial_failed", "failed", "skipped"].includes(String(rates?.outcome))) {
    throw new Error("历史报价补充尚未确认，请稍后重试。");
  }
  const { data, error } = await withRequestTimeout(supabase.rpc("preview_exchange_rate_recalculation"), { timeoutMs: 120_000, message: "预览仍在处理中，请稍后刷新查看。" });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("没有生成历史核算预览。");
  const preview = await readRecalculation(supabase, data);
  if (!preview) throw new Error("历史核算预览尚未保存。");
  return preview;
}
export async function executeRecalculation(supabase: SupabaseClient, preview: RecalculationPreview) {
  const { data, error } = await withRequestTimeout(supabase.rpc("execute_exchange_rate_recalculation", {
    p_run_id: preview.run.id, p_preview_token: preview.run.preview_token,
  }), { timeoutMs: 120_000, message: "核算结果仍在确认，请刷新查看已保存的凭证。" });
  if (error) throw error;
  // RPC 返回值还需与数据库终态、实际行数、订单明细交叉核对。
  const stored = await readRecalculation(supabase, preview.run.id);
  if (!stored || stored.run.status === "preview" || data?.runId !== stored.run.id
    || Number(data?.affectedRows) !== Number(stored.run.proof.affectedRows)
    || data?.status !== stored.run.status
    || stored.items.filter(item => item.status === "succeeded").length !== Number(stored.run.proof.succeededCount)
    || stored.items.filter(item => item.status === "failed").length !== Number(stored.run.proof.failedCount)
    || stored.items.filter(item => item.status === "succeeded").reduce((sum, item) => sum + item.affected_rows, 0) !== Number(stored.run.proof.affectedRows)) {
    throw new Error("历史核算结果尚未确认，请刷新查看。");
  }
  return stored;
}
export async function canRecalculate(supabase: SupabaseClient) {
  const { data, error } = await withRequestTimeout(supabase.from("boc_quote_verifications").select("currency,quote_kind").eq("history_complete", true));
  if (error) throw error;
  return new Set((data ?? []).map(row => `${row.currency}:${row.quote_kind}`)).size === 4;
}
