import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppRole } from "./auth-routing";
import {
  getDefaultOrderDateRange,
  normalizeOrderDateRange,
  type OrderSearchMode,
} from "./order-date-range";

export type WholesaleLogisticsCostState = "all" | "missing" | "recorded";

export type WholesaleLogisticsFilters = {
  costState: WholesaleLogisticsCostState;
  fromDate: string;
  salesUserId: string;
  searchText: string;
  searchMode: OrderSearchMode;
  storeName: string;
  toDate: string;
};

export type WholesaleLogisticsCursor = {
  id: string;
  sortAt: string;
};

export type WholesaleLogisticsRecord = {
  assignment_id: string | null;
  customer_id: string | null;
  id: string;
  last_mile_tracking_number: string | null;
  last_synced_at: string;
  logistics_provider: string | null;
  logistics_status: string | null;
  order_created_at: string | null;
  package_number: string;
  sales_user_id: string | null;
  shipping_cost: number | null;
  shipping_cost_updated_at: string | null;
  shipping_currency: string | null;
  source_order_id: number;
  source_system: string;
  store_name: string | null;
  tracking_number: string | null;
  tracking_updated_at: string | null;
};

export type WholesaleLogisticsPage = {
  lastUpdatedAt: string | null;
  missingCostCount: number;
  nextCursor: WholesaleLogisticsCursor | null;
  recordedCostCount: number;
  rows: WholesaleLogisticsRecord[];
  totalCount: number;
  totalsByCurrency: Record<string, number>;
};

export type WholesaleLogisticsStoreOption = {
  latest_order_at: string | null;
  order_count: number;
  store_name: string;
};

export type WholesaleLogisticsStoreAssignment = {
  created_at: string;
  created_by_user_id: string | null;
  customer_id: string | null;
  effective_from: string | null;
  effective_to: string | null;
  id: string;
  sales_user_id: string;
  store_name: string;
  store_name_normalized: string;
  updated_at: string;
  updated_by_user_id: string | null;
};

export type WholesaleReferralWaybillCount = {
  customer_id: string;
  month_key: string;
  waybill_count: number;
};

export const WHOLESALE_LOGISTICS_PAGE_SIZE = 50;

/** 默认显示最近 30 天；业务员进入时只看自己，管理员和财务默认查看全部。 */
export function getDefaultWholesaleLogisticsFilters(
  role: AppRole | null,
  currentUserId: string | null,
): WholesaleLogisticsFilters {
  const range = getDefaultOrderDateRange();

  return {
    costState: "all",
    fromDate: range.fromDate,
    salesUserId: role === "salesman" && currentUserId ? currentUserId : "all",
    searchText: "",
    searchMode: "date_range",
    storeName: "",
    toDate: range.toDate,
  };
}

/** 物流首屏只读取归档列表、真实店铺候选和归属历史，不再读取批发订单。 */
export async function getInitialWholesaleLogisticsData(
  supabase: SupabaseClient,
  filters: WholesaleLogisticsFilters,
) {
  const [page, assignmentsResult, storeOptionsResult] = await Promise.all([
    getWholesaleLogisticsPage(supabase, filters),
    supabase
      .from("wholesale_logistics_store_assignments")
      .select("*")
      .order("store_name", { ascending: true })
      .order("effective_from", { ascending: false, nullsFirst: true }),
    supabase.rpc("get_wholesale_logistics_store_options"),
  ]);

  if (assignmentsResult.error) {
    throw new Error("店铺归属暂时没有加载成功，请稍后重试。", {
      cause: assignmentsResult.error,
    });
  }
  if (storeOptionsResult.error) {
    throw new Error("店铺列表暂时没有加载成功，请稍后重试。", {
      cause: storeOptionsResult.error,
    });
  }

  return {
    logisticsAssignments:
      (assignmentsResult.data ?? []) as WholesaleLogisticsStoreAssignment[],
    logisticsPage: page,
    logisticsStoreOptions:
      (storeOptionsResult.data ?? []) as WholesaleLogisticsStoreOption[],
  };
}

/** 筛选、统计和游标都由数据库处理，浏览器只合并已经返回的批次。 */
export async function getWholesaleLogisticsPage(
  supabase: SupabaseClient,
  filters: WholesaleLogisticsFilters,
  cursor: WholesaleLogisticsCursor | null = null,
  limit = WHOLESALE_LOGISTICS_PAGE_SIZE,
): Promise<WholesaleLogisticsPage> {
  const dateRange = normalizeOrderDateRange({
    fromDate: filters.fromDate,
    toDate: filters.toDate,
  });
  const { data, error } = await supabase.rpc("get_wholesale_logistics_page", {
    p_cursor: cursor,
    p_filters: {
      ...filters,
      fromDate: dateRange.fromDate,
      searchText: filters.searchText.trim(),
      toDate: dateRange.toDate,
    },
    p_limit: limit,
  });

  if (error) {
    throw new Error("物流记录暂时没有加载成功，请稍后重试。", {
      cause: error,
    });
  }

  const result = readRecord(data);
  if (!result || !Array.isArray(result.rows)) {
    throw new Error("物流记录暂时没有加载成功，请稍后重试。");
  }

  return {
    lastUpdatedAt:
      typeof result.lastUpdatedAt === "string" ? result.lastUpdatedAt : null,
    missingCostCount: readNumber(result.missingCostCount),
    nextCursor: readCursor(result.nextCursor),
    recordedCostCount: readNumber(result.recordedCostCount),
    rows: result.rows as WholesaleLogisticsRecord[],
    totalCount: readNumber(result.totalCount),
    totalsByCurrency: readCurrencyTotals(result.totalsByCurrency),
  };
}

export async function getWholesaleReferralWaybillCounts(
  supabase: SupabaseClient,
) {
  const { data, error } = await supabase.rpc(
    "get_wholesale_referral_waybill_monthly_counts",
  );

  if (error) {
    throw new Error("客户物流奖励暂时没有加载成功，请稍后重试。", {
      cause: error,
    });
  }

  return (data ?? []) as WholesaleReferralWaybillCount[];
}

/** 页面打开后请求一次增量更新；失败不会清空已经归档的历史数据。 */
export async function requestWholesaleLogisticsRefresh(
  supabase: SupabaseClient,
) {
  const { data, error } = await supabase.functions.invoke("wholesale-logistics-sync", {
    body: { trigger: "page" },
  });

  if (error) {
    throw new Error("最新物流数据暂时没有更新成功，请稍后重试。", {
      cause: error,
    });
  }

  const receipt = readRecord(data);
  if (
    !receipt
    || typeof receipt.operationId !== "string"
    || (receipt.operationStatus !== "succeeded"
      && receipt.operationStatus !== "skipped")
  ) {
    throw new Error("最新物流数据仍在确认中，请稍后到系统运行页查看。");
  }

  return {
    operationId: receipt.operationId,
    status: receipt.operationStatus,
  };
}

function readCursor(value: unknown): WholesaleLogisticsCursor | null {
  const cursor = readRecord(value);
  return cursor &&
    typeof cursor.id === "string" &&
    typeof cursor.sortAt === "string"
    ? { id: cursor.id, sortAt: cursor.sortAt }
    : null;
}

function readCurrencyTotals(value: unknown) {
  const totals = readRecord(value);
  if (!totals) return {};

  return Object.fromEntries(
    Object.entries(totals).map(([currency, amount]) => [
      currency,
      readNumber(amount),
    ]),
  );
}

function readNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}
