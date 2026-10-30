import type { SupabaseClient } from "@supabase/supabase-js";

import { AuthFlowError } from "./auth-failure";

export const PASSWORD_REQUEST_TIMEOUT_MS = 15_000;
export const AUTH_READ_TIMEOUT_MS = 8_000;
type AuthTransport = ReturnType<typeof createAuthRequestTransport>;
const transports = new WeakMap<SupabaseClient, AuthTransport>();

/**
 * SDK 仍直接访问原项目地址；只为认证与登录权限读取组合取消信号。
 * 不添加请求头、不代理请求、不改变 SDK 的 Cookie 保存和令牌刷新协议。
 */
export function createAuthRequestTransport(baseFetch: typeof fetch = (...args) => fetch(...args)) {
  let operationSignal: AbortSignal | null = null;
  const boundedFetch: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const passwordRequest = url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password";
    const sessionRequest = url.pathname === "/auth/v1/user" || url.pathname === "/auth/v1/logout" ||
      (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token");
    const loginRead = ["/rest/v1/rpc/get_current_app_access_context", "/rest/v1/rpc/get_current_workspace_business_access"].includes(url.pathname);
    if (!passwordRequest && !sessionRequest && !loginRead) return baseFetch(input, init);
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(new AuthFlowError("timeout")),
      passwordRequest ? PASSWORD_REQUEST_TIMEOUT_MS : AUTH_READ_TIMEOUT_MS);
    const signals = [timeout.signal, operationSignal, init?.signal,
      input instanceof Request ? input.signal : null].filter((signal): signal is AbortSignal => Boolean(signal));
    const signal = AbortSignal.any(signals);
    try {
      signal.throwIfAborted();
      const response = await baseFetch(input, { ...init, signal });
      // fetch 在响应头到达时就返回；还要等小型认证正文读完，超时才能覆盖整个密码响应。
      await response.clone().arrayBuffer();
      return response;
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
  return {
    fetch: boundedFetch,
    async run<T>(signal: AbortSignal, task: () => Promise<T>) {
      // 旧 SDK 调用未退出前不启动第二次密码提交，避免锁等待结束后补发旧密码。
      if (operationSignal) throw new AuthFlowError("busy");
      operationSignal = signal;
      try { return await task(); }
      finally { operationSignal = null; }
    },
  };
}

export function registerAuthRequestTransport(client: SupabaseClient, transport: AuthTransport) {
  transports.set(client, transport);
}

export function runWithAuthRequestSignal<T>(client: SupabaseClient, signal: AbortSignal, task: () => Promise<T>) {
  const transport = transports.get(client);
  if (!transport) throw new AuthFlowError("serviceUnavailable");
  return transport.run(signal, task);
}

/** 取消等待不代表请求未被服务端处理；调用方必须继续把结果视为待确认。 */
export function waitForAuthTask<T>(task: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new AuthFlowError("timeout"));
    // 即使已经取消，也订阅原任务的拒绝，避免迟到的 SDK 异常成为未处理拒绝。
    Promise.resolve(task).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
  });
}
