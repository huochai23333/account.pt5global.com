import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentAppAccessContext } from "./current-app-access-context";
import { isDefinitiveSessionFailure } from "./auth-failure";
import { createAuthRequestTransport } from "./auth-request-transport";
import {
  getWorkspaceBasePath,
} from "./auth-routing";
import { getSupabaseEnv } from "./supabase";
import { getRequestPublicOrigin } from "./public-site-origin";
import { getVerifiedWorkspaceBusinesses } from "./verified-workspace-business";
import { getSignedInWorkspaceDestination } from "./workspace-business-availability";

const AUTH_ENTRY_PATHS = new Set(["/", "/login", "/register", "/forgot-password"]);

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const currentBasePath = getWorkspaceBasePath(pathname);
  const isPasswordRecoveryEntry =
    pathname === "/forgot-password" &&
    request.nextUrl.searchParams.get("type") === "recovery";
  const hasAuthCookie = request.cookies.getAll().some((cookie) =>
    isSupabaseAuthCookieName(cookie.name),
  );

  let supabaseResponse = NextResponse.next({
    request,
  });

  if (!hasAuthCookie) {
    if (currentBasePath) {
      return createRedirectResponse(request, supabaseResponse, "/login", {
        clearSearch: true,
      });
    }

    return supabaseResponse;
  }

  const { supabaseUrl, supabaseKey } = getSupabaseEnv();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    global: { fetch: createAuthRequestTransport().fetch },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({
          request,
        });

        cookiesToSet.forEach((cookie) => {
          supabaseResponse.cookies.set(cookie);
        });

        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error && !isDefinitiveSessionFailure(error)) {
    // 暂时不可达时保留 Cookie，交给页面自身的可信身份守卫显示重试页；绝不猜测为未登录。
    return supabaseResponse;
  }
  const userId = error ? null : (user?.id ?? null);

  if (currentBasePath) {
    if (!userId) {
      return createRedirectResponse(request, supabaseResponse, "/login", {
        clearSearch: true,
      });
    }
  }

  if (AUTH_ENTRY_PATHS.has(pathname) && userId && !isPasswordRecoveryEntry) {
    let accessContext;

    try {
      // 部署后恢复旧会话时也必须查询数据库，不能使用可能过期的 Auth 元数据决定工作台。
      accessContext = await getCurrentAppAccessContext(supabase);
    } catch {
      // 让认证页面继续由服务端读取同一上下文并进入现有友好错误页，禁止猜测为客户角色。
      return supabaseResponse;
    }

    if (accessContext.status === "inactive" || accessContext.status === "suspended") {
      return createRedirectResponse(
        request,
        supabaseResponse,
        "/auth/sign-out",
        { search: "?next=%2Flogin" },
      );
    }

    if (!accessContext.role || accessContext.status !== "active") {
      // 缺少有效角色时交给认证页面显示错误，不能再默认跳转到 /client/home。
      return supabaseResponse;
    }

    let businesses;
    try {
      businesses = await getVerifiedWorkspaceBusinesses(supabase);
    } catch {
      // 业务权限读取失败不能套用默认业务，页面守卫会再次严格读取并显示友好错误。
      return supabaseResponse;
    }

    return createRedirectResponse(
      request,
      supabaseResponse,
      getSignedInWorkspaceDestination(accessContext.role, businesses),
      {
        clearSearch: true,
      },
    );
  }

  return supabaseResponse;
}

function isSupabaseAuthCookieName(name: string) {
  return /^sb-.*-auth-token(?:\.\d+)?$/.test(name);
}

function createRedirectResponse(
  request: NextRequest,
  supabaseResponse: NextResponse,
  destinationPath: string,
  options?: {
    clearSearch?: boolean;
    search?: string;
  },
) {
  // 只继承查询参数，域名必须来自公共地址策略，不能继承 Node.js 内部监听地址。
  const redirectUrl = new URL(destinationPath, getRequestPublicOrigin(request));
  redirectUrl.search = request.nextUrl.search;

  if (options?.search !== undefined) {
    redirectUrl.search = options.search;
  } else if (options?.clearSearch) {
    redirectUrl.search = "";
  }

  const response = NextResponse.redirect(redirectUrl);

  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });

  // 跳转同样可能携带刷新后的登录 Cookie，必须继承 SDK 的防缓存响应头。
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = supabaseResponse.headers.get(name);
    if (value) response.headers.set(name, value);
  }

  return response;
}
