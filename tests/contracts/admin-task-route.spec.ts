import { expect, test } from "@playwright/test";

import { filterAdminTaskList } from "../../components/dashboard/admin-tasks/admin-task-list-filters";
import {
  buildAdminTasksRoute,
  parseAdminTasksSearchParams,
  updateAdminTaskFilterDraft,
} from "../../lib/admin-task-route";
import type { AdminTaskRow } from "../../lib/admin-tasks-types";

const pathname = "/admin/tourism/tasks";

test("同一轮清空搜索与角色时保留历史筛选并返回第一页", () => {
  const route = {
    ...parseAdminTasksSearchParams({ searchText: "海运", targetRole: "salesman", status: "completed", page: "4" }),
    routeKey: "route",
  };
  // 按 React 队列顺序执行一次重置触发的两个更新。
  const withoutSearch = updateAdminTaskFilterDraft(route, route, "searchText", "");
  const reset = updateAdminTaskFilterDraft(withoutSearch, route, "targetRole", "all");
  expect(reset).toMatchObject({ filters: { searchText: "", targetRole: "all", status: "completed" }, page: 1 });
  expect(buildAdminTasksRoute(pathname, "tab=reviews&tag=one&tag=two&page=4&searchText=old", reset))
    .toBe(pathname + "?tab=reviews&tag=one&tag=two&status=completed");
});

test("地址切换后从新地址读取初值，编码和页码可以往返", () => {
  const old = { ...parseAdminTasksSearchParams({ searchText: "old", status: "completed" }), routeKey: "old" };
  const route = { ...parseAdminTasksSearchParams({ searchText: [" 海运 & 文档 ", "ignored"], page: "0" }), routeKey: "new" };
  const updated = updateAdminTaskFilterDraft(old, route, "targetRole", "operator");
  expect(updated.filters).toEqual({ searchText: "海运 & 文档", targetRole: "operator", status: "all" });
  const href = buildAdminTasksRoute(pathname, "tab=media-library", { ...updated, page: 2 });
  const params = new URL(href, "http://localhost").searchParams;
  expect(params.get("tab")).toBe("media-library");
  expect(parseAdminTasksSearchParams(Object.fromEntries(params))).toEqual({ filters: updated.filters, page: 2 });
});

test("任务列表依据领取记录识别审核中，并结合目标角色与搜索", () => {
  const base = {
    id: "one",
    task_name: "海运资料",
    task_type_label: "Logistics",
    target_roles: ["operator"],
    accepted_count: 1,
    completed_count: 0,
    acceptance_assignees: [{ task_status: "reviewing" }],
  } as AdminTaskRow;
  const otherRole = { ...base, id: "two", target_roles: ["salesman"] } as AdminTaskRow;
  const completed = { ...base, id: "three", completed_count: 1, acceptance_assignees: [] };
  const tasks = [base, otherRole, completed];
  const t = (key: string) => key;

  expect(filterAdminTaskList(tasks, { searchText: " LOGISTICS ", targetRole: "operator", status: "reviewing" }, t))
    .toEqual([base]);
  expect(filterAdminTaskList(tasks, { searchText: "", targetRole: "all", status: "completed" }, t))
    .toEqual([completed]);
  expect(filterAdminTaskList(tasks, { searchText: "", targetRole: "all", status: "to_be_accepted" }, t))
    .toEqual([]);
});
