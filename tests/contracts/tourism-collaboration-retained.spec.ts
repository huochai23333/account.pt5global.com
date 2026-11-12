import { expect, test } from "@playwright/test";

import {
  applyTeamManagementReadback,
  createTeamManagementDataState,
  getTeamManagementDataKey,
} from "../../components/dashboard/team-management/team-management-view-model-shared";
import type { TeamManagementPageData, TeamOverview } from "../../lib/team-management-types";
import type { AdminPersonRow } from "../../lib/admin-people-contract";
import { filterTourismPeople, isTourismCustomer, isTourismPromoter } from "../../components/dashboard/tourism-people/tourism-people-display";
import { filterSalesmanTaskList } from "../../components/dashboard/salesman-tasks/salesman-task-list-filters";
import { buildSalesmanTasksRoute, parseSalesmanTasksSearchParams } from "../../lib/salesman-task-route";
import type { SalesmanTaskRow } from "../../lib/salesman-tasks";

function pageData(teamId: string): TeamManagementPageData {
  const team: TeamOverview = {
    team_id: teamId, team_name: `Team ${teamId}`, manager_user_id: null,
    manager_name: null, manager_email: null, member_count: 0,
    active_member_count: 0, client_count: 0, vip_client_count: 0,
    last_member_joined_at: null, can_manage: true,
  };
  return {
    viewerRole: "administrator", viewerStatus: "active", canView: true,
    overviews: [team], detail: { team, members: [], clients: [] }, selectedTeamId: teamId,
    candidateSalesmen: [], managerCandidates: [], createManagerCandidates: [],
  };
}

test("切换后的团队继续归属当前服务端快照", () => {
  const initial = pageData("A");
  const current = createTeamManagementDataState(initial);
  const selected = applyTeamManagementReadback(current, getTeamManagementDataKey(initial), pageData("B"));
  // 原来的做法从读回结果重新生成快照标识，视图下一次渲染就回退到 A。
  expect(selected.dataKey).toBe(current.dataKey);
  expect(selected.selectedTeamId).toBe("B");
  expect(selected.teamNameDraft).toBe("Team B");
});

test("旧快照的晚到读回不能覆盖更新的团队状态", () => {
  const original = pageData("A");
  const latest = createTeamManagementDataState(pageData("C"));
  expect(applyTeamManagementReadback(latest, getTeamManagementDataKey(original), pageData("B"))).toBe(latest);
});

test("旅游目录各自先选岗位，再共用团队名称与账号状态筛选", () => {
  const promoter = { role: "promoter", status: "active", team_name: "Example Team" } as AdminPersonRow;
  const customer = { role: "client", status: "inactive", team_name: "Example Team", workspace_business_access: ["tourism"] } as AdminPersonRow;
  const wholesale = { ...customer, workspace_business_access: ["wholesale"] } as AdminPersonRow;
  const people = [promoter, customer, wholesale];

  // 同名团队不能扩大角色或业务范围，检索只在调用方已经选定的记录里生效。
  expect(filterTourismPeople(people.filter(isTourismPromoter), "  EXAMPLE  TEAM ", "active")).toEqual([promoter]);
  expect(filterTourismPeople(people.filter(isTourismCustomer), "team", "all")).toEqual([customer]);
  expect(filterTourismPeople(people.filter(isTourismCustomer), "team", "active")).toEqual([]);
});

test("任务页地址保留外部参数并省略默认筛选", () => {
  const pathname = "/salesman/tourism/tasks";
  const view = parseSalesmanTasksSearchParams({
    searchText: ["  海运 & 文件  ", "ignored"],
    focus: "reviewing",
    page: "3",
  });
  const route = buildSalesmanTasksRoute(pathname, "keep=1&keep=2", view);
  const query = new URL(route, "http://localhost").searchParams;
  expect(query.getAll("keep")).toEqual(["1", "2"]);
  expect(parseSalesmanTasksSearchParams(Object.fromEntries(query))).toEqual(view);

  // 手输不支持的栏目或页码时，刷新也会恢复看板的默认视图。
  const defaults = parseSalesmanTasksSearchParams({ focus: "unknown", page: "0" });
  expect(defaults).toEqual({ filters: { searchText: "", focus: "all" }, page: 1 });
  expect(buildSalesmanTasksRoute(pathname, "searchText=old&focus=available&page=9", defaults)).toBe(pathname);
});

test("任务筛选区分可领取、个人进度与已完成记录", () => {
  const task = (
    id: string,
    status: SalesmanTaskRow["status"],
    acceptedBy: string | null,
  ) => ({
    id,
    status,
    accepted_by_user_id: acceptedBy,
    task_name: "海运任务",
    task_type_label: "Logistics",
    review_reject_reason: id === "rejected" ? "Photo unclear" : null,
  }) as SalesmanTaskRow;
  const tasks = [
    task("available", "to_be_accepted", null),
    task("own", "accepted", "viewer"),
    task("other", "accepted", "other"),
    task("reviewing", "reviewing", "viewer"),
    task("rejected", "rejected", "viewer"),
    task("completed", "completed", "viewer"),
  ];
  const ids = (focus: Parameters<typeof filterSalesmanTaskList>[2], search = "") =>
    filterSalesmanTaskList(tasks, search, focus, "viewer").map((row) => row.id);

  // 客户端筛选只缩小当前已加载的集合，领取记录仍由数据库决定是否可见。
  expect(ids("all")).toEqual(["available", "own", "other", "reviewing", "rejected"]);
  expect(ids("available", " LOGISTICS ")).toEqual(["available"]);
  expect(ids("in_progress")).toEqual(["own"]);
  expect(ids("reviewing")).toEqual(["reviewing"]);
  expect(ids("rejected", "photo unclear")).toEqual(["rejected"]);
  expect(ids("completed")).toEqual(["completed"]);
});
