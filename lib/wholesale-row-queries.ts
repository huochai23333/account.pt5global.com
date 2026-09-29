import type { SupabaseClient } from "@supabase/supabase-js";
import type { WholesaleCustomer, WholesaleOrder } from "./wholesale-types";

/** 统一处理列表读取错误，查询本身始终由调用者的 Supabase 客户端执行并受 RLS 约束。 */
export async function queryWholesaleRows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> {
  const result = await query;
  if (result.error) throw new Error(`${label}暂时没有加载成功，请稍后重试。`, { cause: result.error });
  return result.data ?? [];
}

export function getWholesaleCustomers(supabase: SupabaseClient) {
  return queryWholesaleRows<WholesaleCustomer>(supabase.from("wholesale_customers").select("*").order("created_at", { ascending: false }), "批发客户");
}

export function getAllWholesaleOrders(supabase: SupabaseClient, canViewInternalFields: boolean) {
  const columns = canViewInternalFields ? "*"
    : "id,order_number,customer_id,sales_user_id,small_order_count,packing_fee,courier_company,settlement_exchange_rate,customer_payment_currency,customer_payment_amount,customer_payment_rmb_amount,gross_profit,gross_margin,unit_gross_profit,commission_rate,salesman_commission_parameter_version_id,referral_amount_parameter_version_id,notes,order_month,status,ordered_at,settled_at,created_by_user_id,created_at,updated_at";
  return queryWholesaleRows<WholesaleOrder>(supabase.from("wholesale_orders").select(columns as "*")
    .order("ordered_at", { ascending: false }).order("id", { ascending: false }), "批发订单");
}
