import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WholesaleSettlementRelease,
  WholesaleSettlementReleaseAllocation,
} from "./wholesale-settlement-releases";

export type MonthlySettlementUnallocatedSummary = {
  monthStart: string;
  nextMonthStart: string;
  amounts: Array<{ currency: string; amount: number }>;
};

/** 输入为当前用户完整可见的记录；统计与列表搜索、分页无关。 */
export function getMonthlySettlementUnallocatedSummary(
  releases: readonly WholesaleSettlementRelease[],
  allocations: readonly WholesaleSettlementReleaseAllocation[],
  now = new Date(),
): MonthlySettlementUnallocatedSummary {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")!.value);
  const month = Number(parts.find((part) => part.type === "month")!.value);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonthStart = `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`;
  const activeCentsByRelease = new Map<string, bigint>();
  for (const allocation of allocations) {
    if (allocation.status !== "active") continue;
    activeCentsByRelease.set(
      allocation.release_id,
      (activeCentsByRelease.get(allocation.release_id) ?? BigInt(0)) +
        toCents(allocation.allocation_amount),
    );
  }

  const totals = new Map<string, bigint>();
  for (const release of releases) {
    if (
      release.received_on < monthStart ||
      release.received_on >= nextMonthStart ||
      release.status === "cancelled" ||
      release.status === "allocated"
    ) continue;
    // 分配按当前有效状态扣减，分配发生月份不影响收款的当前余额。
    const remaining = toCents(release.release_amount) -
      (activeCentsByRelease.get(release.id) ?? BigInt(0));
    if (remaining <= BigInt(0)) continue;
    totals.set(
      release.release_currency,
      (totals.get(release.release_currency) ?? BigInt(0)) + remaining,
    );
  }

  return {
    monthStart,
    nextMonthStart,
    amounts: Array.from(totals.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, cents]) => {
        if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new Error("本月未分配金额超出可精确显示的范围。");
        }
        return { currency, amount: Number(cents) / 100 };
      }),
  };
}

function toCents(amount: number) {
  // 两张表的金额列均为 numeric(14,2)，直接从十进制字符串转整数分。
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(amount));
  if (!match) throw new Error("收款或分配金额格式无效。");
  return BigInt(match[1]) * BigInt(100) +
    BigInt((match[2] ?? "").padEnd(2, "0"));
}

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
