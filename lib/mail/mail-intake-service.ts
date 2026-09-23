import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { requireMailAdministrator } from "./mail-identity";
import {
  normalizeMailIntakePattern,
  type DecryptedMailIntakeRule,
} from "./mail-intake";
import { extractEmailAddresses } from "./mail-recipient-addresses";
import { loadInboundRecipientHistory } from "./mail-recipient-service";
import { decideMailRouting } from "./mail-routing";
import { createUniqueMailRef, loadMailRoutingAgents } from "./mail-routing-service";
import { createBlindIndex, decryptMailValue, encryptMailValue } from "./mail-security";
import type {
  MailIdentity,
  MailIntakeRule,
  MailIntakeRuleAction,
  MailIntakeRuleMatcher,
  MailQuarantineItem,
  MailQuarantineReceipt,
} from "./mail-types";

function databaseError(message: string, error: unknown): never {
  throw new Error(message, { cause: error });
}

function decryptContent(value: string) {
  return decryptMailValue(value, getMailEnv().contentKey);
}

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

export async function queryMailQuarantine(identity: MailIdentity, input: {
  cursor?: string;
  limit?: number;
  customerEmail?: string;
  refCode?: string;
  assignedMemberId?: string;
  startAt?: string;
  endAt?: string;
}) {
  requireMailAdministrator(identity);
  const limit = Math.max(1, Math.min(input.limit ?? 40, 100));
  const cursor = input.cursor ? new Date(input.cursor) : null;
  if (cursor && Number.isNaN(cursor.getTime())) throw new Error("隔离列表位置无效。");
  let query = getSupabaseServiceRoleClient().from("mail_threads")
    .select("id,subject_enc,customer_email_enc,assigned_user_id,quarantine_reason,quarantined_at,last_message_at,version")
    .eq("intake_status", "quarantined").is("deleted_at", null)
    .order("quarantined_at", { ascending: false }).limit(limit + 1);
  // 客户邮箱使用盲索引做精确检索，数据库中仍不会出现明文邮箱。
  if (input.customerEmail?.trim()) {
    query = query.eq("customer_email_hash", createBlindIndex(input.customerEmail.trim(), getMailEnv().emailHashSecret));
  }
  if (input.refCode?.trim()) query = query.eq("ref_code", input.refCode.trim().toUpperCase());
  if (input.assignedMemberId?.trim()) query = query.eq("assigned_user_id", input.assignedMemberId.trim());
  if (input.startAt) query = query.gte("quarantined_at", input.startAt);
  if (input.endAt) query = query.lte("quarantined_at", input.endAt);
  if (cursor) query = query.lt("quarantined_at", cursor.toISOString());
  const { data, error } = await query;
  if (error) databaseError("隔离邮件暂时无法读取。", error);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((row) => row.assigned_user_id as string | null).filter((value): value is string => Boolean(value)))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const profiles = await getSupabaseServiceRoleClient().from("user_profiles").select("user_id,name,email").in("user_id", ids);
    if (profiles.error) databaseError("隔离邮件负责人暂时无法读取。", profiles.error);
    for (const profile of profiles.data ?? []) names.set(profile.user_id as string, String(profile.name ?? profile.email ?? "内部员工"));
  }
  const items: MailQuarantineItem[] = rows.slice(0, limit).map((row) => ({
    id: row.id as string,
    subject: decryptContent(String(row.subject_enc)),
    customerEmail: decryptContent(String(row.customer_email_enc)),
    assignedMemberId: row.assigned_user_id as string | null,
    assignedDisplayName: row.assigned_user_id ? names.get(row.assigned_user_id as string) ?? "内部员工" : null,
    reason: String(row.quarantine_reason ?? "已移入隔离区"),
    quarantinedAt: String(row.quarantined_at),
    lastMessageAt: String(row.last_message_at),
    version: Number(row.version),
  }));
  return { items, nextCursor: rows.length > limit ? items.at(-1)?.quarantinedAt ?? null : null };
}

async function assertQuarantineAccess(identity: MailIdentity, threads: Array<{ threadId: string; expectedVersion: number }>) {
  if (threads.length === 0 || threads.length > 100) throw new Error("请选择 1 到 100 个邮件会话。");
  const ids = [...new Set(threads.map((thread) => thread.threadId))];
  if (ids.length !== threads.length) throw new Error("隔离列表中存在重复会话。");
  let query = getSupabaseServiceRoleClient().from("mail_threads")
    .select("id,assigned_user_id,version,customer_email_enc")
    .in("id", ids).eq("intake_status", "active").is("deleted_at", null);
  if (identity.role !== "administrator") {
    if (ids.length !== 1) throw new Error("业务员每次只能隔离一个自己负责的会话。");
    query = query.eq("assigned_user_id", identity.userId);
  }
  const { data, error } = await query;
  if (error) databaseError("隔离权限暂时无法确认。", error);
  if ((data ?? []).length !== ids.length) throw new Error("部分会话不存在、已隔离或没有权限。");
  for (const row of data ?? []) {
    const expected = threads.find((thread) => thread.threadId === row.id)?.expectedVersion;
    if (expected !== Number(row.version)) throw new Error("会话已被其他人更新，请刷新后重试。");
  }
  return data ?? [];
}

export async function quarantineMailThreads(identity: MailIdentity, input: {
  threads: Array<{ threadId: string; expectedVersion: number }>;
  reason: string;
  createRule?: "none" | "sender" | "domain";
}): Promise<MailQuarantineReceipt> {
  const rows = await assertQuarantineAccess(identity, input.threads);
  if (input.createRule && input.createRule !== "none") requireMailAdministrator(identity);
  let ruleId: string | null = null;
  const failed: MailQuarantineReceipt["failed"] = [];
  if (input.createRule && input.createRule !== "none") {
    const patterns = [...new Set(rows.map((row) => {
      const sender = decryptContent(String(row.customer_email_enc)).toLowerCase();
      return input.createRule === "domain" ? sender.split("@")[1] ?? "" : sender;
    }).filter(Boolean))];
    for (const pattern of patterns) {
      try {
        const receipt = await createMailIntakeRule(identity, { matchType: input.createRule, action: "quarantine", pattern });
        ruleId ??= receipt.ruleId;
      } catch (error) {
        failed.push({ threadId: "rule", error: error instanceof Error ? error.message : "长期收件规则没有创建。" });
      }
    }
  }

  const { data, error } = await getSupabaseServiceRoleClient().rpc("quarantine_mail_threads", {
    p_actor_user_id: identity.userId,
    p_thread_ids: input.threads.map((thread) => thread.threadId),
    p_expected_versions: input.threads.map((thread) => thread.expectedVersion),
    p_reason: input.reason.trim() || "手动移入隔离区",
    p_rule_id: ruleId,
  });
  if (error?.message.includes("MAIL_VERSION_CONFLICT")) throw new Error("部分会话已被其他人更新，整批操作没有执行。");
  if (error || !Array.isArray(data) || data.length !== input.threads.length) databaseError("邮件没有全部确认移入隔离区。", error);
  return {
    status: failed.length > 0 ? "partial_failed" : "completed",
    updated: data.map((row) => ({ threadId: String(row.thread_id), version: Number(row.version) })),
    failed,
    ruleId,
  };
}

export async function restoreMailThread(identity: MailIdentity, threadId: string, expectedVersion: number) {
  requireMailAdministrator(identity);
  const supabase = getSupabaseServiceRoleClient();
  const [threadResult, messageResult] = await Promise.all([
    supabase.from("mail_threads")
      .select("id,mailbox_id,assigned_user_id,ref_code,provider_thread_id,version")
      .eq("id", threadId).eq("intake_status", "quarantined").is("deleted_at", null).maybeSingle(),
    supabase.from("mail_messages")
      .select("from_enc,to_enc,cc_enc,subject_enc,text_body_enc,html_body_enc,raw_headers_enc")
      .eq("thread_id", threadId).eq("direction", "inbound").order("occurred_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (threadResult.error || messageResult.error) databaseError("隔离邮件暂时无法恢复。", threadResult.error ?? messageResult.error);
  if (!threadResult.data || !messageResult.data) throw new Error("隔离邮件不存在或缺少来信内容。");
  if (Number(threadResult.data.version) !== expectedVersion) throw new Error("会话已被其他人更新，请刷新后重试。");

  const message = messageResult.data;
  const headers = JSON.parse(decryptContent(String(message.raw_headers_enc))) as Record<string, string>;
  const senderEmail = extractEmailAddresses(decryptContent(String(message.from_enc)))[0];
  if (!senderEmail) throw new Error("隔离邮件没有可识别的发件邮箱。");
  const recipientHistory = await loadInboundRecipientHistory(
    String(threadResult.data.mailbox_id),
    senderEmail,
  );
  if (!recipientHistory.known) throw new Error("该发件邮箱不在系统已联系名单中，不能恢复到工作台。");
  const agents = await loadMailRoutingAgents();
  const routing = decideMailRouting({
    knownAssignedMemberId: threadResult.data.assigned_user_id as string | null,
    recipientHistoryMemberIds: recipientHistory.assignedMemberIds,
    deliveredTo: headers["delivered-to"] ? [headers["delivered-to"]] : [],
    to: JSON.parse(decryptContent(String(message.to_enc))) as string[],
    cc: JSON.parse(decryptContent(String(message.cc_enc))) as string[],
    subject: decryptContent(String(message.subject_enc)),
    textBody: decryptContent(String(message.text_body_enc)),
    htmlBody: decryptContent(String(message.html_body_enc)),
  }, agents);
  const assignedAgent = agents.find((agent) => agent.memberId === routing.assignedMemberId);
  const refCode = (threadResult.data.ref_code as string | null) ?? await createUniqueMailRef(assignedAgent?.refPrefix ?? "GENERAL");
  const { data, error } = await supabase.rpc("restore_mail_thread", {
    p_actor_user_id: identity.userId,
    p_thread_id: threadId,
    p_expected_version: expectedVersion,
    p_assigned_user_id: routing.assignedMemberId,
    p_ref_code: refCode,
    p_routing_source: routing.source,
    p_routing_evidence: { ...routing.evidence, conflicting: routing.conflicting },
  });
  const result = Array.isArray(data) ? data[0] : null;
  if (error?.message.includes("MAIL_VERSION_CONFLICT")) throw new Error("会话已被其他人更新，请刷新后重试。");
  if (error || !result || String(result.thread_id) !== threadId) databaseError("隔离邮件没有确认恢复。", error);
  return {
    threadId,
    assignedMemberId: result.assigned_user_id as string | null,
    refCode: String(result.ref_code),
    version: Number(result.version),
    notificationCount: Number(result.notification_count),
  };
}
