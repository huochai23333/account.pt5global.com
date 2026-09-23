import { normalizeSearchText } from "@/lib/value-normalizers";

import type {
  WholesaleOrderAssessmentData,
  WholesaleOrderAssessmentFilters,
} from "./wholesale-order-assessment-types";

const ALL = "all";
const MAX_SEARCH_LENGTH = 80;

/**
 * 浏览器提交的内容不能直接用于查询或提示词。
 * 这里限制长度、日期格式和状态枚举，保证后面的筛选只接收可预测的数据。
 */
export function normalizeWholesaleOrderAssessmentPayload(
  value: unknown,
): WholesaleOrderAssessmentFilters {
  if (!isRecord(value) || !isRecord(value.filters)) {
    throw new Error("invalid payload");
  }

  const filters = value.filters;
  return {
    customerId: normalizeIdFilter(filters.customerId),
    orderMonth: normalizeMonthFilter(filters.orderMonth),
    orderedFromDate: normalizeDateFilter(filters.orderedFromDate),
    orderedToDate: normalizeDateFilter(filters.orderedToDate),
    salesUserId: normalizeIdFilter(filters.salesUserId),
    searchText: normalizeString(filters.searchText, MAX_SEARCH_LENGTH),
    status: normalizeStatusFilter(filters.status),
  };
}

/** 按页面筛选条件从当前用户可见的数据里选出本次评估范围。 */
export function filterWholesaleOrdersForAssessment(
  data: WholesaleOrderAssessmentData,
  filters: WholesaleOrderAssessmentFilters,
) {
  const customersById = new Map(
    data.customers.map((customer) => [customer.id, customer]),
  );
  const profilesById = new Map(
    data.profiles.map((profile) => [profile.user_id, profile]),
  );
  const purchaseOrdersByOrderId = groupByWholesaleOrderId(
    data.orderPage?.purchaseOrders ?? [],
  );
  const searchValue = normalizeSearchText(filters.searchText);
  const orderedFromTime = getDateBoundaryTime(filters.orderedFromDate, "start");
  const orderedToTime = getDateBoundaryTime(filters.orderedToDate, "end");

  return data.orders.filter((order) => {
    if (filters.orderMonth && order.order_month.slice(0, 7) !== filters.orderMonth) {
      return false;
    }
    if (filters.status !== ALL && order.status !== filters.status) return false;
    if (filters.customerId !== ALL && order.customer_id !== filters.customerId) {
      return false;
    }
    if (
      filters.salesUserId !== ALL &&
      (order.sales_user_id ?? "") !== filters.salesUserId
    ) {
      return false;
    }
    if (!isDateWithinRange(order.ordered_at, orderedFromTime, orderedToTime)) {
      return false;
    }
    if (!searchValue) return true;

    const customerName =
      customersById.get(order.customer_id)?.unique_name ?? "未归属客户";
    const salesProfile = order.sales_user_id
      ? profilesById.get(order.sales_user_id)
      : null;
    const salesName = salesProfile?.name || salesProfile?.email || "未分配";
    const linkedPurchaseOrders = purchaseOrdersByOrderId.get(order.id) ?? [];

    return [
      order.order_number,
      customerName,
      salesName,
      order.courier_company ?? "",
      order.payment_platform ?? "",
      order.notes ?? "",
      ...linkedPurchaseOrders.flatMap((row) => [
        row.external_order_number,
        row.item_summary ?? "",
        row.seller_name ?? "",
      ]),
    ].some((text) => normalizeSearchText(text).includes(searchValue));
  });
}

function groupByWholesaleOrderId<
  Row extends { wholesale_order_id: string | null },
>(rows: Row[]) {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    if (!row.wholesale_order_id) continue;
    const current = grouped.get(row.wholesale_order_id) ?? [];
    current.push(row);
    grouped.set(row.wholesale_order_id, current);
  }
  return grouped;
}

function getDateBoundaryTime(value: string, boundary: "start" | "end") {
  if (!value) return null;
  const suffix = boundary === "start" ? "T00:00:00" : "T23:59:59.999";
  const time = new Date(`${value}${suffix}`).getTime();
  return Number.isFinite(time) ? time : null;
}

function isDateWithinRange(
  value: string | null | undefined,
  fromTime: number | null,
  toTime: number | null,
) {
  if (fromTime === null && toTime === null) return true;
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return (
    (fromTime === null || time >= fromTime) &&
    (toTime === null || time <= toTime)
  );
}

function normalizeIdFilter(value: unknown) {
  return normalizeString(value, 80) || ALL;
}

function normalizeStatusFilter(value: unknown) {
  return value === "settled" ||
    value === "partial_settled" ||
    value === "unsettled"
    ? value
    : ALL;
}

function normalizeDateFilter(value: unknown) {
  const normalized = normalizeString(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function normalizeMonthFilter(value: unknown) {
  const normalized = normalizeString(value, 7);
  if (!normalized) return "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)) {
    throw new Error("invalid order month");
  }
  return normalized;
}

function normalizeString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
