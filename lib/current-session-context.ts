import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getAppRoleFromClaims, getUserStatusFromClaims } from "./auth-claims";
import type { AppRole } from "./auth-routing";
import {
  getAppRoleFromMetadataContainer,
  getUserStatusFromMetadataContainer,
  type UserStatus,
} from "./auth-metadata";
import { getCurrentAppAccessContext } from "./current-session-access-context";
import {
  getCurrentClaims,
  getCurrentSession,
  getCurrentUser,
} from "./current-session-auth";
import { getVerifiedSessionContext } from "./verified-session-context";

export { resetCurrentAuthContextCache } from "./current-session-cache";

export function getRoleFromUser(user: User | null | undefined): AppRole | null {
  return getAppRoleFromMetadataContainer(user);
}

export function getStatusFromUser(
  user: User | null | undefined,
): UserStatus | null {
  return getUserStatusFromMetadataContainer(user);
}

export { getCurrentSession };

/**
 * 薄编排层只负责组合会话、用户、JWT 与数据库访问上下文。
 * 具体缓存、Auth 请求和 RPC 读取分别位于独立模块，方便单独测试和维护。
 */
export async function getCurrentSessionContext(
  supabase: SupabaseClient,
): Promise<{
  session: Awaited<ReturnType<typeof getCurrentSession>>;
  user: User | null;
  role: AppRole | null;
  status: UserStatus | null;
}> {
  if (typeof window === "undefined") {
    // 服务端统一使用数据库权限；浏览器会话同步仍由下面的客户端读取模块维护。
    const [verified, { data: { session } }] = await Promise.all([
      getVerifiedSessionContext(supabase), supabase.auth.getSession(),
    ]);
    return { session, ...verified };
  }
  const [session, user, claims] = await Promise.all([
    getCurrentSession(supabase),
    getCurrentUser(supabase),
    getCurrentClaims(supabase),
  ]);
  const trustedClaims = user ? claims : null;
  const accessContext = user ? await getCurrentAppAccessContext(supabase) : null;

  return {
    session,
    user,
    role:
      accessContext?.role ??
      getAppRoleFromClaims(trustedClaims) ??
      getRoleFromUser(user),
    status:
      accessContext?.status ??
      getUserStatusFromClaims(trustedClaims) ??
      getStatusFromUser(user),
  };
}
