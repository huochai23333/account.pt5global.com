import { normalizeOptionalString } from "./value-normalizers";

export type SalesmanTaskFocusFilter =
  | "all"
  | "available"
  | "in_progress"
  | "reviewing"
  | "rejected"
  | "completed";

export type SalesmanTasksFilters = {
  searchText: string;
  focus: SalesmanTaskFocusFilter;
};

export type SalesmanTasksSearchParams = {
  filters: SalesmanTasksFilters;
  page: number;
};

export function parseSalesmanTasksSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): SalesmanTasksSearchParams {
  const focus = firstValue(searchParams.focus);
  const page = Number.parseInt(firstValue(searchParams.page) ?? "", 10);

  // 服务端用同一份默认值接收直接访问、刷新以及客户端更新后的地址。
  return {
    filters: {
      searchText: normalizeOptionalString(firstValue(searchParams.searchText)) ?? "",
      focus:
        focus === "available" ||
        focus === "in_progress" ||
        focus === "reviewing" ||
        focus === "rejected" ||
        focus === "completed"
          ? focus
          : "all",
    },
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function buildSalesmanTasksRoute(
  pathname: string,
  currentQuery: string,
  { filters, page }: SalesmanTasksSearchParams,
) {
  // 只维护任务看板自己的参数，其余地址参数由原入口保留。
  const query = new URLSearchParams(currentQuery);
  setQueryValue(query, "searchText", filters.searchText);
  setQueryValue(query, "focus", filters.focus === "all" ? "" : filters.focus);
  setQueryValue(query, "page", page > 1 ? String(page) : "");
  const nextQuery = query.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function setQueryValue(query: URLSearchParams, key: string, value: string) {
  if (value) query.set(key, value);
  else query.delete(key);
}
