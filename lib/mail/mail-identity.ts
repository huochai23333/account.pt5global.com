import { redirect } from "next/navigation";

import { getServerAuthContext, redirectToWorkspaceAccessLimited } from "@/lib/server-auth";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { getWorkspaceConfigByRouteSegment } from "@/lib/workspace-config";

import type { MailIdentity } from "./mail-types";

/** 每次请求都从 PT5 当前登录会话重新确认角色，避免角色变更后旧页面继续访问邮件。 */
export async function requireMailIdentity(workspace?: string): Promise<MailIdentity> {
  const routeConfig = workspace ? getWorkspaceConfigByRouteSegment(workspace) : null;
  const auth = await getServerAuthContext();
  if (!auth.userId) redirect("/login");
  if (!auth.role || !["administrator", "salesman"].includes(auth.role)) {
    redirectToWorkspaceAccessLimited();
  }
  if (workspace && (!routeConfig || routeConfig.authRole !== auth.role)) {
    redirectToWorkspaceAccessLimited();
  }
  if (auth.status !== "active") redirect("/auth/sign-out?next=%2Flogin");

  const { data, error } = await (await getServerSupabaseClient())
    .from("user_profiles")
    .select("name,email")
    .eq("user_id", auth.userId)
    .maybeSingle<{ name: string | null; email: string | null }>();
  if (error) throw new Error("账号资料暂时无法读取，请稍后重试。", { cause: error });

  return {
    userId: auth.userId,
    displayName: data?.name?.trim() || data?.email?.trim() || "内部员工",
    role: auth.role,
    status: auth.status,
  };
}

export function requireMailAdministrator(identity: MailIdentity) {
  if (identity.role !== "administrator") throw new Error("只有管理员可以执行此操作。");
}
