import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { databaseError } from "./mail-thread-access";
import {
  addStableAliasSuffix,
  addStableRefSuffix,
  createSuggestedMailAlias,
  createSuggestedRefPrefix,
} from "./mail-agent-identifiers";
import { encryptMailValue } from "./mail-security";
import type { ActiveMailSender } from "./mail-agent-directory";

export async function generatedIdentifiers(sender: ActiveMailSender) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("mail_agent_profiles")
    .select("user_id,alias_local_part,ref_prefix")
    .neq("user_id", sender.userId);
  if (error) databaseError("发件人员邮件标识暂时无法生成。", error);
  return suggestIdentifiersFromProfiles(sender, data ?? []);
}

/** 列表页复用同一份配置计算建议值；排除自己的标识，保持与单人编辑时的规则一致。 */
export function suggestIdentifiersFromProfiles(
  sender: ActiveMailSender,
  profiles: {
    user_id: string;
    alias_local_part: string;
    ref_prefix: string;
  }[],
) {
  const others = profiles.filter((row) => row.user_id !== sender.userId);
  const usedAliases = new Set(others.map((row) => String(row.alias_local_part).toLowerCase()));
  const usedRefs = new Set(others.map((row) => String(row.ref_prefix).toUpperCase()));
  const baseAlias = createSuggestedMailAlias({
    userId: sender.userId,
    name: sender.name,
    email: sender.email,
  });
  const aliasLocalPart = usedAliases.has(baseAlias)
    ? addStableAliasSuffix(baseAlias, sender.userId)
    : baseAlias;
  const baseRef = createSuggestedRefPrefix(aliasLocalPart, sender.userId);
  const refPrefix = usedRefs.has(baseRef) ? addStableRefSuffix(baseRef, sender.userId) : baseRef;
  return { aliasLocalPart, refPrefix };
}

/** 管理员或业务员首次进入邮件工作台时自动建立可用的发件身份。 */
export async function ensureMailAgentProfile(sender: ActiveMailSender) {
  const supabase = getSupabaseServiceRoleClient();
  const existing = await supabase
    .from("mail_agent_profiles")
    .select(
      "user_id,alias_local_part,ref_prefix,sender_display_name_enc,signature_html_enc,enabled,version",
    )
    .eq("user_id", sender.userId)
    .maybeSingle();
  if (existing.error) databaseError("发件人配置暂时无法读取。", existing.error);
  if (existing.data) return existing.data;
  const generated = await generatedIdentifiers(sender);
  const { data: insertedData, error: insertedError } = await supabase
    .from("mail_agent_profiles")
    .insert({
      user_id: sender.userId,
      alias_local_part: generated.aliasLocalPart,
      ref_prefix: generated.refPrefix,
      sender_display_name_enc: encryptMailValue(sender.displayName, getMailEnv().contentKey),
      signature_html_enc: encryptMailValue("", getMailEnv().contentKey),
      enabled: true,
    })
    .select(
      "user_id,alias_local_part,ref_prefix,sender_display_name_enc,signature_html_enc,enabled,version",
    )
    .maybeSingle();
  if (insertedError || !insertedData) {
    // Next.js 可能同时发起页面与预取请求，两边都会尝试首次建档。唯一约束会让其中一个插入失败，
    // 但成功事务在极短时间内可能还没有对另一个请求可见，因此需要有限重读并取得权威行作为凭证。
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
      const raced = await supabase
        .from("mail_agent_profiles")
        .select(
          "user_id,alias_local_part,ref_prefix,sender_display_name_enc,signature_html_enc,enabled,version",
        )
        .eq("user_id", sender.userId)
        .maybeSingle();
      if (raced.error) databaseError("发件人配置暂时无法读取。", raced.error);
      if (raced.data) return raced.data;
    }
    databaseError("发件人配置没有确认创建。", insertedError);
  }
  return insertedData;
}
