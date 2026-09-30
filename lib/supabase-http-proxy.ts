import "server-only";

import type { NextRequest } from "next/server";

import { getRequestPublicOrigin } from "./public-site-origin";
import { getSupabaseEnv } from "./supabase";
import { getSupabaseHttpTimeoutMs, isSupabaseHttpPath, SUPABASE_HTTP_PROXY_PATH } from "./supabase-http-transport";

const requestHeaderNames = [
  "accept", "accept-profile", "authorization", "apikey", "cache-control", "content-type",
  "content-profile", "if-match", "if-none-match", "prefer", "range", "range-unit",
  "x-client-info", "x-supabase-api-version", "x-upsert",
];
const responseHeaderNames = [
  "accept-ranges", "content-disposition", "content-type", "content-range", "range-unit", "etag", "last-modified",
  "preference-applied", "retry-after", "x-supabase-api-version", "x-total-count",
];

/**
 * 只传递浏览器本来持有的公开密钥和用户令牌。不能补 service_role、读取站点 Cookie
 * 来代替身份，也不能提前刷新会话；权限继续由 Supabase Auth、RLS 和业务函数检查。
 */
export async function proxySupabaseHttpRequest(request: NextRequest) {
  const incoming = new URL(request.url);
  const pathname = incoming.pathname.slice(SUPABASE_HTTP_PROXY_PATH.length);
  if (!incoming.pathname.startsWith(`${SUPABASE_HTTP_PROXY_PATH}/`) || !isSupabaseHttpPath(pathname)) {
    return failure(404, "访问地址不存在。");
  }
  // Hostinger 转发到 Node 时，请求 URL 可能是内部地址；用系统配置的公开地址判断浏览器来源。
  // 认证和文件请求可能写入资料，仍须拒绝其他网站借用当前站点发起请求。
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== getRequestPublicOrigin(request))) {
    return failure(403, "请从系统页面重新操作。");
  }
  const { supabaseUrl, supabaseKey } = getSupabaseEnv();
  if (request.headers.get("apikey") !== supabaseKey) {
    return failure(401, "请刷新系统页面后再试。");
  }
  const upstream = new URL(supabaseUrl);
  const target = new URL(`${pathname}${incoming.search}`, upstream);
  if (target.origin !== upstream.origin || !isSupabaseHttpPath(target.pathname)) {
    return failure(404, "访问地址不存在。");
  }
  const headers = copyHeaders(request.headers, requestHeaderNames);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(getSupabaseHttpTimeoutMs(pathname))]);
  try {
    const upstreamResponse = await fetch(target, {
      method: request.method,
      headers,
      // 以流传递附件，避免大文件同时占用两份内存。GET/HEAD 不能携带请求体。
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      duplex: "half",
      signal,
      cache: "no-store",
      redirect: "manual",
    } as RequestInit & { duplex: "half" });
    // 上游失败要保留真实状态和正文，让登录页能区分密码错误、限流与等待超时。
    // 跳转则不透传，避免浏览器沿着意外的上游 Location 离开本站。
    if (!upstreamResponse.ok && [301, 302, 303, 307, 308].includes(upstreamResponse.status)) {
      await upstreamResponse.body?.cancel();
      return failure(502, "系统连接暂时没有完成，请稍后再试。");
    }
    // fetch 会解压响应，因此不能复制压缩长度；所有个人资料及令牌响应都禁止缓存。
    const responseHeaders = copyHeaders(upstreamResponse.headers, responseHeaderNames);
    responseHeaders.set("cache-control", "private, no-store");
    return new Response(request.method === "HEAD" ? null : upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch {
    return failure(signal.aborted ? 504 : 502, "系统连接暂时没有完成，请稍后再试。");
  }
}

function copyHeaders(source: Headers, names: string[]) {
  const result = new Headers();
  for (const name of names) {
    const value = source.get(name);
    if (value !== null) result.set(name, value);
  }
  return result;
}

function failure(status: number, message: string) {
  return Response.json({ message }, { status, headers: { "cache-control": "private, no-store" } });
}
