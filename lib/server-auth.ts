import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import {
  canAccessWorkspaceBasePath,
  type AppRole,
} from "./auth-routing";
import type { UserStatus } from "./auth-metadata";
import { getCurrentAppAccessContext } from "./current-app-access-context";
import { getServerSupabaseClient } from "./supabase-server";
import { getCurrentWorkspaceBusinessAccess } from "./workspace-business-access";
import {
  BUSINESS_UNAVAILABLE_PATH,
  getSignedInWorkspaceDestination,
} from "./workspace-business-availability";

type ServerAuthContext = {
  hasAuthCookie: boolean;
  role: AppRole | null;
  status: UserStatus | null;
  userId: string | null;
};

// 同一次渲染中的布局和业务页面复用已验证身份；新请求仍会重新验证账号状态。
export const getServerAuthContext = cache(async (): Promise<ServerAuthContext> => {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore.getAll().some((cookie) =>
    isSupabaseAuthCookieName(cookie.name),
  );

  if (!hasAuthCookie) {
    return {
      hasAuthCookie: false,
      role: null,
      status: null,
      userId: null,
    };
  }

  const supabase = await getServerSupabaseClient();
  // getUser 会向 Supabase Auth 验证令牌，不能用浏览器 Cookie 中未经验证的会话直接放行。
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      hasAuthCookie: true,
      role: null,
      status: null,
      userId: null,
    };
  }

  // 角色和状态统一从数据库读取，入口跳转和工作台权限校验因此使用同一份可信结果。
  const accessContext = await getCurrentAppAccessContext(supabase);

  return {
    hasAuthCookie: true,
    role: accessContext.role,
    status: accessContext.status,
    userId: user.id,
  };
});

function isSupabaseAuthCookieName(name: string) {
  return /^sb-.*-auth-token(?:\.\d+)?$/.test(name);
}

export async function redirectAuthenticatedUserToWorkspace() {
  const { hasAuthCookie, role, status, userId } = await getServerAuthContext();

  if (!userId) {
    if (hasAuthCookie) {
      redirect("/auth/sign-out?next=%2Flogin");
    }

    return;
  }

  if (status !== "active") {
    redirect("/auth/sign-out?next=%2Flogin");
  }

  assertWorkspaceRole(role);
  const supabase = await getServerSupabaseClient();
  const businesses = await getCurrentWorkspaceBusinessAccess(supabase);
  redirect(getSignedInWorkspaceDestination(role, businesses));
}

export async function requireWorkspaceAccess(expectedBasePath: string) {
  const { hasAuthCookie, role, status, userId } = await getServerAuthContext();

  if (!userId) {
    redirect(hasAuthCookie ? "/auth/sign-out?next=%2Flogin" : "/login");
  }

  if (status !== "active") {
    redirect("/auth/sign-out?next=%2Flogin");
  }

  assertWorkspaceRole(role);

  if (!canAccessWorkspaceBasePath(role, expectedBasePath)) {
    redirectToWorkspaceAccessLimited();
  }

  const supabase = await getServerSupabaseClient();
  const businesses = await getCurrentWorkspaceBusinessAccess(supabase);

  if (businesses.length === 0) {
    redirect(BUSINESS_UNAVAILABLE_PATH);
  }

  return { businesses, role };
}

// 使用普通页面承载越权提示，避免 Next.js 实验性 forbidden 边界在开发环境触发性能测量异常。
export function redirectToWorkspaceAccessLimited(): never {
  redirect("/access-limited");
}

export function assertWorkspaceRole(
  role: AppRole | null,
): asserts role is AppRole {
  if (!role) {
    // 账号缺少角色属于配置异常，不能再把它当成客户账号，否则会形成错误跳转和权限提示循环。
    throw new Error("The signed-in account does not have a valid workspace role.");
  }
}
