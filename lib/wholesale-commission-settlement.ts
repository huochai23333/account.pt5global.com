import type { SupabaseClient } from "@supabase/supabase-js";
import { withRequestTimeout } from "./request-timeout";

export async function settlePendingWholesaleCommission(supabase: SupabaseClient, commissionId: string) {
  const settledAt = new Date().toISOString();
  // 状态与编号一起作为更新条件。断线重试或另一位管理员先结算，都不能覆盖原时间。
  const { data, error } = await withRequestTimeout(
    supabase.from("wholesale_commissions")
      .update({ settled_at: settledAt, status: "settled" })
      .eq("id", commissionId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle<{ id: string }>(),
  ).catch(() => ({ data: null, error: new Error("unconfirmed") }));
  if (!error && data?.id !== commissionId) return "changed";

  // 写入响应可能丢失。用登录用户现有权限单独读回，匹配本次提交的记录和时间。
  const receipt = await withRequestTimeout(
    supabase.from("wholesale_commissions")
      .select("id,status,settled_at")
      .eq("id", commissionId)
      .maybeSingle<{ id: string; status: string; settled_at: string | null }>(),
  ).catch(() => null);
  if (!receipt || receipt.error || receipt.data?.id !== commissionId) return "unconfirmed";
  const row = receipt.data;
  if (row.status === "settled" && row.settled_at && Date.parse(row.settled_at) === Date.parse(settledAt)) {
    return "confirmed";
  }
  return row.status === "pending" ? "unconfirmed" : "changed";
}
