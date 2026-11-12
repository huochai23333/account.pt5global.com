/** 会话删除独立处理附件、审计和最终删除凭证；每一步失败都保留明确的未完成结果。 */
import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";
import { requireMailAdministrator } from "./mail-identity";
import { deleteEncryptedObjects } from "./mail-storage";
import type { MailIdentity } from "./mail-types";
function databaseError(message: string, error: unknown): never {
  throw new Error(message, { cause: error });
}

export async function deleteMailThread(identity: MailIdentity, threadId: string) {
  requireMailAdministrator(identity);
  const supabase = getSupabaseServiceRoleClient();
  const { data: thread, error: threadError } = await supabase
    .from("mail_threads")
    .select("id")
    .eq("id", threadId)
    .is("deleted_at", null)
    .maybeSingle();
  if (threadError || !thread) databaseError("没有找到可删除的邮件会话。", threadError);
  const { data: messages, error: messagesError } = await supabase
    .from("mail_messages")
    .select("id")
    .eq("thread_id", threadId);
  if (messagesError) databaseError("邮件附件清单暂时无法读取。", messagesError);
  const messageIds = (messages ?? []).map((message) => message.id as string);
  const { data: attachments, error: attachmentsError } = messageIds.length
    ? await supabase.from("mail_attachments").select("storage_path").in("message_id", messageIds)
    : { data: [], error: null };
  if (attachmentsError) databaseError("邮件附件清单暂时无法读取。", attachmentsError);
  await deleteEncryptedObjects(
    (attachments ?? []).map((attachment) => attachment.storage_path as string),
  );

  // 审计先于删除落库；如果后续删除失败，审计会明确记录未完成状态，便于管理员追查。
  const { data: auditData, error: auditError } = await supabase
    .from("mail_audit_events")
    .insert({
      actor_user_id: identity.userId,
      actor_type: "user",
      event_type: "mail_thread_delete_started",
      entity_type: "mail_thread",
      entity_id: threadId,
      details: { gmail_copy_preserved: true },
    })
    .select("id")
    .single();
  if (auditError || !auditData?.id) databaseError("删除审计没有确认保存。", auditError);
  const { data, error } = await supabase
    .from("mail_threads")
    .delete()
    .eq("id", threadId)
    .select("id")
    .single();
  if (error || data?.id !== threadId) databaseError("邮件会话没有确认删除。", error);
  const { data: completedAudit, error: completedAuditError } = await supabase
    .from("mail_audit_events")
    .update({ event_type: "mail_thread_deleted" })
    .eq("id", auditData.id)
    .select("id,event_type")
    .single();
  if (completedAuditError || completedAudit?.event_type !== "mail_thread_deleted")
    databaseError("删除审计没有确认完成。", completedAuditError);
  return {
    threadId,
    deleted: true as const,
    gmailCopyPreserved: true as const,
    auditId: auditData.id as string,
  };
}
