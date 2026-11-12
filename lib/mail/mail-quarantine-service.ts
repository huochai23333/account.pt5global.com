import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { requireMailAdministrator } from "./mail-identity";
import { databaseError } from "./mail-thread-access";
import { createMailIntakeRule } from "./mail-intake-rules-service";
import { createBlindIndex, decryptMailValue } from "./mail-security";
import { matchesQuarantineUpdates } from "./mail-quarantine-receipt";
import type { MailIdentity, MailQuarantineItem, MailQuarantineReceipt } from "./mail-types";

function decryptContent(value: string) {
  return decryptMailValue(value, getMailEnv().contentKey);
}

export async function queryMailQuarantine(identity: MailIdentity, input: {
  page?: number;
  customerEmail?: string;
  refCode?: string;
  assignedMemberId?: string;
  startAt?: string;
  endAt?: string;
}) {
  requireMailAdministrator(identity);
  const page = input.page ?? 1;
  if (!Number.isSafeInteger(page) || page < 1) throw new Error("请选择有效的页码。");
  let query = getSupabaseServiceRoleClient().from("mail_threads")
    .select("id,subject_enc,customer_email_enc,assigned_user_id,quarantine_reason,quarantined_at,last_message_at,version", { count: "exact" })
    .eq("intake_status", "quarantined").is("deleted_at", null)
    .order("quarantined_at", { ascending: false }).order("id", { ascending: false });
  // 客户邮箱使用盲索引做精确检索，数据库中仍不会出现明文邮箱。
  if (input.customerEmail?.trim()) {
    query = query.eq("customer_email_hash", createBlindIndex(input.customerEmail.trim(), getMailEnv().emailHashSecret));
  }
  if (input.refCode?.trim()) query = query.eq("ref_code", input.refCode.trim().toUpperCase());
  if (input.assignedMemberId?.trim()) query = query.eq("assigned_user_id", input.assignedMemberId.trim());
  if (input.startAt) query = query.gte("quarantined_at", input.startAt);
  if (input.endAt) query = query.lte("quarantined_at", input.endAt);
  // 数量和当前页使用完全相同的筛选，二十条之外的邮件不会被错误地算作不存在。
  const { data, error, count } = await query.range((page - 1) * 20, page * 20 - 1);
  if (error) databaseError("隔离邮件暂时无法读取。", error);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((row) => row.assigned_user_id as string | null).filter((value): value is string => Boolean(value)))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const profiles = await getSupabaseServiceRoleClient().from("user_profiles").select("user_id,name,email").in("user_id", ids);
    if (profiles.error) databaseError("隔离邮件负责人暂时无法读取。", profiles.error);
    for (const profile of profiles.data ?? []) names.set(profile.user_id as string, String(profile.name ?? profile.email ?? "内部员工"));
  }
  const items: MailQuarantineItem[] = rows.map((row) => ({
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
  return { items, totalCount: count ?? 0 };
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
  if (error || !Array.isArray(data)) databaseError("邮件没有全部确认移入隔离区。", error);
  const updated = data.map((row) => ({ threadId: String(row.thread_id), version: Number(row.version) }));
  if (!matchesQuarantineUpdates(input.threads, updated)) databaseError("邮件没有全部确认移入隔离区。", null);
  return {
    status: failed.length > 0 ? "partial_failed" : "completed",
    updated,
    failed,
    ruleId,
  };
}
