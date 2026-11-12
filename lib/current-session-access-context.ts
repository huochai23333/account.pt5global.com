import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeAppRole, normalizeUserStatus } from "./auth-metadata";
import {
  ensureSessionTracking,
  getSessionCache,
  startSessionCacheRequest,
  type AppAccessContext,
} from "./current-session-cache";
import { withRequestTimeout } from "./request-timeout";

const ACCESS_CONTEXT_TIMEOUT_MS = 8_000;
const ACCESS_CONTEXT_TIMEOUT_MESSAGE = "登录状态同步较慢，请稍后重试。";

/**
 * 数据库 RPC 是角色和状态的最终可信来源。
 * 这是浏览器交互使用的缓存读取，失败返回 null 后编排层保留既有 claims/app_metadata 分支。
 * 严格服务端入口使用 current-app-access-context.ts，失败直接抛出，不能把两个同名导出混用。
 */
export async function getCurrentAppAccessContext(
  supabase: SupabaseClient,
): Promise<AppAccessContext | null> {
  const sessionCache = getSessionCache(supabase);
  ensureSessionTracking(supabase, sessionCache);

  if (sessionCache.currentUserSnapshot === null) {
    sessionCache.currentAccessContextSnapshot = null;
    return null;
  }
  if (sessionCache.currentAccessContextSnapshot !== undefined) {
    return sessionCache.currentAccessContextSnapshot;
  }
  if (!sessionCache.currentAccessContextRequest) {
    sessionCache.currentAccessContextRequest = startSessionCacheRequest(
      sessionCache,
      () => fetchCurrentAppAccessContext(supabase),
      (context) => { sessionCache.currentAccessContextSnapshot = context; },
      () => { sessionCache.currentAccessContextRequest = null; },
    );
  }
  return sessionCache.currentAccessContextRequest;
}

async function fetchCurrentAppAccessContext(supabase: SupabaseClient) {
  try {
    const { data, error } = await withRequestTimeout(
      supabase.rpc("get_current_app_access_context"),
      {
        timeoutMs: ACCESS_CONTEXT_TIMEOUT_MS,
        message: ACCESS_CONTEXT_TIMEOUT_MESSAGE,
      },
    );
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const record = readRecord(row);
    return record
      ? {
          role: normalizeAppRole(record.role),
          status: normalizeUserStatus(record.status),
        }
      : null;
  } catch {
    return null;
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}
