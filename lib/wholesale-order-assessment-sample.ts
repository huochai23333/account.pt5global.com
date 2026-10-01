import type { SupabaseClient } from "@supabase/supabase-js";
import { getWholesaleOrderPage, type WholesaleOrderFilters, type WholesaleOrderPage } from "./wholesale-order-page";

/** 评估所用的有限样例独立于界面每页 20 条的规则，完整金额和总数仍使用首页汇总。 */
export async function getWholesaleOrderAssessmentSample(
  supabase: SupabaseClient,
  filters: WholesaleOrderFilters,
  firstPage: WholesaleOrderPage,
  sampleSize: number,
) {
  const result = { ...firstPage };
  const pageCount = Math.min(5, Math.ceil(Math.min(sampleSize, firstPage.totalCount) / 20));
  for (let page = 2; page <= pageCount; page += 1) {
    const next = await getWholesaleOrderPage(supabase, filters, page);
    result.orders = [...result.orders, ...next.orders];
    result.orderSettlements = [...result.orderSettlements, ...next.orderSettlements];
    result.orderChangeLogs = [...result.orderChangeLogs, ...next.orderChangeLogs];
    result.orderListAttachments = [...result.orderListAttachments, ...next.orderListAttachments];
    result.clientContactsByOrderId = { ...result.clientContactsByOrderId, ...next.clientContactsByOrderId };
    result.warnings = [...result.warnings, ...next.warnings];
  }
  return result;
}
