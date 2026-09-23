import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  WholesaleLinked1688Order,
  WholesaleOrder,
  WholesaleOrderListItem,
  WholesaleOrderChangeLog,
  WholesaleOrderSettlement,
} from "./wholesale";
import type { WholesaleOrderListAttachment } from "./wholesale-order-list-attachments";
import {
  normalizeOrderDateRange,
  type OrderSearchMode,
} from "./order-date-range";
import {
  deduplicateWholesaleOrderWarnings,
  readWholesaleOrderArray,
  readWholesaleOrderCursor,
  readWholesaleOrderNumber,
  readWholesaleOrderRecord,
  readWholesaleOrderSummary,
  readWholesaleRelatedRows,
} from "./wholesale-order-page-decoders";
import {
  emptyWholesaleRelatedQuery,
  getLinkedWholesalePurchaseOrders,
} from "./wholesale-order-page-related";

export type WholesaleOrderFilters = {
  customerId: string;
  orderMonth: string;
  orderedFromDate: string;
  orderedToDate: string;
  salesUserId: string;
  searchText: string;
  searchMode: OrderSearchMode;
  status: "all" | WholesaleOrder["status"];
};

export type WholesaleOrderCursor = {
  id: string;
  orderedAt: string;
};

export type WholesaleOrderPageWarning = {
  area: "attachments" | "changes" | "purchases" | "settlements";
  message: string;
};

export type WholesaleOrderPageSummary = {
  averageMargin: number | null;
  customerPaymentRmbAmount: number;
  grossProfitAmount: number;
  internationalShippingFeeAmount?: number;
  orderCount: number;
  otherFeeAmount?: number;
  packingFeeAmount: number;
  partialSettledCount: number;
  productPurchaseAmount?: number;
  referralCommissionFeeAmount?: number;
  settledCount: number;
  unsettledCount: number;
};

export type WholesaleOrderPage = {
  canViewInternalFields: boolean;
  nextCursor: WholesaleOrderCursor | null;
  orderChangeLogs: WholesaleOrderChangeLog[];
  orderListAttachments: WholesaleOrderListAttachment[];
  orders: WholesaleOrderListItem[];
  orderSettlements: WholesaleOrderSettlement[];
  purchaseOrders: WholesaleLinked1688Order[];
  summary: WholesaleOrderPageSummary;
  totalCount: number;
  warnings: WholesaleOrderPageWarning[];
};

export const WHOLESALE_ORDER_PAGE_SIZE = 20;

/**
 * 核心订单、总数和汇总由一个 RPC 返回；关联记录只按这一批订单 ID 查询。
 * 核心查询失败会直接抛错，关联查询失败则留下局部警告，避免伪装成“暂无记录”。
 */
export async function getWholesaleOrderPage(
  supabase: SupabaseClient,
  filters: WholesaleOrderFilters,
  cursor: WholesaleOrderCursor | null = null,
  limit = WHOLESALE_ORDER_PAGE_SIZE,
): Promise<WholesaleOrderPage> {
  const dateRange = normalizeOrderDateRange({
    fromDate: filters.orderedFromDate,
    toDate: filters.orderedToDate,
  });
  const { data, error } = await supabase.rpc("get_wholesale_order_page", {
    p_cursor: cursor,
    p_filters: {
      ...filters,
      orderedFromDate: dateRange.fromDate,
      orderedToDate: dateRange.toDate,
      searchText: filters.searchText.trim(),
    },
    p_limit: limit,
  });

  if (error) {
    throw new Error("批发订单暂时没有加载成功，请稍后重试。", {
      cause: error,
    });
  }

  const core = readWholesaleOrderRecord(data);
  const canViewInternalFields = core?.canViewInternalFields === true;
  const orders = readWholesaleOrderArray(core?.orders) as WholesaleOrderListItem[];

  if (!core || !Array.isArray(core.orders)) {
    throw new Error("批发订单暂时没有加载成功，请稍后重试。");
  }

  const orderIds = orders.map((order) => order.id);
  const warnings: WholesaleOrderPageWarning[] = [];

  if (orderIds.length === 0) {
    return {
      canViewInternalFields,
      nextCursor: readWholesaleOrderCursor(core.nextCursor),
      orderChangeLogs: [],
      orderListAttachments: [],
      orders,
      orderSettlements: [],
      purchaseOrders: [],
      summary: readWholesaleOrderSummary(core.summary),
      totalCount: readWholesaleOrderNumber(core.totalCount),
      warnings,
    };
  }

  const [
    settlementsResult,
    purchaseOrdersResult,
    changeLogsResult,
    attachmentsResult,
  ] = await Promise.all([
    supabase
      .from("wholesale_order_settlements")
      .select("*")
      .in("order_id", orderIds)
      .order("settled_on", { ascending: false })
      .order("created_at", { ascending: false }),
    getLinkedWholesalePurchaseOrders(supabase, orderIds, canViewInternalFields),
    canViewInternalFields
      ? supabase
          .from("wholesale_order_change_logs")
          .select("*")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false })
      : emptyWholesaleRelatedQuery(),
    supabase
      .from("wholesale_order_list_attachments")
      .select("*")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true }),
  ]);

  return {
    canViewInternalFields,
    nextCursor: readWholesaleOrderCursor(core.nextCursor),
    orderChangeLogs: readWholesaleRelatedRows<WholesaleOrderChangeLog>(
      changeLogsResult,
      warnings,
      "changes",
      "部分订单修改记录暂时没有加载成功。",
    ),
    orderListAttachments: readWholesaleRelatedRows<WholesaleOrderListAttachment>(
      attachmentsResult,
      warnings,
      "attachments",
      "部分 Order List 附件暂时没有加载成功。",
    ),
    orders,
    orderSettlements: readWholesaleRelatedRows<WholesaleOrderSettlement>(
      settlementsResult,
      warnings,
      "settlements",
      "部分结汇记录暂时没有加载成功。",
    ),
    purchaseOrders: readWholesaleRelatedRows<WholesaleLinked1688Order>(
      purchaseOrdersResult,
      warnings,
      "purchases",
      "部分关联采购订单暂时没有加载成功。",
    ),
    summary: readWholesaleOrderSummary(core.summary),
    totalCount: readWholesaleOrderNumber(core.totalCount),
    warnings: deduplicateWholesaleOrderWarnings(warnings),
  };
}
