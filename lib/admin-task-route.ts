import { normalizeTaskStatus, normalizeTaskTargetRole } from "./admin-task-normalizers";
import type { AdminTasksFilters, AdminTasksSearchParams } from "./admin-tasks-types";
import { normalizeOptionalString } from "./value-normalizers";

export type AdminTaskRouteDraft = AdminTasksSearchParams & { routeKey: string };

export function parseAdminTasksSearchParams(
  params: Record<string, string | string[] | undefined>,
): AdminTasksSearchParams {
  const page = Number.parseInt(firstValue(params.page) ?? "", 10);
  return {
    filters: {
      searchText: normalizeOptionalString(firstValue(params.searchText)) ?? "",
      targetRole: normalizeTaskTargetRole(firstValue(params.targetRole)) ?? "all",
      status: normalizeTaskStatus(firstValue(params.status)) ?? "all",
    },
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function buildAdminTasksRoute(
  pathname: string,
  currentQuery: string,
  { filters, page }: AdminTasksSearchParams,
) {
  // 任务筛选只改自己的参数，审核和媒体库共用的 tab 等参数继续保留。
  const query = new URLSearchParams(currentQuery);
  setQueryValue(query, "searchText", filters.searchText);
  setQueryValue(query, "targetRole", filters.targetRole === "all" ? "" : filters.targetRole);
  setQueryValue(query, "status", filters.status === "all" ? "" : filters.status);
  setQueryValue(query, "page", page > 1 ? String(page) : "");
  const nextQuery = query.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export function updateAdminTaskFilterDraft<Key extends keyof AdminTasksFilters>(
  current: AdminTaskRouteDraft,
  route: AdminTaskRouteDraft,
  key: Key,
  value: AdminTasksFilters[Key],
): AdminTaskRouteDraft {
  // 连续更新以 React 队列里的草稿为准。换地址后改用该地址的服务端筛选。
  const base = current.routeKey === route.routeKey ? current : route;
  return {
    routeKey: route.routeKey,
    filters: { ...base.filters, [key]: value },
    page: 1,
  };
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function setQueryValue(query: URLSearchParams, key: string, value: string) {
  if (value) query.set(key, value);
  else query.delete(key);
}
