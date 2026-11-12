import { randomBytes } from "node:crypto";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import type { RoutingAgent } from "./mail-routing";
import { listActiveSalesmen } from "./mail-agent-directory";

/** 只把启用且仍在职的业务员交给路由器，避免邮件落到停用账号。 */
export async function loadMailRoutingAgents(): Promise<RoutingAgent[]> {
  const supabase = getSupabaseServiceRoleClient();
  const { data: mailProfiles, error } = await supabase.from("mail_agent_profiles")
    .select("user_id,alias_local_part,ref_prefix").eq("enabled", true);
  if (error) throw new Error("邮件路由人员暂时无法读取。", { cause: error });
  if (!mailProfiles?.length) return [];
  // 发件设置同时包含管理员；入站分配复用负责人选择器的在职业务员名单。
  const salesmen = await listActiveSalesmen();
  const names = new Map(salesmen.map((profile) => [
    profile.userId,
    profile.displayName,
  ]));
  return (mailProfiles ?? []).flatMap((profile) => names.has(profile.user_id as string) ? [{
    memberId: profile.user_id as string,
    aliasLocalPart: profile.alias_local_part as string,
    refPrefix: profile.ref_prefix as string,
    displayName: names.get(profile.user_id as string)!,
    enabled: true,
  }] : []);
}

export async function createUniqueMailRef(prefix: string) {
  const supabase = getSupabaseServiceRoleClient();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `PT5-${new Date().getUTCFullYear()}-${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const result = await supabase.from("mail_threads").select("id").eq("ref_code", code).maybeSingle();
    if (result.error) throw new Error("邮件 Ref 暂时无法确认。", { cause: result.error });
    if (!result.data) return code;
  }
  throw new Error("无法生成唯一邮件 Ref，请稍后重试。");
}
