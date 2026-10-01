export const DEFAULT_DASHBOARD_PAGE_SIZE = 20;
export const MAX_DASHBOARD_QUERY_ROWS = 200;

/** 查询参数来自网址或表单，非有限数值不能参与范围计算。 */
export function normalizeDashboardPage(page: number) {
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export type DashboardPaginationSlice<T> = {
  endIndex: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  items: T[];
  page: number;
  pageCount: number;
  pageSize: number;
  startIndex: number;
  totalItems: number;
};

export type DashboardPaginationState = Omit<DashboardPaginationSlice<never>, "items">;

export function getDashboardQueryRange(limit = MAX_DASHBOARD_QUERY_ROWS) {
  const safeLimit = Math.max(1, Math.trunc(limit));

  return {
    from: 0,
    to: safeLimit - 1,
  };
}

export function getDashboardQueryRangeForPage(
  page: number,
  pageSize = DEFAULT_DASHBOARD_PAGE_SIZE,
) {
  const { page: safePage, pageSize: safePageSize } = getDashboardPaginationState(
    Number.MAX_SAFE_INTEGER,
    page,
    pageSize,
  );
  const from = (safePage - 1) * safePageSize;

  return {
    from,
    to: from + safePageSize - 1,
  };
}

export function getDashboardPaginationState(
  totalItems: number,
  page: number,
  pageSize = DEFAULT_DASHBOARD_PAGE_SIZE,
): DashboardPaginationState {
  const safeTotalItems = Number.isFinite(totalItems) ? Math.max(0, Math.trunc(totalItems)) : 0;
  const safePageSize = Number.isFinite(pageSize) ? Math.max(1, Math.trunc(pageSize)) : DEFAULT_DASHBOARD_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(safeTotalItems / safePageSize));
  const safePage = Math.min(normalizeDashboardPage(page), pageCount);

  if (safeTotalItems === 0) {
    return {
      endIndex: 0,
      hasNextPage: false,
      hasPreviousPage: false,
      page: 1,
      pageCount: 1,
      pageSize: safePageSize,
      startIndex: 0,
      totalItems: 0,
    };
  }

  const startOffset = (safePage - 1) * safePageSize;
  const endOffset = startOffset + safePageSize;

  return {
    endIndex: Math.min(safeTotalItems, endOffset),
    hasNextPage: safePage < pageCount,
    hasPreviousPage: safePage > 1,
    page: safePage,
    pageCount,
    pageSize: safePageSize,
    startIndex: startOffset + 1,
    totalItems: safeTotalItems,
  };
}

export function paginateDashboardItems<T>(
  items: T[],
  page: number,
  pageSize = DEFAULT_DASHBOARD_PAGE_SIZE,
): DashboardPaginationSlice<T> {
  const pagination = getDashboardPaginationState(items.length, page, pageSize);

  return {
    ...pagination,
    items:
      pagination.totalItems === 0
        ? []
        : items.slice(pagination.startIndex - 1, pagination.endIndex),
  };
}
