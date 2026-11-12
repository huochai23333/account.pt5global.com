import type { SupabaseClient } from "@supabase/supabase-js";

import { getAdminOrderCount, queryAdminOrders, type AdminOrderOverviewFilters } from "./admin-orders-query";
import { getAdminOrderCosts, mergeAdminOrdersWithCosts } from "./admin-orders-costs";
import { getAdminOrderServiceFees, mergeAdminOrdersWithServiceFees } from "./admin-orders-service-fees";
import { resolveAdminOrderUserFilter } from "./admin-orders-page-filters";
import { getDashboardPaginationState, getDashboardQueryRangeForPage } from "./dashboard-pagination";
import { getShanghaiOrderDateBounds } from "./order-date-range";
import type { AdminOrdersFilters, AdminOrdersPageData, OrderUserOption } from "./admin-orders-types";

type OrderListData = Pick<AdminOrdersPageData, "matchedOrdersCount" | "orders" | "pagination" | "summary" | "totalOrdersCount">;

export async function getAdminOrderListData(supabase: SupabaseClient, {
  businessOrderTypeIds,
  canViewOrderCosts,
  filters,
  pageSize,
  requestedPage,
  userOptions,
}: {
  businessOrderTypeIds: string[] | null;
  canViewOrderCosts: boolean;
  filters: AdminOrdersFilters;
  pageSize: number;
  requestedPage: number;
  userOptions: OrderUserOption[];
}): Promise<OrderListData> {
  // 空授权范围必须先返回；底层查询会把空 ID 数组视为没有筛选条件。
  if (businessOrderTypeIds?.length === 0) {
    return {
      matchedOrdersCount: 0,
      orders: [],
      pagination: getDashboardPaginationState(0, requestedPage, pageSize),
      summary: { completed: 0, pending: 0, total: 0 },
      totalOrdersCount: 0,
    };
  }

  // 汇总始终按日期区间计算；跨日期精确搜索仅改变列表条件。
  const businessOrderFilter: Pick<AdminOrderOverviewFilters, "orderTypeIds"> =
    businessOrderTypeIds !== null
      ? {
          orderTypeIds: businessOrderTypeIds,
        }
      : {};
  const dateBounds = getShanghaiOrderDateBounds({
    fromDate: filters.createdFromDate,
    toDate: filters.createdToDate,
  });
  const dateRangeFilter: Pick<
    AdminOrderOverviewFilters,
    "createdFrom" | "createdToExclusive"
  > = {
    createdFrom: dateBounds.fromInclusive,
    createdToExclusive: dateBounds.toExclusive,
  };
  const [
    totalOrdersCount,
    pendingOrdersCount,
    completedOrdersCount,
  ] = await Promise.all([
    getAdminOrderCount(supabase, {
      ...businessOrderFilter,
      ...dateRangeFilter,
    }),
    getAdminOrderCount(supabase, {
      ...businessOrderFilter,
      ...dateRangeFilter,
      orderStatus: "pending",
    }),
    getAdminOrderCount(supabase, {
      ...businessOrderFilter,
      ...dateRangeFilter,
      orderStatus: "completed",
    }),
  ]);

  const orderEntryUserFilter = resolveAdminOrderUserFilter(
    userOptions,
    filters.orderEntryUser,
  );
  const orderingUserFilter = resolveAdminOrderUserFilter(
    userOptions,
    filters.orderingUser,
  );

  const filterHasNoMatches =
    filters.searchMode === "date_range" &&
    (orderEntryUserFilter.hasNoMatches || orderingUserFilter.hasNoMatches);
  const orderFilters: AdminOrderOverviewFilters = {
    ...businessOrderFilter,
    ...(filters.searchMode === "date_range" ? dateRangeFilter : {}),
    ...(filters.searchMode === "exact_all_time"
      ? { orderNumberExact: filters.orderNumber }
      : {
          orderEntryUserIds: orderEntryUserFilter.userIds,
          orderNumber: filters.orderNumber,
          orderingUserIds: orderingUserFilter.userIds,
        }),
  };
  const matchedOrdersCount = filterHasNoMatches
    ? 0
    : await getAdminOrderCount(supabase, orderFilters);
  const pagination = getDashboardPaginationState(
    matchedOrdersCount,
    requestedPage,
    pageSize,
  );

  const summary = {
    completed: completedOrdersCount,
    pending: pendingOrdersCount,
    total: totalOrdersCount,
  };
  if (matchedOrdersCount === 0) {
    return { matchedOrdersCount, orders: [], pagination, summary, totalOrdersCount };
  }

  const orders = await queryAdminOrders(supabase, {
    filters: orderFilters,
    range: getDashboardQueryRangeForPage(pagination.page, pagination.pageSize),
  });
  const orderIds = orders.map((order) => order.id);
  const [orderCosts, orderServiceFees] = await Promise.all([
    canViewOrderCosts && orderIds.length > 0
      ? getAdminOrderCosts(supabase, orderIds)
      : Promise.resolve([]),
    getAdminOrderServiceFees(supabase, orderIds),
  ]);
  const ordersWithServiceFees = mergeAdminOrdersWithServiceFees(
    orders,
    orderServiceFees,
  );

  return {
    matchedOrdersCount,
    orders: canViewOrderCosts
      ? mergeAdminOrdersWithCosts(ordersWithServiceFees, orderCosts)
      : ordersWithServiceFees,
    pagination,
    summary,
    totalOrdersCount,
  };
}
