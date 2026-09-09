import { redirect } from "next/navigation";

import { getServerAuthContext, redirectToWorkspaceAccessLimited } from "@/lib/server-auth";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { getWorkspaceConfigByRouteSegment } from "@/lib/workspace-config";

import { getEmailConnectConfig } from "./emailconnect-config";
import type { EmailConnectIdentity } from "./emailconnect-types";

/** 把 PT5 的 UUID、角色和账号状态转换成插件统一身份，身份来源仍以数据库为准。 */
export async function requireEmailConnectIdentity(workspace?: string): Promise<EmailConnectIdentity> {
  const config = getEmailConnectConfig();
  const routeConfig = workspace ? getWorkspaceConfigByRouteSegment(workspace) : null;
  const auth = await getServerAuthContext();
  if (!auth.userId) redirect("/login");
  if (!auth.role || auth.role === "client") {
    redirectToWorkspaceAccessLimited();
  }
  if (workspace && (!routeConfig || routeConfig.authRole !== auth.role)) {
    redirectToWorkspaceAccessLimited();
  }
  if (auth.status !== "active") redirect("/auth/sign-out?next=%2Flogin");
  if (!config) throw new Error("邮件提醒服务尚未完成配置。");

  const { data, error } = await (await getServerSupabaseClient())
    .from("user_profiles")
    .select("name,email")
    .eq("user_id", auth.userId)
    .maybeSingle<{ name: string | null; email: string | null }>();
  if (error) throw new Error("账号资料暂时无法读取，请稍后重试。", { cause: error });
  return {
    installationId: config.installationId,
    externalUserId: auth.userId,
    displayName: data?.name?.trim() || data?.email?.trim() || "内部员工",
    role: auth.role,
    status: auth.status,
  };
}
