import {
  ADMIN_PEOPLE_CITY_MAX_LENGTH,
  isAdminPeopleRole,
  isAdminPeopleStatus,
  type AdminPersonAccountUpdatePayload,
  type AdminPersonRow,
} from "./admin-people";
import { AdminPeopleMutationError } from "./admin-people-mutation-errors";
import type { SalesmanBusinessBoard } from "./salesman-business-access";
import {
  getDefaultWorkspaceBusinessAccessForRole,
  isWorkspaceBusinessAccessKey,
  uniqueWorkspaceBusinessAccess,
  type WorkspaceBusinessKey,
} from "./workspace-business-access";

export function normalizeAdminPersonAccountUpdatePayload(
  input: AdminPersonAccountUpdatePayload,
): AdminPersonAccountUpdatePayload {
  const targetUserId =
    typeof input.targetUserId === "string" ? input.targetUserId.trim() : "";
  const note =
    typeof input.note === "string" && input.note.trim().length > 0
      ? input.note.trim().slice(0, 500)
      : null;
  const nextCity = normalizeAccountCity(input.nextCity);

  if (
    !targetUserId ||
    !isAdminPeopleRole(input.nextRole) ||
    !isAdminPeopleStatus(input.nextStatus) ||
    !input.expected ||
    !isAdminPeopleStatus(input.expected.status) ||
    !(input.expected.role === null || isAdminPeopleRole(input.expected.role)) ||
    !Array.isArray(input.expected.workspace_business_access) ||
    !Array.isArray(input.expected.salesman_business_boards)
  ) {
    throw new AdminPeopleMutationError("invalidInput");
  }

  return {
    targetUserId,
    expected: input.expected,
    nextRole: input.nextRole,
    nextStatus: input.nextStatus,
    nextCity,
    salesmanBusinessBoards:
      input.salesmanBusinessBoards === null ||
      input.salesmanBusinessBoards === undefined
        ? null
        : input.salesmanBusinessBoards,
    workspaceBusinessAccess:
      input.workspaceBusinessAccess === null ||
      input.workspaceBusinessAccess === undefined
        ? null
        : normalizeInputWorkspaceBusinessAccess(input.workspaceBusinessAccess),
    note,
  };
}

export function resolveWorkspaceBusinessAccessForUpdate(
  currentPerson: AdminPersonRow,
  input: AdminPersonAccountUpdatePayload,
): WorkspaceBusinessKey[] {
  if (isFixedWorkspaceBusinessAccessRole(input.nextRole)) {
    return getDefaultWorkspaceBusinessAccessForRole(input.nextRole);
  }
  if (!input.workspaceBusinessAccess) {
    if (currentPerson.role !== input.nextRole) {
      return getDefaultWorkspaceBusinessAccessForRole(input.nextRole);
    }
    return currentPerson.workspace_business_access.length > 0
      ? uniqueWorkspaceBusinessAccess(currentPerson.workspace_business_access)
      : getDefaultWorkspaceBusinessAccessForRole(input.nextRole);
  }
  return uniqueWorkspaceBusinessAccess(input.workspaceBusinessAccess);
}

export function getSalesmanBusinessBoardsForRole(
  nextRole: AdminPersonAccountUpdatePayload["nextRole"],
): SalesmanBusinessBoard[] {
  if (nextRole === "salesman") return ["wholesale"];
  // 地推账号仍可保留角色并登录，但停用期间不再分配旅游业务候选项。
  if (nextRole === "promoter") return [];
  return [];
}

export function normalizeAccountCity(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, ADMIN_PEOPLE_CITY_MAX_LENGTH);
  return normalized.length > 0 ? normalized : null;
}

function normalizeInputWorkspaceBusinessAccess(
  value: unknown,
): WorkspaceBusinessKey[] {
  if (!Array.isArray(value) || !value.every(isWorkspaceBusinessAccessKey)) {
    throw new AdminPeopleMutationError("invalidInput");
  }
  return uniqueWorkspaceBusinessAccess(value);
}

function isFixedWorkspaceBusinessAccessRole(role: string) {
  // 这些角色的业务范围由产品规则固定，不能用表单提交的数组绕过。
  return role === "administrator" || role === "salesman" || role === "promoter";
}
