import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { buildOutboundRecipientAddresses } from "./mail-recipient-addresses";
import { createBlindIndex } from "./mail-security";

export type InboundRecipientHistory = {
  known: boolean;
  matchingThreadIds: string[];
  assignedMemberIds: string[];
};

/**
 * Gmail SENT 已经核验完成后，把本次所有外部收件人写入盲索引。
 * 返回值必须和预期地址数量完全一致，否则发信任务不能进入 sent。
 */
export async function recordSuccessfulOutboundRecipients(input: {
  mailboxId: string;
  messageId: string;
  threadId: string;
  actorUserId: string | null;
  mailboxEmail: string;
  to: string[];
  cc: string[];
  bcc: string[];
  occurredAt: string;
}) {
  const recipients = buildOutboundRecipientAddresses(input);
  if (recipients.length === 0) throw new Error("已发送邮件没有可确认的外部收件人。");
  const env = getMailEnv();
  const rows = recipients.map((recipient) => ({
    mailbox_id: input.mailboxId,
    message_id: input.messageId,
    thread_id: input.threadId,
    actor_user_id: input.actorUserId,
    email_hash: createBlindIndex(recipient.email, env.emailHashSecret),
    recipient_kind: recipient.kind,
    occurred_at: input.occurredAt,
  }));
  const expected = new Map(rows.map((row) => [row.email_hash, row.recipient_kind]));
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("mail_outbound_recipients")
    .upsert(rows, { onConflict: "message_id,email_hash" })
    .select("message_id,email_hash,recipient_kind");
  if (error || (data?.length ?? 0) !== rows.length) {
    throw new Error("已发送邮件的收件人凭证没有全部保存。", { cause: error });
  }
  const confirmed = new Map((data ?? []).map((row) => [String(row.email_hash), String(row.recipient_kind)]));
  if ([...expected].some(([hash, kind]) => confirmed.get(hash) !== kind)) {
    throw new Error("已发送邮件的收件人凭证与实际地址不一致。");
  }
  return { messageId: input.messageId, recipientCount: recipients.length };
}

/**
 * 收件只比较不可逆邮箱盲索引。负责人取自会话当前值，因此人工转派后，
 * 客户下一次直接来信会使用新的负责人，而不是最初发信人。
 */
export async function loadInboundRecipientHistory(mailboxId: string, senderEmail: string): Promise<InboundRecipientHistory> {
  const supabase = getSupabaseServiceRoleClient();
  const emailHash = createBlindIndex(senderEmail, getMailEnv().emailHashSecret);
  const { data: recipientRows, error: recipientError } = await supabase
    .from("mail_outbound_recipients")
    .select("thread_id")
    .eq("mailbox_id", mailboxId)
    .eq("email_hash", emailHash);
  if (recipientError) throw new Error("来信邮箱的联系记录暂时无法确认。", { cause: recipientError });
  if ((recipientRows?.length ?? 0) === 0) return { known: false, matchingThreadIds: [], assignedMemberIds: [] };
  const matchingThreadIds = [...new Set((recipientRows ?? [])
    .map((row) => row.thread_id as string | null)
    .filter((value): value is string => Boolean(value)))];
  // 即使原会话已由管理员删除，盲索引仍证明公司联系过该邮箱；此时只是不再继承旧负责人。
  if (matchingThreadIds.length === 0) return { known: true, matchingThreadIds: [], assignedMemberIds: [] };

  const { data: threads, error: threadError } = await supabase
    .from("mail_threads")
    .select("id,assigned_user_id")
    .in("id", matchingThreadIds)
    .is("deleted_at", null);
  if (threadError) throw new Error("已联系客户的负责人暂时无法确认。", { cause: threadError });
  const assignedMemberIds = [...new Set((threads ?? [])
    .map((thread) => thread.assigned_user_id as string | null)
    .filter((value): value is string => Boolean(value)))];
  return { known: true, matchingThreadIds, assignedMemberIds };
}

/** 陌生来信只保存不可逆 Gmail 编号和审计编号；重复 Push 返回同一份凭证。 */
export async function recordIgnoredUnknownInbound(input: {
  mailboxId: string;
  providerMessageId: string;
  occurredAt: string;
}) {
  const providerMessageHash = createBlindIndex(input.providerMessageId, getMailEnv().emailHashSecret);
  const { data, error } = await getSupabaseServiceRoleClient().rpc("record_mail_ignored_inbound", {
    p_mailbox_id: input.mailboxId,
    p_provider_message_hash: providerMessageHash,
    p_occurred_at: input.occurredAt,
  });
  const receipt = Array.isArray(data) ? data[0] : null;
  if (error || !receipt?.receipt_id || !receipt?.audit_id) {
    throw new Error("陌生来信的忽略凭证没有确认保存。", { cause: error });
  }
  return {
    receiptId: Number(receipt.receipt_id),
    auditId: Number(receipt.audit_id),
    created: receipt.created === true,
  };
}
