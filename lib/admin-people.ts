import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppRole } from "./auth-routing";
import { normalizeAppRole, normalizeUserStatus } from "./auth-metadata";
import { withRequestTimeout } from "./request-timeout";
import { getPendingAuthMetadataUserIds } from "./admin-people-auth-metadata";
import { type UserStatus, getCurrentSessionContext } from "./user-self-service";
import { normalizeInteger, normalizeOptionalString } from "./value-normalizers";
import {
  normalizeSalesmanBusinessBoards,
  type SalesmanBusinessBoard,
} from "./salesman-business-access";
import {
  normalizeWorkspaceBusinessAccess,
  type WorkspaceBusinessKey,
} from "./workspace-business-access";

export const ADMIN_PEOPLE_ROLE_OPTIONS = [
  "administrator",
  "manager",
  "operator",
  "recruiter",
  "salesman",
  "promoter",
  "finance",
  "client",
] as const satisfies readonly AppRole[];

export const ADMIN_PEOPLE_STATUS_OPTIONS = [
  "active",
  "inactive",
  "suspended",
] as const satisfies readonly UserStatus[];

export const ADMIN_PEOPLE_CITY_MAX_LENGTH = 80;

export type AdminPeopleRole = (typeof ADMIN_PEOPLE_ROLE_OPTIONS)[number];
export type AdminPeopleStatus = (typeof ADMIN_PEOPLE_STATUS_OPTIONS)[number];
export type CustomerTypeMark = "retail";

export const CUSTOMER_TYPE_MARK_OPTIONS = [
  "retail",
] as const satisfies readonly CustomerTypeMark[];

export type AdminPersonRow = {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: UserStatus;
  role: AppRole | null;
  referral_code: string | null;
  referrer_user_id: string | null;
  referrer_name: string | null;
  referrer_email: string | null;
  team_id: string | null;
  team_name: string | null;
  direct_referral_count: number;
  latest_change_at: string | null;
  created_at: string;
  private_note: string | null;
  customer_type: CustomerTypeMark | null;
  customer_type_marked_by_user_id: string | null;
  customer_type_marked_by_name: string | null;
  customer_type_marked_at: string | null;
  salesman_business_boards: SalesmanBusinessBoard[];
  workspace_business_access: WorkspaceBusinessKey[];
};

export type AdminPeopleChangeLogRow = {
  id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  target_user_id: string;
  target_name: string | null;
  target_email: string | null;
  previous_role: AppRole | null;
  next_role: AppRole | null;
  previous_status: UserStatus | null;
  next_status: UserStatus;
  previous_city: string | null;
  next_city: string | null;
  note: string | null;
  created_at: string;
};

export type AdminPeoplePageData = {
  hasPermission: boolean;
  currentViewerId: string | null;
  people: AdminPersonRow[];
  recentChanges: AdminPeopleChangeLogRow[];
  pendingAuthSyncUserIds: string[];
};

export type AdminPersonAccountUpdatePayload = {
  targetUserId: string;
  expected: Pick<AdminPersonRow, "role" | "status" | "city" | "workspace_business_access" | "salesman_business_boards">;
  nextRole: AdminPeopleRole;
  nextStatus: AdminPeopleStatus;
  nextCity?: string | null;
  salesmanBusinessBoards?: SalesmanBusinessBoard[] | null;
  workspaceBusinessAccess?: WorkspaceBusinessKey[] | null;
  note?: string | null;
};

const ADMIN_PEOPLE_CHANGE_LOG_LIMIT = 10;

export function canViewAdminPeople(
  role: AppRole | null,
  status: UserStatus | null,
) {
  return role === "administrator" && status === "active";
}

export function isAdminPeopleRole(value: unknown): value is AdminPeopleRole {
  return normalizeAppRole(value) !== null;
}

export function isAdminPeopleStatus(
  value: unknown,
): value is AdminPeopleStatus {
  return normalizeUserStatus(value) !== null;
}

export function isCustomerTypeMark(value: unknown): value is CustomerTypeMark {
  return value === "retail";
}

export async function getAdminPeoplePageData(
  supabase: SupabaseClient,
): Promise<AdminPeoplePageData> {
  const sessionContext = await getCurrentSessionContext(supabase);

  if (
    !sessionContext.user ||
    !canViewAdminPeople(sessionContext.role, sessionContext.status)
  ) {
    return createEmptyAdminPeoplePageData(sessionContext.user?.id ?? null);
  }

  const [people, recentChanges, pendingAuthSyncUserIds] = await Promise.all([
    getAdminPeopleDirectory(supabase),
    getAdminPeopleChangeLogs(supabase, ADMIN_PEOPLE_CHANGE_LOG_LIMIT),
    getPendingAuthMetadataUserIds(),
  ]);

  return {
    hasPermission: true,
    currentViewerId: sessionContext.user.id,
    people,
    recentChanges,
    pendingAuthSyncUserIds,
  };
}

export async function getAdminPeopleDirectory(
  supabase: SupabaseClient,
): Promise<AdminPersonRow[]> {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("get_admin_people_directory"),
  );

  if (error) {
    throw error;
  }

  return normalizeAdminPeopleRows(data);
}

export async function getAdminPersonRowById(
  supabase: SupabaseClient,
  userId: string,
): Promise<AdminPersonRow | null> {
  const rows = await getAdminPeopleDirectory(supabase);

  return rows.find((row) => row.user_id === userId) ?? null;
}

export async function getAdminPeopleChangeLogs(
  supabase: SupabaseClient,
  limit = ADMIN_PEOPLE_CHANGE_LOG_LIMIT,
): Promise<AdminPeopleChangeLogRow[]> {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("get_admin_people_change_logs", {
      _limit: limit,
    }),
  );

  if (error) {
    throw error;
  }

  return normalizeAdminPeopleChangeLogRows(data);
}

function createEmptyAdminPeoplePageData(
  currentViewerId: string | null,
): AdminPeoplePageData {
  return {
    hasPermission: false,
    currentViewerId,
    people: [],
    recentChanges: [],
    pendingAuthSyncUserIds: [],
  };
}

function normalizeAdminPeopleRows(value: unknown): AdminPersonRow[] {
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

function normalizeAdminPeopleChangeLogRows(
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
