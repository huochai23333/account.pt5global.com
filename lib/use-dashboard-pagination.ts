"use client";

import { useCallback, useMemo, useState } from "react";

import {
  DEFAULT_DASHBOARD_PAGE_SIZE,
  paginateDashboardItems,
} from "./dashboard-pagination";

export function useDashboardPagination<T>(
  items: T[],
  pageSize = DEFAULT_DASHBOARD_PAGE_SIZE,
  queryKey = "",
) {
  const [page, setPage] = useState(1);
  const [previousQueryKey, setPreviousQueryKey] = useState(queryKey);
  // 筛选变化必须立即回到第一页；不能先用旧页码渲染一次新结果。
  if (previousQueryKey !== queryKey) {
    setPreviousQueryKey(queryKey);
    setPage(1);
  }
  const pagination = useMemo(
    () => paginateDashboardItems(items, page, pageSize),
    [items, page, pageSize],
  );
  const goToNextPage = useCallback(
    () => setPage(Math.min(pagination.pageCount, pagination.page + 1)),
    [pagination.page, pagination.pageCount],
  );
  const goToPreviousPage = useCallback(
    () => setPage(Math.max(1, pagination.page - 1)),
    [pagination.page],
  );

  return {
    ...pagination,
    goToNextPage,
    goToPreviousPage,
    setPage,
  };
}
