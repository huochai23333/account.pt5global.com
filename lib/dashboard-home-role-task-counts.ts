import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppRole } from "./auth-routing";
import { getOperatorReimbursementsPageData } from "./operator-reimbursements-queries";
import { getSupabaseServiceRoleClient } from "./supabase-admin-server";

export type HomeRoleTaskCountKey = "creditOrders" | "mail" | "reimbursements" | "settlements";
export type HomeRoleTaskCounts = Partial<Record<HomeRoleTaskCountKey, number>>;

/**
 * 首页只显示和目标页面同一范围的待处理数量。查询失败时省略数字，
 * 避免把服务故障显示成“0 项待处理”。邮箱数据使用服务端账号查询后再按当前岗位收窄。
 */
export async function getDashboardHomeRoleTaskCounts(
  supabase: SupabaseClient,
  input: { role: AppRole | null; status: string | null; userId: string },
): Promise<HomeRoleTaskCounts> {
  if (input.status !== "active") return {};
  const tasks: Array<Promise<[HomeRoleTaskCountKey, number]>> = [];
  if (input.role === "administrator" || input.role === "salesman") {
    tasks.push((async () => {
      let query = getSupabaseServiceRoleClient().from("mail_threads")
        .select("id", { count: "exact", head: true })
        .eq("intake_status", "active").eq("state", "waiting_pt5").is("deleted_at", null);
      if (input.role === "salesman") query = query.eq("assigned_user_id", input.userId);
      const { count, error } = await query;
      if (error || count === null) throw error ?? new Error("mail_count_missing");
      return ["mail", count];
    })());
  }
  if (input.role === "finance") {
    tasks.push((async () => {
      const { count, error } = await supabase.from("wholesale_settlement_releases")
        .select("id", { count: "exact", head: true }).eq("status", "pending");
      if (error || count === null) throw error ?? new Error("settlement_count_missing");
      return ["settlements", count];
    })());
  }
  if (input.role === "operator") {
    tasks.push((async () => {
      const page = await getOperatorReimbursementsPageData(supabase, {
        owner: "mine", period: "all", status: "unreimbursed", search: "", page: 1,
      });
      return ["reimbursements", page.summaries.totalUnreimbursed.count];
    })());
  }
  if (input.role === "client") {
    tasks.push((async () => {
      const { count, error } = await supabase.from("customer_inventory_orders")
        .select("id", { count: "exact", head: true }).eq("payment_status", "awaiting_payment");
      if (error || count === null) throw error ?? new Error("inventory_count_missing");
      return ["creditOrders", count];
    })());
  }
  const counts: HomeRoleTaskCounts = {};
  for (const result of await Promise.allSettled(tasks)) {
    if (result.status === "fulfilled" && Number.isFinite(result.value[1])) {
      counts[result.value[0]] = result.value[1];
    }
  }
  return counts;
}
