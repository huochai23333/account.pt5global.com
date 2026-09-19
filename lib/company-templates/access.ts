import { notFound, redirect } from "next/navigation";

import { canAccessWorkspaceBasePath } from "@/lib/auth-routing";
import { getServerAuthContext, redirectToWorkspaceAccessLimited } from "@/lib/server-auth";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentWorkspaceBusinessAccess } from "@/lib/workspace-business-access";
import { getWorkspaceConfigByRouteSegment } from "@/lib/workspace-config";

const STAFF = new Set(["administrator", "manager", "operator", "recruiter", "salesman", "promoter", "finance"]);

/** 公司模板与业务开通状态无关，但必须同时校验当前角色和网址中的工作区。 */
export async function requireCompanyTemplateWorkspace(workspace: string) {
  const config = getWorkspaceConfigByRouteSegment(workspace);
  if (!config || !STAFF.has(config.authRole)) notFound();
  const auth = await getServerAuthContext();
  if (!auth.userId) redirect(auth.hasAuthCookie ? "/auth/sign-out?next=%2Flogin" : "/login");
  if (auth.status !== "active") redirect("/auth/sign-out?next=%2Flogin");
  if (!auth.role || !STAFF.has(auth.role) || !canAccessWorkspaceBasePath(auth.role, config.basePath)) {
    redirectToWorkspaceAccessLimited();
  }
  const businesses = await getCurrentWorkspaceBusinessAccess(await getServerSupabaseClient());
  return { businesses, config, isAdmin: auth.role === "administrator" };
}

export async function requireCompanyTemplateApiAccess(options: { admin?: boolean } = {}) {
  const auth = await getServerAuthContext();
  if (!auth.userId || auth.status !== "active" || !auth.role || !STAFF.has(auth.role)) {
    throw new Error("company_template_forbidden");
  }
  if (options.admin && auth.role !== "administrator") throw new Error("company_template_forbidden");
  return { ...auth, isAdmin: auth.role === "administrator" };
}
