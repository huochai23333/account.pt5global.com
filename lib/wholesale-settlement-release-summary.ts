import type { SupabaseClient } from "@supabase/supabase-js";

export type MonthlySettlementAllocatedUsdSummary = {
  monthStart: string;
  nextMonthStart: string;
  allocationCount: number;
  amountUsd: number | null;
  missingRateCount: number;
};

export async function getMonthlySettlementAllocatedUsdSummary(
  supabase: SupabaseClient,
): Promise<MonthlySettlementAllocatedUsdSummary | null> {
  // 汇总必须由数据库对全部可见记录计算；前端列表可能被分页截断，不能拿它求和。
  const { data, error } = await supabase.rpc(
    "get_monthly_settlement_allocated_usd",
  );
  if (error || !Array.isArray(data) || data.length !== 1) return null;

  const row = data[0];
  if (!row || typeof row !== "object") return null;
  const allocationCount = Number(row.allocation_count);
  const missingRateCount = Number(row.missing_rate_count);
  const amountUsd = row.amount_usd === null ? null : Number(row.amount_usd);

  // 缺失字段或异常数值不能退化成 0，否则会把未核实的统计伪装成真实金额。
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(row.month_start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(row.next_month_start) ||
    row.allocation_count == null ||
    row.missing_rate_count == null ||
    !Number.isSafeInteger(allocationCount) ||
    allocationCount < 0 ||
    !Number.isSafeInteger(missingRateCount) ||
    missingRateCount < 0 ||
    missingRateCount > allocationCount ||
    (missingRateCount === 0 &&
      (amountUsd === null || !Number.isFinite(amountUsd) || amountUsd < 0)) ||
    (missingRateCount > 0 && amountUsd !== null)
  ) {
    return null;
  }

  return {
    allocationCount,
    amountUsd,
    missingRateCount,
    monthStart: row.month_start,
    nextMonthStart: row.next_month_start,
  };
}
