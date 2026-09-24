import { type NextRequest, NextResponse } from "next/server";

import { getRequestPublicOrigin } from "@/lib/public-site-origin";

const DEFAULT_SIGN_OUT_REDIRECT_PATH = "/login";
const SUPABASE_AUTH_COOKIE_PATTERN =
  /^sb-.*-auth-token(?:\.\d+)?(?:-code-verifier)?$/;

/** GET 只带用户进入确认页；预加载和普通页面访问都不能清除会话。 */
export async function GET(request: NextRequest) {
  const confirmation = new URL("/auth/sign-out/confirm", getRequestPublicOrigin(request));
  confirmation.searchParams.set("next", getSafeRedirectUrl(request).pathname);
  return NextResponse.redirect(confirmation);
}

/** 只有浏览器明确提交退出表单时，服务端才清除认证 Cookie。 */
export async function POST(request: NextRequest) {
  // POST 后用 303 转到登录页，避免浏览器把提交动作再次发送到目标页面。
  const response = NextResponse.redirect(getSafeRedirectUrl(request), { status: 303 });

  response.headers.set("Cache-Control", "no-store");
  expireSupabaseAuthCookies(request, response);

  return response;
}

function getSafeRedirectUrl(request: NextRequest) {
  const publicOrigin = getRequestPublicOrigin(request);
  const nextPath =
    request.nextUrl.searchParams.get("next") ?? DEFAULT_SIGN_OUT_REDIRECT_PATH;

  // URL 解析器会把反斜杠视为斜杠；拒绝这类路径，避免退出后跳去外部站点。
  if (!nextPath.startsWith("/") || nextPath.startsWith("//") || nextPath.includes("\\")) {
    return new URL(DEFAULT_SIGN_OUT_REDIRECT_PATH, publicOrigin);
  }

  const destination = new URL(nextPath, publicOrigin);
  return destination.origin === publicOrigin
    ? destination
    : new URL(DEFAULT_SIGN_OUT_REDIRECT_PATH, publicOrigin);
}

function expireSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse,
) {
  const cookieNames = Array.from(
    new Set(
      request.cookies
        .getAll()
        .map((cookie) => cookie.name)
        .filter(isSupabaseAuthCookieName),
    ),
  );
  const cookieDomains = getCookieDomains(request.nextUrl.hostname);

  cookieNames.forEach((name) => {
    expireCookie(response, name);
    cookieDomains.forEach((domain) => expireCookie(response, name, domain));
  });
}

function isSupabaseAuthCookieName(name: string) {
  return SUPABASE_AUTH_COOKIE_PATTERN.test(name);
}

function expireCookie(response: NextResponse, name: string, domain?: string) {
  const cookieOptions = {
    name,
    value: "",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  };

  response.cookies.set(domain ? { ...cookieOptions, domain } : cookieOptions);
}

function getCookieDomains(hostname: string) {
  if (hostname === "localhost" || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    return [];
  }

  const parts = hostname.split(".");

  if (parts.length < 2) {
    return [];
  }

  const rootDomain = parts.slice(-2).join(".");

  // 线上可能同时存在当前子域和根域 Cookie，因此两种域都写入过期值。
  return [hostname, `.${rootDomain}`];
}
