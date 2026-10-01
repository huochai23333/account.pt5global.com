import { queryCompleteDashboardRows, type DashboardCollectionQuery } from "./dashboard-complete-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WholesaleCustomer, WholesaleOrder } from "./wholesale-types";

/** 统一处理列表读取错误，查询本身始终由调用者的 Supabase 客户端执行并受 RLS 约束。 */
export async function queryWholesaleRows<T>(query: DashboardCollectionQuery<T>, label: string): Promise<T[]> {
  const result = await queryCompleteDashboardRows(query);
  if (result.error) throw new Error(`${label}暂时没有加载成功，请稍后重试。`, { cause: result.error });
  return result.data ?? [];
}

export async function getWholesaleCustomers(supabase: SupabaseClient) {
  // 来源线索仍受自己的 RLS 约束；同事不可见的线索不随客户列表泄露内部跟进资料。
  // customer_id 有唯一约束，关联查询返回一个对象或 null，而不是列表。
  const rows = await queryWholesaleRows<WholesaleCustomer & { sales_leads: { id: string } | null }>(
    supabase.from("wholesale_customers").select("*,sales_leads!sales_leads_customer_id_fkey(id)").order("created_at", { ascending: false }).order("id", { ascending: false }), "批发客户");
  return rows.map(({ sales_leads, ...customer }) => ({ ...customer, source_sales_lead_id: sales_leads?.id ?? null }));
}

export function getAllWholesaleOrders(supabase: SupabaseClient, canViewInternalFields: boolean) {
  const columns = canViewInternalFields ? "*"
    : "id,order_number,customer_id,sales_user_id,small_order_count,packing_fee,courier_company,settlement_exchange_rate,customer_payment_currency,customer_payment_amount,customer_payment_rmb_amount,gross_profit,gross_margin,unit_gross_profit,commission_rate,salesman_commission_parameter_version_id,referral_amount_parameter_version_id,notes,order_month,status,ordered_at,settled_at,created_by_user_id,created_at,updated_at";
  return queryWholesaleRows<WholesaleOrder>(supabase.from("wholesale_orders").select(columns as "*")
    .order("ordered_at", { ascending: false }).order("id", { ascending: false }), "批发订单");
}
