/** 浏览器只连接系统网站；由网站服务器访问固定的 Supabase 项目。 */
export const SUPABASE_HTTP_PROXY_PATH = "/api/supabase";
export const SUPABASE_AUTH_TIMEOUT_MS = 15_000;
export const SUPABASE_AUTH_OTHER_TIMEOUT_MS = 60_000;
export const SUPABASE_DATA_TIMEOUT_MS = 120_000;

/** 登录与会话刷新只换取令牌；注册和邮件操作可能更慢，需要独立等待上限。 */
export function getSupabaseHttpTimeoutMs(pathname: string) {
  if (pathname === "/auth/v1/token") return SUPABASE_AUTH_TIMEOUT_MS;
  if (pathname.startsWith("/auth/v1/")) return SUPABASE_AUTH_OTHER_TIMEOUT_MS;
  return SUPABASE_DATA_TIMEOUT_MS;
}

/** 限定项目已有 HTTP 服务，不能把这个入口变成任意网址的转发器。 */
export function isSupabaseHttpPath(pathname: string) {
  return /^\/(?:auth|rest|storage|functions)\/v1(?:\/|$)/.test(pathname)
    && !pathname.includes("\\")
    && !pathname.split("/").some((part) => part === "." || part === "..");
}

export function createBrowserSupabaseFetch(supabaseUrl: string): typeof fetch {
  const upstream = new URL(supabaseUrl);
  return async (input, init) => {
    const sourceRequest = input instanceof Request ? input : null;
    const target = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (target.origin !== upstream.origin || !isSupabaseHttpPath(target.pathname)) {
      throw new Error("系统连接地址无效。");
    }
    const proxyUrl = new URL(`${SUPABASE_HTTP_PROXY_PATH}${target.pathname}${target.search}`, window.location.origin);
    // 只改 HTTP 发送地址。SDK 仍使用真实项目地址生成 Cookie 名称及核对登录身份。
    // 保留调用方的取消信号；认证等待 15 秒后终止，上传等请求使用独立的较长上限。
    const timeout = AbortSignal.timeout(getSupabaseHttpTimeoutMs(target.pathname));
    const originalSignal = init?.signal ?? sourceRequest?.signal;
    const proxyInit: RequestInit & { duplex?: "half" } = sourceRequest ? {
      method: sourceRequest.method,
      headers: sourceRequest.headers,
      body: ["GET", "HEAD"].includes(sourceRequest.method) ? undefined : sourceRequest.body,
      duplex: "half",
      ...init,
    } : { ...init };
    try {
      return await fetch(proxyUrl, {
        ...proxyInit,
        signal: originalSignal ? AbortSignal.any([originalSignal, timeout]) : timeout,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
      });
    } catch (error) {
      if (!timeout.aborted) throw error;
      // 返回可识别的超时结果，避免认证库将普通等待超时打印为浏览器内部异常。
      return Response.json({ error_code: "request_timeout", message: "连接等待时间过长，请稍后再试。" }, { status: 408 });
    }
  };
}
