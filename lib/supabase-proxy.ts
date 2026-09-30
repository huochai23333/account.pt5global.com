import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentAppAccessContext } from "./current-app-access-context";
import {
  getWorkspaceBasePath,
} from "./auth-routing";
import { getSupabaseEnv } from "./supabase";
import { getRequestPublicOrigin } from "./public-site-origin";
import { getCurrentWorkspaceBusinessAccess } from "./workspace-business-access";
import { getSignedInWorkspaceDestination } from "./workspace-business-availability";
import { SUPABASE_HTTP_PROXY_PATH } from "./supabase-http-transport";

const AUTH_ENTRY_PATHS = new Set(["/", "/login", "/register", "/forgot-password"]);

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // SDK 的转发请求已带用户令牌，不能在这里再刷新 Cookie；否则每次认证读取都会额外等待。
  if (pathname.startsWith(`${SUPABASE_HTTP_PROXY_PATH}/`)) {
    return NextResponse.next();
  }
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

    if (accessContext.status !== "active") {
      return createRedirectResponse(
        request,
        supabaseResponse,
        "/auth/sign-out",
        { search: "?next=%2Flogin" },
      );
    }

    if (!accessContext.role) {
      // 缺少有效角色时交给认证页面显示错误，不能再默认跳转到 /client/home。
      return supabaseResponse;
    }

    const businesses = await getCurrentWorkspaceBusinessAccess(supabase);

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

  return response;
}
