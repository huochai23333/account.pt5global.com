import type { SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_AUTH_KEY_PATTERN = /^sb-.*-auth-token(?:\.\d+)?(?:-code-verifier)?$/;
const SERVER_SIGN_OUT_PATH = "/auth/sign-out";

export function signOutCurrentBrowserSession(
  supabase: SupabaseClient | null,
  destination = "/login",
) {
  // verified-auth-signout: 页面不宣称退出接口成功；先清理本地会话，再由服务端退出路由清理 Cookie。
  void supabase?.auth.signOut({ scope: "local" }).catch(() => undefined);
  clearSupabaseBrowserSession();

  if (typeof window !== "undefined") {
    // 原生 POST 只在用户点击退出后提交，路由预加载不会触发 Cookie 清理。
    const form = document.createElement("form");
    form.method = "POST";
    form.action = buildServerSignOutPath(destination);
    form.hidden = true;
    document.body.appendChild(form);
    form.submit();
  }
}

export async function clearCurrentBrowserSession(supabase: SupabaseClient | null) {
  // verified-auth-signout: 登录前清场只以本地存储和 Cookie 清理为完成条件，不显示成功提示。
  await supabase?.auth.signOut({ scope: "local" }).catch(() => undefined);
  clearSupabaseBrowserSession();
}

function clearSupabaseBrowserSession() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    clearMatchingStorageKeys(window.localStorage);
    clearMatchingStorageKeys(window.sessionStorage);
    clearMatchingCookies();
  } catch {
    // 本地清理失败不阻塞退出跳转，服务端退出路由会继续删除登录 Cookie。
  }
}

function clearMatchingStorageKeys(storage: Storage) {
  const keysToRemove: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (key && SUPABASE_AUTH_KEY_PATTERN.test(key)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => {
    storage.removeItem(key);
  });
}

function clearMatchingCookies() {
  document.cookie
    .split(";")
    .map((cookie) => cookie.split("=")[0]?.trim())
    .filter((name): name is string => Boolean(name && SUPABASE_AUTH_KEY_PATTERN.test(name)))
    .forEach((name) => {
      expireCookie(name);
      getRootCookieDomain()?.forEach((domain) => expireCookie(name, domain));
    });
}

function buildServerSignOutPath(destination: string) {
  if (destination.startsWith(SERVER_SIGN_OUT_PATH)) {
    return destination;
  }

  if (!destination.startsWith("/") || destination.startsWith("//")) {
    return SERVER_SIGN_OUT_PATH;
  }

  return `${SERVER_SIGN_OUT_PATH}?next=${encodeURIComponent(destination)}`;
}

function expireCookie(name: string, domain?: string) {
  const encodedName = encodeURIComponent(name);
  const domainPart = domain ? `; domain=${domain}` : "";

  document.cookie = `${encodedName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainPart}; SameSite=Lax`;
}

function getRootCookieDomain() {
  const hostname = window.location.hostname;

  if (hostname === "localhost" || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    return null;
  }

  const parts = hostname.split(".");

  if (parts.length < 2) {
    return null;
  }

  const rootDomain = parts.slice(-2).join(".");
  return [hostname, `.${rootDomain}`];
}
