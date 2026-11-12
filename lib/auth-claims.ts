import type { AppRole } from "./auth-routing";
import {
  getAppRoleFromMetadataContainer,
  getUserStatusFromMetadataContainer,
  type UserStatus,
} from "./auth-metadata";
import { normalizeOptionalString } from "./value-normalizers";

// 提取仅约束数据形状；调用方负责先验证令牌或用户身份，不能只凭 sub 字段授权。
export function getAuthClaimsUserId(claims: unknown) {
  return normalizeOptionalString(readRecord(claims)?.sub);
}

export function getAppRoleFromClaims(claims: unknown): AppRole | null {
  return getAppRoleFromMetadataContainer(claims);
}

export function getUserStatusFromClaims(claims: unknown): UserStatus | null {
  return getUserStatusFromMetadataContainer(claims);
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}
