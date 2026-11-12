import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { requireMailAdministrator } from "./mail-identity";
import { databaseError } from "./mail-thread-access";
import { normalizeMailIntakePattern, type DecryptedMailIntakeRule } from "./mail-intake";
import { createBlindIndex, decryptMailValue, encryptMailValue } from "./mail-security";
import type { MailIdentity, MailIntakeRule, MailIntakeRuleAction, MailIntakeRuleMatcher } from "./mail-types";

function decryptContent(value: string) {
  return decryptMailValue(value, getMailEnv().contentKey);
}

/** 后台来信只读取启用的规则。管理员页面另有入口，可以查看停用规则。 */
export async function loadDecryptedMailIntakeRules(): Promise<DecryptedMailIntakeRule[]> {
  const { data, error } = await getSupabaseServiceRoleClient().from("mail_intake_rules")
    .select("id,match_type,action,pattern_enc,enabled").eq("enabled", true).order("created_at", { ascending: true });
  if (error) databaseError("收件规则暂时无法读取。", error);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    matchType: row.match_type as MailIntakeRuleMatcher,
    action: row.action as MailIntakeRuleAction,
    pattern: decryptContent(String(row.pattern_enc)),
    enabled: Boolean(row.enabled),
  }));
}

export async function recordMailIntakeRuleHit(ruleId: string) {
  const { data, error } = await getSupabaseServiceRoleClient().rpc("record_mail_intake_rule_hit", { p_rule_id: ruleId });
  const receipt = Array.isArray(data) ? data[0] : null;
  if (error || receipt?.rule_id !== ruleId || Number(receipt.hit_count) < 1) databaseError("收件规则命中次数没有确认保存。", error);
}

export async function listMailIntakeRules(identity: MailIdentity): Promise<{ rules: MailIntakeRule[] }> {
  requireMailAdministrator(identity);
  const { data, error } = await getSupabaseServiceRoleClient().from("mail_intake_rules")
    .select("id,match_type,action,pattern_enc,enabled,hit_count,version,updated_at")
    .order("updated_at", { ascending: false });
  if (error) databaseError("收件规则暂时无法读取。", error);
  return { rules: (data ?? []).map((row) => ({
    id: row.id as string,
    matchType: row.match_type as MailIntakeRuleMatcher,
    action: row.action as MailIntakeRuleAction,
    pattern: decryptContent(String(row.pattern_enc)),
    enabled: Boolean(row.enabled),
    hitCount: Number(row.hit_count),
    version: Number(row.version),
    updatedAt: String(row.updated_at),
  })) };
}

export async function createMailIntakeRule(identity: MailIdentity, input: {
  matchType: MailIntakeRuleMatcher;
  action: MailIntakeRuleAction;
  pattern: string;
  enabled?: boolean;
}) {
  requireMailAdministrator(identity);
  const pattern = normalizeMailIntakePattern(input.matchType, input.pattern);
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("create_mail_intake_rule", {
    p_actor_user_id: identity.userId,
    p_match_type: input.matchType,
    p_action: input.action,
    p_pattern_enc: encryptMailValue(pattern, getMailEnv().contentKey),
    p_pattern_hash: createBlindIndex(`${input.matchType}:${pattern}`, getMailEnv().emailHashSecret),
    p_enabled: input.enabled ?? true,
  });
  if (error?.code === "23505") throw new Error("相同的收件规则已经存在。");
  const receipt = Array.isArray(data) ? data[0] : null;
  if (error || !receipt?.rule_id || !receipt.audit_id) databaseError("收件规则没有确认创建。", error);
  return { ruleId: String(receipt.rule_id), version: Number(receipt.version), auditId: Number(receipt.audit_id), created: true as const };
}

export async function updateMailIntakeRule(identity: MailIdentity, input: {
  ruleId: string;
  matchType: MailIntakeRuleMatcher;
  action: MailIntakeRuleAction;
  pattern: string;
  enabled: boolean;
  expectedVersion: number;
}) {
  requireMailAdministrator(identity);
  const pattern = normalizeMailIntakePattern(input.matchType, input.pattern);
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("update_mail_intake_rule", {
    p_actor_user_id: identity.userId,
    p_rule_id: input.ruleId,
    p_match_type: input.matchType,
    p_action: input.action,
    p_pattern_enc: encryptMailValue(pattern, getMailEnv().contentKey),
    p_pattern_hash: createBlindIndex(`${input.matchType}:${pattern}`, getMailEnv().emailHashSecret),
    p_enabled: input.enabled,
    p_expected_version: input.expectedVersion,
  });
  if (error?.code === "23505") throw new Error("相同的收件规则已经存在。");
  const receipt = Array.isArray(data) ? data[0] : null;
  if (error || receipt?.rule_id !== input.ruleId || !receipt.audit_id) throw new Error("规则已被其他人修改，请刷新后重试。", { cause: error });
  return { ruleId: input.ruleId, version: Number(receipt.version), auditId: Number(receipt.audit_id), updated: true as const };
}

export async function deleteMailIntakeRule(identity: MailIdentity, ruleId: string, expectedVersion: number) {
  requireMailAdministrator(identity);
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("delete_mail_intake_rule", {
    p_actor_user_id: identity.userId,
    p_rule_id: ruleId,
    p_expected_version: expectedVersion,
  });
  const receipt = Array.isArray(data) ? data[0] : null;
  if (error || receipt?.rule_id !== ruleId || !receipt.audit_id) throw new Error("规则已被其他人修改或不存在，请刷新后重试。", { cause: error });
  return { ruleId, deleted: true as const, auditId: Number(receipt.audit_id) };
}
