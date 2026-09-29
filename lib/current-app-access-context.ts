import type { SupabaseClient } from "@supabase/supabase-js";

import {
  normalizeAppRole,
  normalizeUserStatus,
  type UserStatus,
} from "./auth-metadata";
import type { AppRole } from "./auth-routing";

export type CurrentAppAccessContext = {
  role: AppRole | null;
  status: UserStatus | null;
};

/**
 * 从数据库读取当前账号真正生效的角色和状态。
 *
 * 管理员修改账号后，Auth 元数据可能因为网络或服务凭据问题没有及时更新。工作台跳转和权限判断
 * 必须使用数据库里的最新结果，不能在查询失败时退回旧元数据继续放行。
 */
export async function getCurrentAppAccessContext(
  supabase: SupabaseClient,
): Promise<CurrentAppAccessContext> {
  const { data, error } = await supabase.rpc("get_current_app_access_context");

  if (error) {
    // 让调用页面进入现有的友好错误界面，避免把暂时的查询失败误判成客户角色。
    throw error;
  }

  const value = Array.isArray(data) ? data[0] : data;
  const accessContext = readRecord(value);

  return {
    role: normalizeAppRole(accessContext?.role),
    status: normalizeUserStatus(accessContext?.status),
  };
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}
