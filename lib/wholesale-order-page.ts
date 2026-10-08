import type { SupabaseClient } from "@supabase/supabase-js";

import type {
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
  readWholesaleOrderNumber,
  readWholesaleOrderRecord,
  readWholesaleOrderSummary,
  readWholesaleRelatedRows,
} from "./wholesale-order-page-decoders";
import { emptyWholesaleRelatedQuery } from "./wholesale-related-query";

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

export type WholesaleOrderPageWarning = {
  area: "attachments" | "changes" | "contacts" | "settlements";
  message: string;
};

export type WholesaleOrderPageSummary = {
  averageMargin: number | null;
  customerPaymentRmbAmount: number;
  grossProfitAmount: number;
  internationalShippingFeeAmount?: number;
  orderCount: number;
  otherFeeAmount?: number;
  serviceFeeAmount?: number;
  cnTaxFeeAmount?: number;
  paymentProcessingFeeAmount?: number;
  packingFeeAmount: number;
  partialSettledCount: number;
  productPurchaseAmount?: number;
  referralCommissionFeeAmount?: number;
  settledCount: number;
  unsettledCount: number;
};

export type WholesaleOrderPage = {
  canViewInternalFields: boolean;
  clientContactsByOrderId: Record<string, string>;
  orderChangeLogs: WholesaleOrderChangeLog[];
  orderListAttachments: WholesaleOrderListAttachment[];
  orders: WholesaleOrderListItem[];
  orderSettlements: WholesaleOrderSettlement[];
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
  page = 1,
): Promise<WholesaleOrderPage> {
  const dateRange = normalizeOrderDateRange({
    fromDate: filters.orderedFromDate,
    toDate: filters.orderedToDate,
  });
  const { data, error } = await supabase.rpc("get_wholesale_order_page", {
    p_page: page,
    p_filters: {
      ...filters,
      orderedFromDate: dateRange.fromDate,
      orderedToDate: dateRange.toDate,
      searchText: filters.searchText.trim(),
    },
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
      clientContactsByOrderId: {},

      orderChangeLogs: [],
      orderListAttachments: [],
      orders,
      orderSettlements: [],
      summary: readWholesaleOrderSummary(core.summary),
      totalCount: readWholesaleOrderNumber(core.totalCount),
      warnings,
    };
  }

  const [
    settlementsResult,
    changeLogsResult,
    attachmentsResult,
    contactsResult,
  ] = await Promise.all([
    // 客户页面只需订单和附件；内部结汇资料按岗位限制读取。
    canViewInternalFields
      ? supabase
          .from("wholesale_order_settlements")
          .select("*")
          .in("order_id", orderIds)
          .order("settled_on", { ascending: false })
          .order("created_at", { ascending: false })
      : emptyWholesaleRelatedQuery(),
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
    // 函数只返回当前客户本人订单的负责人姓名，不开放员工资料表。
    !canViewInternalFields
      ? supabase.rpc("get_wholesale_order_client_contacts", { p_order_ids: orderIds })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (contactsResult.error) warnings.push({ area: "contacts", message: "订单负责人暂时无法读取，请稍后刷新。" });
  const clientContactsByOrderId = Object.fromEntries(
    ((contactsResult.data ?? []) as Array<{ order_id: string; display_name: string | null }>)
      .filter((contact) => contact.order_id && contact.display_name)
      .map((contact) => [contact.order_id, contact.display_name as string]),
  );

  return {
    canViewInternalFields,
    clientContactsByOrderId,

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
    summary: readWholesaleOrderSummary(core.summary),
    totalCount: readWholesaleOrderNumber(core.totalCount),
    warnings: deduplicateWholesaleOrderWarnings(warnings),
  };
}
