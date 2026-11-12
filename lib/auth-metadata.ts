import type { AppRole } from "./auth-routing";
import { normalizeOptionalString } from "./value-normalizers";

export type UserStatus = "inactive" | "active" | "suspended";

export const APP_ROLES = [
  "administrator",
  "operator",
  "manager",
  "recruiter",
  "salesman",
  "promoter",
  "finance",
  "client",
] as const satisfies readonly AppRole[];

export const USER_STATUSES = [
  "inactive",
  "active",
  "suspended",
] as const satisfies readonly UserStatus[];

const APP_ROLE_SET = new Set<AppRole>(APP_ROLES);
const USER_STATUS_SET = new Set<UserStatus>(USER_STATUSES);

export function normalizeAppRole(value: unknown): AppRole | null {
  const role = normalizeOptionalString(value);
  return role && APP_ROLE_SET.has(role as AppRole) ? (role as AppRole) : null;
}

export function normalizeUserStatus(value: unknown): UserStatus | null {
  const status = normalizeOptionalString(value);
  return status && USER_STATUS_SET.has(status as UserStatus)
    ? (status as UserStatus)
    : null;
}

export function getAppRoleFromMetadataContainer(value: unknown): AppRole | null {
  return normalizeAppRole(getAppMetadata(value)?.role);
}

export function getUserStatusFromMetadataContainer(value: unknown): UserStatus | null {
  return normalizeUserStatus(getAppMetadata(value)?.status);
}

// 只读取服务端管理的 app_metadata，绝不把用户可编辑的 user_metadata 当作岗位或状态。
function getAppMetadata(value: unknown) {
  const record = readRecord(value);

  if (!record) {
    return null;
  }

  return readRecord(record.app_metadata) ?? readRecord(record.appMetadata);
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}
