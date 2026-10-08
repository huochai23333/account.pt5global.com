import "server-only";
import { notFound, redirect } from "next/navigation";
import { canAccessWorkspaceBasePath } from "@/lib/auth-routing";
import { getServerAuthContext, redirectToWorkspaceAccessLimited } from "@/lib/server-auth";
import { getWorkspaceConfigByRouteSegment } from "@/lib/workspace-config";
import { getCurrentWorkspaceBusinessAccess } from "@/lib/workspace-business-access";
import { getServerSupabaseClient } from "@/lib/supabase-server";

/** 本人资料不要求开通业务；其他客户资料的范围仍由数据库当前授权决定。 */
export async function requireDocumentWorkspace(workspace: string) {
  const config = getWorkspaceConfigByRouteSegment(workspace);
  if (!config) notFound();
  const auth = await getServerAuthContext();
  if (!auth.userId || auth.status !== "active") redirect("/login");
  if (!auth.role || !canAccessWorkspaceBasePath(auth.role, config.basePath)) redirectToWorkspaceAccessLimited();
  return { config, businesses: await getCurrentWorkspaceBusinessAccess(await getServerSupabaseClient()) };
}
export async function requireDocumentApi() {
  const auth = await getServerAuthContext();
  if (!auth.userId || auth.status !== "active" || !auth.role) throw new Error("forbidden");
  return { userId: auth.userId, role: auth.role, supabase: await getServerSupabaseClient() };
}
