import type { SupabaseClient } from "@supabase/supabase-js";
import { withRequestTimeout } from "./request-timeout";
import {
  defaultOperatorReimbursementFilters,
  type OperatorReimbursementFilters,
  type OperatorReimbursementsPageData,
} from "./operator-reimbursements-types";

/** 数据库按登录身份检查权限，并返回服务端计算的日期、完整汇总和当前页。 */
export async function getOperatorReimbursementsPageData(
  supabase: SupabaseClient,
  filters: OperatorReimbursementFilters = defaultOperatorReimbursementFilters,
): Promise<OperatorReimbursementsPageData> {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("get_operator_reimbursements_page", {
      p_owner: filters.owner,
      p_period: filters.period === "all" ? null : filters.period,
      p_status: filters.status,
      p_search: filters.search,
      p_page: filters.page,
      p_page_size: 20,
    }),
  );
  if (error) throw error;
  return data as OperatorReimbursementsPageData;
}
