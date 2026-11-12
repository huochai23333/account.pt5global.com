import type { SupabaseClient } from "@supabase/supabase-js";

import {
  filterOrderTypeOptionsForBusinessScope,
  getAdminOrderBusinessScope,
  getOrderTypeIdsForBusinessScope,
} from "./admin-orders-business-scope";
import { getAdminOrderFormOptions } from "./admin-orders-options";
import { getAdminOrderListData } from "./admin-orders-list-data";
import {
  canReadOrderByRole,
  canReadOrderCostByRole,
  getCurrentOrderViewerContext,
} from "./admin-orders-viewer";
import {
  DEFAULT_DASHBOARD_PAGE_SIZE,
  getDashboardPaginationState,
} from "./dashboard-pagination";
import { normalizePositiveInteger } from "./value-normalizers";
import type { AdminOrdersFilters, AdminOrdersPageData } from "./admin-orders-types";
import type { AppRole, UserStatus } from "./user-self-service";
import { normalizeAdminOrdersFilters } from "./admin-orders-page-filters";

export {
  normalizeAdminOrdersFilters,
  parseAdminOrdersSearchParams,
} from "./admin-orders-page-filters";

export async function getAdminOrdersPageData(
  supabase: SupabaseClient,
  options: {
    filters?: Partial<AdminOrdersFilters> | null;
    includeOrderCosts?: boolean;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<AdminOrdersPageData> {
  const filters = normalizeAdminOrdersFilters(options.filters);
  const pageSize = normalizePositiveInteger(options.pageSize, DEFAULT_DASHBOARD_PAGE_SIZE);
  const requestedPage = normalizePositiveInteger(options.page, 1);
  const viewer = await getCurrentOrderViewerContext(supabase);

  if (!viewer) {
    return createEmptyAdminOrdersPageData({
      filters,
      page: requestedPage,
      pageSize,
    });
  }

  const businessScope = await getAdminOrderBusinessScope(supabase, viewer.role);
  const canViewOrders =
    canReadOrderByRole(viewer.role, viewer.status) &&
    businessScope.canViewAssignedBoards;
  const canViewOrderCosts =
    options.includeOrderCosts === true && canReadOrderCostByRole(viewer.role, viewer.status);

  if (!canViewOrders) {
    return {
      ...createEmptyAdminOrdersPageData({
        currentViewerId: viewer.user.id,
        currentViewerRole: viewer.role,
        currentViewerStatus: viewer.status,
        filters,
        page: requestedPage,
        pageSize,
      }),
      canViewOrders: false,
    };
  }

  // 角色与业务范围在读取表单和列表之前确认；列表只接收授权后的类型 ID。
  const formOptions = await getAdminOrderFormOptions(supabase);
  const orderTypeOptions = filterOrderTypeOptionsForBusinessScope(
    formOptions.orderTypeOptions,
    businessScope,
  );
  const businessOrderTypeIds = getOrderTypeIdsForBusinessScope(orderTypeOptions, businessScope);
  const list = await getAdminOrderListData(supabase, {
    businessOrderTypeIds,
    canViewOrderCosts,
    filters,
    requestedPage,
    pageSize,
    userOptions: formOptions.userOptions,
  });

  return {
    ...formOptions,
    ...list,
    orderTypeOptions,
    canViewOrderCosts,
    canViewOrders,
    currentViewerId: viewer.user.id,
    currentViewerRole: viewer.role,
    currentViewerStatus: viewer.status,
    filters,
  };
}

function createEmptyAdminOrdersPageData(options: {
  currentViewerId?: string | null;
  currentViewerRole?: AppRole | null;
  currentViewerStatus?: UserStatus | null;
  filters: AdminOrdersFilters;
  page: number;
  pageSize: number;
}): AdminOrdersPageData {
  return {
    canViewOrderCosts: false,
    canViewOrders: false,
    currentViewerId: options.currentViewerId ?? null,
    currentViewerRole: options.currentViewerRole ?? null,
    currentViewerStatus: options.currentViewerStatus ?? null,
    filters: options.filters,
    matchedOrdersCount: 0,
    orderDiscountOptions: [],
    orderTypeOptions: [],
    orders: [],
    pagination: getDashboardPaginationState(0, options.page, options.pageSize),
    purchaseOrderTypeOptions: [],
    serviceFeeTypeOptions: [],
    serviceOrderPriceOptions: [],
    serviceOrderTypeOptions: [],
    summary: {
      completed: 0,
      pending: 0,
      total: 0,
    },
    orderCurrencyRates: [],
    totalOrdersCount: 0,
    userOptions: [],
  };
}
