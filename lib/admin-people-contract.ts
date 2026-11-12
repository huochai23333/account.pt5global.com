import type { AppRole } from "./auth-routing";
import { normalizeAppRole, normalizeUserStatus } from "./auth-metadata";
import type { SalesmanBusinessBoard } from "./salesman-business-access";
import type { UserStatus } from "./user-self-service";
import type { WorkspaceBusinessKey } from "./workspace-business-access";

// 账号表单和服务端查询共用字段合同。这个文件只提供类型、选项与校验。
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
