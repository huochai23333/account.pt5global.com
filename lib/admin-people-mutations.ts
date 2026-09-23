import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getAdminPersonRowById,
  type AdminPersonAccountUpdatePayload,
  type AdminPersonRow,
} from "./admin-people";
import { syncPendingTargetAuthMetadata } from "./admin-people-auth-metadata";
import {
  applyAdminPersonAccountBundle,
} from "./admin-people-mutation-database";
import { AdminPeopleMutationError } from "./admin-people-mutation-errors";
import {
  getSalesmanBusinessBoardsForRole,
  normalizeAccountCity,
  normalizeAdminPersonAccountUpdatePayload,
  resolveWorkspaceBusinessAccessForUpdate,
} from "./admin-people-mutation-input";
import { getCurrentSessionContext } from "./user-self-service";
import { areWorkspaceBusinessAccessListsEqual } from "./workspace-business-access";

export {
  AdminPeopleMutationError,
  getAdminPeopleUpdateErrorCode,
  type AdminPeopleUpdateErrorCode,
} from "./admin-people-mutation-errors";

/** 人员修改先核对页面快照，再由数据库事务提交核心变更和审计。 */
export async function updateAdminPersonAccount(
  supabase: SupabaseClient,
  input: AdminPersonAccountUpdatePayload,
): Promise<{ person: AdminPersonRow; outcome: "success" | "partial_failed" }> {
  const sessionContext = await getCurrentSessionContext(supabase);
  if (
    !sessionContext.user ||
    sessionContext.role !== "administrator" ||
    sessionContext.status !== "active"
  ) {
    throw new AdminPeopleMutationError("forbidden");
  }

  const payload = normalizeAdminPersonAccountUpdatePayload(input);
  const currentPerson = await getAdminPersonRowById(
    supabase,
    payload.targetUserId,
  );
  if (!currentPerson) throw new AdminPeopleMutationError("notFound");
  if (currentPerson.user_id === sessionContext.user.id) {
    throw new AdminPeopleMutationError("selfChange");
  }
  if (currentPerson.role !== payload.expected.role ||
    currentPerson.status !== payload.expected.status ||
    normalizeAccountCity(currentPerson.city) !== normalizeAccountCity(payload.expected.city) ||
    !areWorkspaceBusinessAccessListsEqual(currentPerson.workspace_business_access, payload.expected.workspace_business_access) ||
    [...currentPerson.salesman_business_boards].sort().join("|") !== [...payload.expected.salesman_business_boards].sort().join("|")) {
    throw new AdminPeopleMutationError("conflict");
  }

  const accountWillChange =
    currentPerson.role !== payload.nextRole ||
    currentPerson.status !== payload.nextStatus;
  const cityWillChange =
    normalizeAccountCity(currentPerson.city) !== payload.nextCity;
  const workspaceBusinessAccess = resolveWorkspaceBusinessAccessForUpdate(
    currentPerson,
    payload,
  );
  const businessAccessWillChange =
    !areWorkspaceBusinessAccessListsEqual(
      currentPerson.workspace_business_access,
      workspaceBusinessAccess,
    );
  if (!accountWillChange && !cityWillChange && !businessAccessWillChange) {
    throw new AdminPeopleMutationError("noChange");
  }

  const receipt = await applyAdminPersonAccountBundle(supabase, payload, workspaceBusinessAccess);
  const expectedBoards = getSalesmanBusinessBoardsForRole(payload.nextRole);
  if (!receipt.logId || receipt.targetUserId !== payload.targetUserId ||
    receipt.role !== payload.nextRole || receipt.status !== payload.nextStatus ||
    normalizeAccountCity(receipt.city) !== payload.nextCity ||
    !areWorkspaceBusinessAccessListsEqual(receipt.workspaceBusinessAccess, workspaceBusinessAccess) ||
    [...receipt.salesmanBusinessBoards].sort().join("|") !== [...expectedBoards].sort().join("|")) {
    throw new AdminPeopleMutationError("unknown");
  }

  const updatedPerson = await getAdminPersonRowById(
    supabase,
    payload.targetUserId,
  );
  if (!updatedPerson || updatedPerson.role !== payload.nextRole ||
    updatedPerson.status !== payload.nextStatus ||
    normalizeAccountCity(updatedPerson.city) !== payload.nextCity ||
    !areWorkspaceBusinessAccessListsEqual(updatedPerson.workspace_business_access, workspaceBusinessAccess)) {
    throw new AdminPeopleMutationError("unknown");
  }
  const authSynced = !receipt.authSyncRequired || await syncPendingTargetAuthMetadata(payload.targetUserId);
  return { person: updatedPerson, outcome: authSynced ? "success" : "partial_failed" };
}
