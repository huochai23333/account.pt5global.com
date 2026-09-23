import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { recordSuccessfulOutboundRecipients } from "./mail-recipient-service";
import { decryptMailValue, sha256 } from "./mail-security";
import { deleteEncryptedObjects } from "./mail-storage";

type OutboundMessageRow = {
  id: string;
  mailbox_id: string;
  thread_id: string;
  actor_user_id: string | null;
  to_enc: string;
  cc_enc: string;
  bcc_enc: string;
  occurred_at: string;
};

function decryptAddressList(value: string) {
  const parsed = JSON.parse(decryptMailValue(value, getMailEnv().contentKey)) as unknown;
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("历史已发送邮件的收件人格式无效。");
  }
  return parsed as string[];
}

async function loadMailboxEmails() {
  const { data, error } = await getSupabaseServiceRoleClient().from("mail_shared_mailboxes").select("id,email_enc");
  if (error) throw new Error("公司邮箱清单暂时无法读取。", { cause: error });
  return new Map((data ?? []).map((row) => [
    String(row.id),
    decryptMailValue(String(row.email_enc), getMailEnv().contentKey),
  ]));
}

/** 逐页回填已有 SENT 邮件，重复执行只会确认同一批盲索引。 */
export async function backfillOutboundRecipientHistory() {
  const supabase = getSupabaseServiceRoleClient();
  const mailboxEmails = await loadMailboxEmails();
  let offset = 0;
  let scannedMessages = 0;
  let recipientRows = 0;
  while (true) {
    const { data, error } = await supabase.from("mail_messages")
      .select("id,mailbox_id,thread_id,actor_user_id,to_enc,cc_enc,bcc_enc,occurred_at")
      .eq("direction", "outbound")
      .order("id", { ascending: true })
      .range(offset, offset + 199);
    if (error) throw new Error("历史已发送邮件暂时无法读取。", { cause: error });
    const rows = (data ?? []) as OutboundMessageRow[];
    for (const row of rows) {
      const mailboxEmail = mailboxEmails.get(row.mailbox_id);
      if (!mailboxEmail) throw new Error("历史邮件找不到对应的公司邮箱。");
      const receipt = await recordSuccessfulOutboundRecipients({
        mailboxId: row.mailbox_id,
        messageId: row.id,
        threadId: row.thread_id,
        actorUserId: row.actor_user_id,
        mailboxEmail,
        to: decryptAddressList(row.to_enc),
        cc: decryptAddressList(row.cc_enc),
        bcc: decryptAddressList(row.bcc_enc),
        occurredAt: row.occurred_at,
      });
      scannedMessages += 1;
      recipientRows += receipt.recipientCount;
    }
    if (rows.length < 200) break;
    offset += rows.length;
  }
  return { scannedMessages, recipientRows };
}

async function loadAllThreadIds() {
  const output: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await getSupabaseServiceRoleClient().from("mail_threads")
      .select("id").is("deleted_at", null).order("id", { ascending: true }).range(offset, offset + 499);
    if (error) throw new Error("历史邮件清理范围暂时无法读取。", { cause: error });
    const rows = data ?? [];
    output.push(...rows.map((row) => String(row.id)));
    if (rows.length < 500) break;
    offset += rows.length;
  }
  return output;
}

async function loadAllKnownThreadIds() {
  const output: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await getSupabaseServiceRoleClient().from("mail_outbound_recipients")
      .select("thread_id").order("thread_id", { ascending: true }).range(offset, offset + 499);
    if (error) throw new Error("历史邮件清理范围暂时无法读取。", { cause: error });
    const rows = data ?? [];
    output.push(...rows
      .map((row) => row.thread_id as string | null)
      .filter((value): value is string => Boolean(value)));
    if (rows.length < 500) break;
    offset += rows.length;
  }
  return output;
}

/** 预览令牌绑定精确会话集合，执行前集合变化时必须重新预览。 */
export async function previewUnknownHistoricalThreads() {
  const [threadIds, knownThreadIds] = await Promise.all([
    loadAllThreadIds(),
    loadAllKnownThreadIds(),
  ]);
  const known = new Set(knownThreadIds);
  const candidateThreadIds = threadIds.filter((id) => !known.has(id)).sort();
  return {
    scannedThreads: threadIds.length,
    candidateThreadIds,
    candidateCount: candidateThreadIds.length,
    confirmationToken: sha256(candidateThreadIds.join("\n")),
  };
}

async function deleteUnknownThread(threadId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { count, error: knownError } = await supabase.from("mail_outbound_recipients")
    .select("id", { count: "exact", head: true }).eq("thread_id", threadId);
  if (knownError) throw new Error("删除前无法复核客户联系记录。", { cause: knownError });
  if ((count ?? 0) > 0) throw new Error("会话已经产生成功发信记录，请重新预览。");
  const { data: messages, error: messageError } = await supabase.from("mail_messages").select("id").eq("thread_id", threadId);
  if (messageError) throw new Error("待删除会话的邮件暂时无法读取。", { cause: messageError });
  const messageIds = (messages ?? []).map((message) => String(message.id));
  const { data: attachments, error: attachmentError } = messageIds.length > 0
    ? await supabase.from("mail_attachments").select("storage_path").in("message_id", messageIds)
    : { data: [], error: null };
  if (attachmentError) throw new Error("待删除会话的附件暂时无法读取。", { cause: attachmentError });
  const storagePaths = (attachments ?? []).map((attachment) => String(attachment.storage_path));
  await deleteEncryptedObjects(storagePaths);
  const { data: audit, error: auditError } = await supabase.from("mail_audit_events").insert({
    actor_type: "system",
    event_type: "mail_unknown_thread_delete_started",
    entity_type: "mail_thread",
    entity_id: threadId,
    details: { gmail_copy_preserved: true, attachment_count: storagePaths.length },
  }).select("id").single();
  if (auditError || !audit) throw new Error("陌生会话删除审计没有确认保存。", { cause: auditError });
  const { data: removed, error: removeError } = await supabase.from("mail_threads").delete().eq("id", threadId).select("id").maybeSingle();
  if (removeError || removed?.id !== threadId) throw new Error("陌生会话没有确认删除。", { cause: removeError });
  const { data: completed, error: completedError } = await supabase.from("mail_audit_events")
    .update({ event_type: "mail_unknown_thread_deleted" }).eq("id", audit.id).select("id,event_type").single();
  if (completedError || completed?.event_type !== "mail_unknown_thread_deleted") {
    throw new Error("陌生会话删除完成状态没有确认保存。", { cause: completedError });
  }
  return { threadId, attachmentCount: storagePaths.length, auditId: Number(audit.id) };
}

export async function purgeUnknownHistoricalThreads(confirmationToken: string) {
  const preview = await previewUnknownHistoricalThreads();
  if (!confirmationToken || confirmationToken !== preview.confirmationToken) {
    throw new Error("历史邮件范围已经变化，请重新预览后再删除。");
  }
  const deleted = [] as Awaited<ReturnType<typeof deleteUnknownThread>>[];
  const failed: Array<{ threadId: string; error: string }> = [];
  for (const threadId of preview.candidateThreadIds) {
    try {
      deleted.push(await deleteUnknownThread(threadId));
    } catch (error) {
      failed.push({ threadId, error: error instanceof Error ? error.message : "删除失败" });
    }
  }
  return {
    status: failed.length === 0 ? "completed" as const : "partial_failed" as const,
    deleted,
    failed,
  };
}
