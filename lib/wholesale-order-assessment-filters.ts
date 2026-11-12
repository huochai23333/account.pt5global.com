import { normalizeOrderDateRange } from "./order-date-range";
import type { WholesaleOrderAssessmentFilters } from "./wholesale-order-assessment-types";

const MAX_SEARCH_LENGTH = 80;

/** 评估使用订单列表的筛选结构，日期由同一业务时区的公共工具校验。 */
export function normalizeWholesaleOrderAssessmentPayload(
  value: unknown,
): WholesaleOrderAssessmentFilters {
  if (!isRecord(value) || !isRecord(value.filters)) throw new Error("invalid payload");

  const filters = value.filters;
  const searchMode = filters.searchMode === "exact_all_time" ? "exact_all_time" : "date_range";
  const searchText = normalizeString(filters.searchText, MAX_SEARCH_LENGTH);
  if (searchMode === "exact_all_time" && !searchText) throw new Error("missing exact order number");

  const range = normalizeOrderDateRange({
    fromDate: normalizeString(filters.orderedFromDate, 10),
    toDate: normalizeString(filters.orderedToDate, 10),
  });
  return {
    customerId: normalizeIdFilter(filters.customerId),
    orderMonth: normalizeMonthFilter(filters.orderMonth),
    orderedFromDate: range.fromDate,
    orderedToDate: range.toDate,
    salesUserId: normalizeIdFilter(filters.salesUserId),
    searchMode,
    searchText,
    status: normalizeStatusFilter(filters.status),
  };
}

function normalizeIdFilter(value: unknown) {
  const id = normalizeString(value, 80);
  return id === "all" ? "" : id;
}

function normalizeStatusFilter(value: unknown) {
  return value === "settled" || value === "partial_settled" || value === "unsettled"
    ? value
    : "all";
}

function normalizeMonthFilter(value: unknown) {
  const month = normalizeString(value, 7);
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("invalid order month");
  }
  return month;
}

function normalizeString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
