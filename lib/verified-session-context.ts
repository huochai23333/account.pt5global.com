import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { getCurrentAppAccessContext } from "./current-app-access-context";
import { measureServerStage } from "./server-performance";

/**
 * 布局、业务数据和入口跳转共用这一份经过验证的身份。
 * React cache 只复用本次服务端渲染，按客户端实例区分用户；新请求重新验证。
 * 数据库权限读取失败会抛出错误，不能用 JWT 或 Auth 元数据猜测角色继续放行。
 */
export const getVerifiedSessionContext = cache(async (supabase: SupabaseClient) =>
  measureServerStage("access.verified-session", async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { user: null, role: null, status: null };
    const access = await getCurrentAppAccessContext(supabase);
    return { user, ...access };
  }));
