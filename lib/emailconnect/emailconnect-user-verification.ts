import type { AppRole } from "@/lib/auth-routing";
import type { UserStatus } from "@/lib/auth-metadata";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getEmailConnectConfig } from "./emailconnect-config";
import type { EmailConnectIdentity } from "./emailconnect-types";

export async function verifyEmailConnectUsers(externalUserIds: string[]) {
  const config = getEmailConnectConfig();
  if (!config) throw new Error("邮件提醒服务尚未完成配置。");
  const userIds = [...new Set(externalUserIds)].slice(0, 100);
  const supabase = getSupabaseServiceRoleClient();
  const [profilesResult, roleLinksResult, rolesResult] = await Promise.all([
    supabase.from("user_profiles").select("user_id,name,email,status").in("user_id", userIds),
    supabase.from("user_roles_data").select("user_id,role_id").in("user_id", userIds),
    supabase.from("user_roles").select("id,role"),
  ]);
  const queryResults = [
    ["profiles", profilesResult],
    ["role-links", roleLinksResult],
    ["roles", rolesResult],
  ] as const;
  for (const [query, result] of queryResults) {
    if (!result.error) continue;
    // 生产日志只记录查询阶段和 Supabase 返回的诊断字段，不写入人员 UUID、邮箱或服务密钥。
    console.error("EmailConnect 人员查询失败", {
      query,
      code: result.error.code,
      message: result.error.message,
      details: result.error.details,
      hint: result.error.hint,
    });
    throw new Error("人员状态暂时无法确认。", { cause: result.error });
  }
  const rolesById = new Map(
    (rolesResult.data ?? []).map((row) => [row.id, row.role as AppRole]),
  );
  const roleByUserId = new Map(
    (roleLinksResult.data ?? []).map((row) => [row.user_id, rolesById.get(row.role_id)]),
  );
  return (profilesResult.data ?? []).flatMap((profile) => {
    const role = roleByUserId.get(profile.user_id);
    if (!role) return [];
    return [{
      installationId: config.installationId,
      externalUserId: profile.user_id,
      displayName: profile.name?.trim() || profile.email?.trim() || "内部员工",
      role,
      status: profile.status as UserStatus,
    } satisfies EmailConnectIdentity];
  });
}
