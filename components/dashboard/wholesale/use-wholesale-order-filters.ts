"use client";

import { useDeferredValue, useMemo, useState } from "react";

import {
  getDefaultOrderDateRange,
  getOrderDatePresetRange,
  isOrderDateValue,
  type OrderDatePreset,
} from "@/lib/order-date-range";
import type { WholesaleOrderFilters } from "@/lib/wholesale-order-page";

export function createDefaultWholesaleOrderFilters(): WholesaleOrderFilters {
  const range = getDefaultOrderDateRange();

  return {
    customerId: "",
    orderMonth: "",
    orderedFromDate: range.fromDate,
    orderedToDate: range.toDate,
    salesUserId: "",
    searchText: "",
    searchMode: "date_range",
    status: "all",
  };
}

/**
 * 页面只通过这个 hook 管理筛选。搜索文字使用延迟值，用户连续输入时不会每个按键都发请求。
 */
export function useWholesaleOrderFilters() {
  const [filters, setFilters] = useState<WholesaleOrderFilters>(() =>
    createDefaultWholesaleOrderFilters(),
  );
  const deferredSearchText = useDeferredValue(filters.searchText);
  const queryFilters = useMemo(
    () => ({
      ...filters,
      searchText:
        filters.searchMode === "exact_all_time"
          ? filters.searchText.trim()
          : deferredSearchText.trim(),
    }),
    [deferredSearchText, filters],
  );
  const hasActiveFilters = useMemo(
    () => JSON.stringify(filters) !== JSON.stringify(createDefaultWholesaleOrderFilters()),
    [filters],
  );

  const updateFilter = <Key extends keyof WholesaleOrderFilters>(
    key: Key,
    value: WholesaleOrderFilters[Key],
  ) => {
    setFilters((current) => {
      if (
        (key === "orderedFromDate" || key === "orderedToDate") &&
        !isOrderDateValue(value)
      ) {
        return current;
      }

      const next = {
        ...current,
        [key]: value,
        ...(key === "searchMode" ? {} : { searchMode: "date_range" as const }),
      };

      if (key === "orderedFromDate" && next.orderedFromDate > next.orderedToDate) {
        next.orderedToDate = next.orderedFromDate;
      }
      if (key === "orderedToDate" && next.orderedToDate < next.orderedFromDate) {
        next.orderedFromDate = next.orderedToDate;
      }

      return next;
    });
  };

  return {
    activateExactSearch: () => {
      if (!filters.searchText.trim()) return;
      setFilters((current) => ({
        ...current,
        searchMode: "exact_all_time",
        searchText: current.searchText.trim(),
      }));
    },
    applyDatePreset: (preset: Exclude<OrderDatePreset, "custom">) => {
      const range = getOrderDatePresetRange(preset);
      setFilters((current) => ({
        ...current,
        orderedFromDate: range.fromDate,
        orderedToDate: range.toDate,
        searchMode: "date_range",
      }));
    },
    clearFilters: () => setFilters(createDefaultWholesaleOrderFilters()),
    exitExactSearch: () =>
      setFilters((current) => ({
        ...current,
        searchMode: "date_range",
        searchText: "",
      })),
    filters,
    hasActiveFilters,
    queryFilters,
    updateFilter,
  };
}
