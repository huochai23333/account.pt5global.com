import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { requireMailAdministrator } from "./mail-identity";
import { databaseError } from "./mail-thread-access";
import { listActiveMailSenders } from "./mail-agent-directory";
import { ensureMailAgentProfile, generatedIdentifiers, suggestIdentifiersFromProfiles } from "./mail-agent-provisioning";
import { decryptMailValue, encryptMailValue } from "./mail-security";
import type { MailAgentProfile, MailIdentity } from "./mail-types";

function decryptContent(value: string) {
  return decryptMailValue(value, getMailEnv().contentKey);
}

export async function listMailAgents(identity: MailIdentity) {
  requireMailAdministrator(identity);
  const supabase = getSupabaseServiceRoleClient();
  const senders = await listActiveMailSenders();
  if (senders.length === 0) return { agents: [] as MailAgentProfile[] };
  const ids = senders.map((agent) => agent.userId);
  const [existingProfiles, bindingsResult] = await Promise.all([
    supabase
      .from("mail_agent_profiles")
      .select(
        "user_id,alias_local_part,ref_prefix,sender_display_name_enc,signature_html_enc,enabled,version",
      ),
    supabase.from("mail_feishu_bindings").select("user_id").in("user_id", ids),
  ]);
  if (existingProfiles.error || bindingsResult.error)
    databaseError("邮件人员设置暂时无法读取。", existingProfiles.error ?? bindingsResult.error);
  const allProfiles = [...(existingProfiles.data ?? [])];
  const knownIds = new Set(allProfiles.map((row) => String(row.user_id)));
  // 旧账号已有配置时不再逐人查询；首次建档仍逐个执行，避免多人同名时并发生成重复标识。
  for (const sender of senders) {
    if (knownIds.has(sender.userId)) continue;
    const created = await ensureMailAgentProfile(sender);
    allProfiles.push(created);
    knownIds.add(sender.userId);
  }
  const profiles = new Map(allProfiles.map((row) => [row.user_id as string, row]));
  const bound = new Set((bindingsResult.data ?? []).map((row) => row.user_id as string));
  const agents = senders.map((sender) => {
    const profile = profiles.get(sender.userId);
    if (!profile) throw new Error("发件人员资料没有确认创建。");
    const suggested = suggestIdentifiersFromProfiles(sender, allProfiles);
    return {
      memberId: sender.userId,
      displayName: sender.displayName,
      role: sender.role,
      aliasLocalPart: String(profile?.alias_local_part ?? ""),
      refPrefix: String(profile?.ref_prefix ?? ""),
      senderDisplayName: profile
        ? decryptContent(String(profile.sender_display_name_enc))
        : sender.displayName,
      signatureHtml: profile ? decryptContent(String(profile.signature_html_enc)) : "",
      feishuBound: bound.has(sender.userId),
      enabled: Boolean(profile?.enabled),
      version: Number(profile.version),
      suggestedAliasLocalPart: suggested.aliasLocalPart,
      suggestedRefPrefix: suggested.refPrefix,
    } satisfies MailAgentProfile;
  });
  return { agents };
}

export async function getMailAgentProfile(identity: MailIdentity, memberId = identity.userId) {
  const senders = await listActiveMailSenders();
  const sender = senders.find((agent) => agent.userId === memberId);
  if (!sender) throw new Error("目标发件人员当前不可用。");
  if (identity.role !== "administrator" && memberId !== identity.userId)
    throw new Error("只能查看自己的发件设置。");
  const profile = await ensureMailAgentProfile(sender);
  const suggested = await generatedIdentifiers(sender);
  const binding = await getSupabaseServiceRoleClient()
    .from("mail_feishu_bindings")
    .select("user_id")
    .eq("user_id", memberId)
    .maybeSingle();
  if (binding.error) databaseError("飞书绑定状态暂时无法读取。", binding.error);
  return {
    memberId,
    displayName: sender.displayName,
    role: sender.role,
    aliasLocalPart: String(profile.alias_local_part),
    refPrefix: String(profile.ref_prefix),
    senderDisplayName: decryptContent(String(profile.sender_display_name_enc)),
    signatureHtml: decryptContent(String(profile.signature_html_enc)),
    feishuBound: Boolean(binding.data),
    enabled: Boolean(profile.enabled),
    version: Number(profile.version),
    suggestedAliasLocalPart: suggested.aliasLocalPart,
    suggestedRefPrefix: suggested.refPrefix,
  } satisfies MailAgentProfile;
}

export async function updateMailAgentProfile(
  identity: MailIdentity,
  profile: Omit<
    MailAgentProfile,
    "displayName" | "role" | "feishuBound" | "suggestedAliasLocalPart" | "suggestedRefPrefix"
  > & { resetToGenerated?: boolean },
) {
  const senders = await listActiveMailSenders();
  const sender = senders.find((agent) => agent.userId === profile.memberId);
  if (!sender) throw new Error("目标发件人员当前不可用。");
  if (identity.role !== "administrator" && identity.userId !== profile.memberId)
    throw new Error("只能修改自己的发件设置。");
  const current = await ensureMailAgentProfile(sender);
  if (Number(current.version) !== profile.version)
    throw new Error("发件设置已被其他人修改，请刷新后重试。");
  const suggested = await generatedIdentifiers(sender);
  const alias = (profile.resetToGenerated ? suggested.aliasLocalPart : profile.aliasLocalPart)
    .trim()
    .toLowerCase();
  const refPrefix = (profile.resetToGenerated ? suggested.refPrefix : profile.refPrefix)
    .trim()
    .toUpperCase();
  if (!/^[a-z0-9][a-z0-9.-]{1,39}$/.test(alias)) throw new Error("邮箱别名格式不正确。");
  if (!/^[A-Z0-9]{2,16}$/.test(refPrefix)) throw new Error("Ref 前缀格式不正确。");
  const update = {
    alias_local_part: alias,
    ref_prefix: refPrefix,
    sender_display_name_enc: encryptMailValue(
      profile.senderDisplayName.trim(),
      getMailEnv().contentKey,
    ),
    signature_html_enc: encryptMailValue(profile.signatureHtml, getMailEnv().contentKey),
    enabled: identity.role === "administrator" ? profile.enabled : Boolean(current.enabled),
    version: profile.version + 1,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("mail_agent_profiles")
    .update(update)
    .eq("user_id", profile.memberId)
    .eq("version", profile.version)
    .select("user_id,alias_local_part,ref_prefix,enabled,version")
    .maybeSingle();
  if (error?.code === "23505") throw new Error("这个别名或 Ref 前缀已被其他发件人员使用。");
  if (error || data?.user_id !== profile.memberId)
    throw new Error("发件设置已被其他人修改，请刷新后重试。", { cause: error });
  // 数据库返回的必须是同一账号的新版本，并且与实际允许写入的字段一致。
  if (data.alias_local_part !== alias || data.ref_prefix !== refPrefix ||
      data.enabled !== update.enabled || data.version !== update.version) {
    throw new Error("发件人配置保存结果没有确认完整。");
  }
  return {
    memberId: data.user_id as string,
    aliasLocalPart: data.alias_local_part as string,
    refPrefix: data.ref_prefix as string,
    enabled: Boolean(data.enabled),
    version: Number(data.version),
  };
}
