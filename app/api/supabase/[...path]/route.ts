import { proxySupabaseHttpRequest } from "@/lib/supabase-http-proxy";

// 传输入口只调度固定项目转发，权限和请求策略放在独立服务模块。
export const runtime = "nodejs";
export const GET = proxySupabaseHttpRequest;
export const POST = proxySupabaseHttpRequest;
export const PUT = proxySupabaseHttpRequest;
export const PATCH = proxySupabaseHttpRequest;
export const DELETE = proxySupabaseHttpRequest;
export const HEAD = proxySupabaseHttpRequest;
