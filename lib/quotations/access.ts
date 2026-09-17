import { notFound, redirect } from "next/navigation";
import { canAccessWorkspaceBasePath } from "@/lib/auth-routing";
import { getServerAuthContext, redirectToWorkspaceAccessLimited } from "@/lib/server-auth";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentWorkspaceBusinessAccess } from "@/lib/workspace-business-access";
import { getWorkspaceConfigByRouteSegment } from "@/lib/workspace-config";

const STAFF = new Set(["administrator", "manager", "operator", "recruiter", "salesman", "promoter", "finance"]);

/** 每个报价页面都调用此函数，首页是否显示入口不能代替服务端权限校验。 */
export async function requireQuoteWorkspace(workspace: string) {
  const config = getWorkspaceConfigByRouteSegment(workspace);
  if (!config || !STAFF.has(config.authRole)) notFound();
  const { hasAuthCookie, role, status, userId } = await getServerAuthContext();
  if (!userId) redirect(hasAuthCookie ? "/auth/sign-out?next=%2Flogin" : "/login");
  if (status !== "active") redirect("/auth/sign-out?next=%2Flogin");
  if (!role || !STAFF.has(role) || !canAccessWorkspaceBasePath(role, config.basePath))
    redirectToWorkspaceAccessLimited();
  // 报价与业务开通状态无关；仍把已有业务权限交给工作台外壳显示对应导航。
  const businesses = await getCurrentWorkspaceBusinessAccess(await getServerSupabaseClient());
  return { config, businesses };
}
