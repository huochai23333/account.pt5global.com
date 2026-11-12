import { normalizeAppRole, normalizeUserStatus } from "./auth-metadata";
import {
  isCustomerTypeMark,
  type AdminPeopleChangeLogRow,
  type AdminPersonRow,
  type CustomerTypeMark,
} from "./admin-people-contract";
import { normalizeSalesmanBusinessBoards } from "./salesman-business-access";
import { normalizeInteger, normalizeOptionalString } from "./value-normalizers";
import { normalizeWorkspaceBusinessAccess } from "./workspace-business-access";

// 查询结果在这里转为页面行；缺少关键编号或状态的记录不能进入页面。
export function normalizeAdminPeopleRows(value: unknown): AdminPersonRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeAdminPersonRow(item))
    .filter((item): item is AdminPersonRow => item !== null);
}

function normalizeAdminPersonRow(value: unknown): AdminPersonRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const userId = normalizeOptionalString(value.user_id);
  const status = normalizeUserStatus(value.status);
  const createdAt = normalizeOptionalString(value.created_at);

  if (!userId || !status || !createdAt) {
    return null;
  }

  return {
    user_id: userId,
    name: normalizeOptionalString(value.name),
    email: normalizeOptionalString(value.email),
    phone: normalizeOptionalString(value.phone),
    city: normalizeOptionalString(value.city),
    status,
    role: normalizeAppRole(value.role),
    referral_code: normalizeOptionalString(value.referral_code),
    referrer_user_id: normalizeOptionalString(value.referrer_user_id),
    referrer_name: normalizeOptionalString(value.referrer_name),
    referrer_email: normalizeOptionalString(value.referrer_email),
    team_id: normalizeOptionalString(value.team_id),
    team_name: normalizeOptionalString(value.team_name),
    direct_referral_count: normalizeInteger(value.direct_referral_count),
    latest_change_at: normalizeOptionalString(value.latest_change_at),
    created_at: createdAt,
    private_note: normalizeOptionalString(value.private_note),
    customer_type: normalizeCustomerTypeMark(value.customer_type),
    customer_type_marked_by_user_id: normalizeOptionalString(
      value.customer_type_marked_by_user_id,
    ),
    customer_type_marked_by_name: normalizeOptionalString(
      value.customer_type_marked_by_name,
    ),
    customer_type_marked_at: normalizeOptionalString(
      value.customer_type_marked_at,
    ),
    salesman_business_boards: normalizeSalesmanBusinessBoards(
      value.salesman_business_boards,
    ),
    workspace_business_access: normalizeWorkspaceBusinessAccess(
      value.workspace_business_access,
    ),
  };
}

function normalizeCustomerTypeMark(value: unknown): CustomerTypeMark | null {
  return isCustomerTypeMark(value) ? value : null;
}

export function normalizeAdminPeopleChangeLogRows(
  value: unknown,
): AdminPeopleChangeLogRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeAdminPeopleChangeLogRow(item))
    .filter((item): item is AdminPeopleChangeLogRow => item !== null);
}

function normalizeAdminPeopleChangeLogRow(
  value: unknown,
): AdminPeopleChangeLogRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeOptionalString(value.id);
  const targetUserId = normalizeOptionalString(value.target_user_id);
  const nextStatus = normalizeUserStatus(value.next_status);
  const createdAt = normalizeOptionalString(value.created_at);

  if (!id || !targetUserId || !nextStatus || !createdAt) {
    return null;
  }

  return {
    id,
    actor_user_id: normalizeOptionalString(value.actor_user_id),
    actor_name: normalizeOptionalString(value.actor_name),
    actor_email: normalizeOptionalString(value.actor_email),
    target_user_id: targetUserId,
    target_name: normalizeOptionalString(value.target_name),
    target_email: normalizeOptionalString(value.target_email),
    previous_role: normalizeAppRole(value.previous_role),
    next_role: normalizeAppRole(value.next_role),
    previous_status: normalizeUserStatus(value.previous_status),
    next_status: nextStatus,
    previous_city: normalizeOptionalString(value.previous_city),
    next_city: normalizeOptionalString(value.next_city),
    note: normalizeOptionalString(value.note),
    created_at: createdAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
