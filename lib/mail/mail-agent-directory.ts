import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { databaseError } from "./mail-thread-access";
import type { MailIdentity, MailSenderRole } from "./mail-types";

/**
 * 按岗位读取仍在职的邮件成员。
 * 发件设置会同时使用管理员和业务员，而会话负责人仍只读取业务员，避免扩大原有分配权限。
 */
async function listActiveMailMembers(allowedRoles: MailSenderRole[]) {
  const supabase = getSupabaseServiceRoleClient();
  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("id,role")
    .in("role", allowedRoles);
  if (roleError || !roles?.length) databaseError("邮件人员岗位暂时无法读取。", roleError);
  const roleById = new Map(roles.map((row) => [String(row.id), row.role as MailSenderRole]));
  const { data: links, error: linksError } = await supabase
    .from("user_roles_data")
    .select("user_id,role_id")
    .in(
      "role_id",
      roles.map((row) => row.id),
    );
  if (linksError) databaseError("邮件人员名单暂时无法读取。", linksError);
  const roleByUser = new Map<string, MailSenderRole>();
  // 同一账号若意外出现多个岗位关联，管理员优先，保证设置页只展示一张资料卡。
  for (const link of links ?? []) {
    const userId = link.user_id as string;
    const role = roleById.get(String(link.role_id));
    if (role && (role === "administrator" || !roleByUser.has(userId))) roleByUser.set(userId, role);
  }
  const ids = [...roleByUser.keys()];
  if (ids.length === 0) return [];
  const { data: profiles, error: profilesError } = await supabase
    .from("user_profiles")
    .select("user_id,name,email,status")
    .in("user_id", ids)
    .eq("status", "active");
  if (profilesError) databaseError("邮件人员资料暂时无法读取。", profilesError);
  return (profiles ?? [])
    .map((profile) => ({
      userId: profile.user_id as string,
      displayName:
        String(profile.name ?? "").trim() || String(profile.email ?? "").trim() || "内部员工",
      name: profile.name as string | null,
      email: profile.email as string | null,
      role: roleByUser.get(profile.user_id as string) ?? "salesman",
    }))
    .sort((left, right) => {
      if (left.role !== right.role) return left.role === "administrator" ? -1 : 1;
      return left.displayName.localeCompare(right.displayName, "zh-CN");
    });
}

export async function listActiveSalesmen() {
  return listActiveMailMembers(["salesman"]);
}

export async function listActiveMailSenders() {
  return listActiveMailMembers(["administrator", "salesman"]);
}

export type ActiveMailSender = Awaited<ReturnType<typeof listActiveMailSenders>>[number];

export async function listAssignableMailAgents(identity: MailIdentity) {
  if (!identity.userId) throw new Error("当前账号无效。");
  const agents = await listActiveSalesmen();
  return {
    agents: agents.map((agent) => ({ memberId: agent.userId, displayName: agent.displayName })),
  };
}
