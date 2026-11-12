import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { readAuthClaimsFromAccessToken } from "./auth-access-token";
import { getAppRoleFromClaims } from "./auth-claims";
import {
  getAppRoleFromMetadataContainer,
  normalizeAppRole,
} from "./auth-metadata";
import type { AppRole } from "./auth-routing";
import { withRequestTimeout } from "./request-timeout";

const AUTH_CONTEXT_TIMEOUT_MS = 8_000;
const AUTH_CONTEXT_TIMEOUT_MESSAGE = "登录状态同步较慢，请稍后重试。";

export { getDefaultSignedInPathForRole } from "./auth-routing";

export async function getAuthSession(supabase: SupabaseClient): Promise<Session | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}

function getRoleFromUser(user: User | null | undefined): AppRole | null {
  return getAppRoleFromMetadataContainer(user);
}

export function getRoleFromAuthSession(
  session: Pick<Session, "access_token" | "user"> | null | undefined,
): AppRole | null {
  return (
    getAppRoleFromClaims(readAuthClaimsFromAccessToken(session?.access_token)) ??
    getRoleFromUser(session?.user)
  );
}

// 浏览器恢复导航优先读取数据库；这里保留的 claims 分支仅辅助跳转，服务端准入仍严格读取当前权限。
export async function getRoleFromAuthClaims(
  supabase: SupabaseClient,
  fallbackUser?: User | null,
): Promise<AppRole | null> {
  const fallbackRole = getRoleFromUser(fallbackUser);
  const accessContextRole = await getRoleFromCurrentAccessContext(supabase);

  if (accessContextRole) {
    return accessContextRole;
  }

  const { data, error } = await supabase.auth.getClaims();

  if (error) {
    return fallbackRole;
  }

  return getAppRoleFromClaims(data?.claims) ?? fallbackRole;
}

async function getRoleFromCurrentAccessContext(
  supabase: SupabaseClient,
): Promise<AppRole | null> {
  try {
    const { data, error } = await withRequestTimeout(
      supabase.rpc("get_current_app_access_context"),
      {
        timeoutMs: AUTH_CONTEXT_TIMEOUT_MS,
        message: AUTH_CONTEXT_TIMEOUT_MESSAGE,
      },
    );

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    return normalizeAppRole(readRecord(row)?.role);
  } catch {
    return null;
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}
