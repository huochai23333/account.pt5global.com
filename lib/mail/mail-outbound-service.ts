import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { encryptMailValue } from "./mail-security";
import { assertThreadAccess, databaseError } from "./mail-service";
import type { MailIdentity, OutboundJobReceipt, OutboundMessageInput } from "./mail-types";

/** 发信请求与状态查询共用同一发送标识，避免页面重试建立第二个任务。 */

function normalizeAddressList(values: string[]) {
  const result = [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
  if (result.some((value) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
    throw new Error("请检查收件人邮箱地址。");
  }
  return result;
}

export async function createOutboundMessage(identity: MailIdentity, message: OutboundMessageInput) {
  const to = normalizeAddressList(message.to);
  const cc = normalizeAddressList(message.cc);
  const bcc = normalizeAddressList(message.bcc);
  if (to.length === 0) throw new Error("请至少填写一个收件人。");
  if (message.attachmentIds.length > 10) throw new Error("每封邮件最多添加 10 个附件。");
  if (!message.idempotencyKey.trim()) throw new Error("发送标识不能为空。");
  if (message.threadId) await assertThreadAccess(identity, message.threadId);

  const supabase = getSupabaseServiceRoleClient();
  const [mailboxResult, profileResult, existingResult] = await Promise.all([
    supabase.from("mail_shared_mailboxes").select("id,status").eq("status", "active").maybeSingle(),
    supabase.from("mail_agent_profiles").select("user_id").eq("user_id", identity.userId).eq("enabled", true).maybeSingle(),
    supabase.from("mail_outbound_jobs")
      .select("id,status").eq("actor_user_id", identity.userId).eq("idempotency_key", message.idempotencyKey).maybeSingle(),
  ]);
  if (mailboxResult.error || profileResult.error || existingResult.error) databaseError("发信条件暂时无法确认。", mailboxResult.error ?? profileResult.error ?? existingResult.error);
  if (!mailboxResult.data) throw new Error("公司邮箱尚未连接或当前不可用。");
  if (!profileResult.data) throw new Error("请先让管理员完善你的发件资料。");
  if (existingResult.data) return { jobId: existingResult.data.id as string, status: existingResult.data.status as string, created: false };

  let totalBytes = 0;
  if (message.attachmentIds.length > 0) {
    const { data: uploads, error } = await supabase.from("mail_uploads")
      .select("id,byte_size,scan_status,consumed_at,expires_at")
      .eq("user_id", identity.userId)
      .in("id", message.attachmentIds);
    if (error) databaseError("附件状态暂时无法确认。", error);
    if ((uploads ?? []).length !== message.attachmentIds.length) throw new Error("部分附件不存在，请重新上传。");
    if ((uploads ?? []).some((upload) => upload.scan_status !== "clean" || upload.consumed_at || new Date(upload.expires_at as string) <= new Date())) {
      throw new Error("部分附件未通过安全检查或已经过期。");
    }
    totalBytes = (uploads ?? []).reduce((sum, upload) => sum + Number(upload.byte_size), 0);
    if (totalBytes > 20 * 1024 * 1024) throw new Error("附件合计不能超过 20 MiB。");
  }

  const payload = { ...message, to, cc, bcc };
  const { data, error } = await supabase.from("mail_outbound_jobs").insert({
    mailbox_id: mailboxResult.data.id,
    actor_user_id: identity.userId,
    thread_id: message.threadId ?? null,
    idempotency_key: message.idempotencyKey,
    payload_enc: encryptMailValue(JSON.stringify(payload), getMailEnv().contentKey),
  }).select("id,status").single();
  if (error || !data) {
    const duplicate = await supabase.from("mail_outbound_jobs")
      .select("id,status").eq("actor_user_id", identity.userId).eq("idempotency_key", message.idempotencyKey).maybeSingle();
    if (duplicate.data) return { jobId: duplicate.data.id as string, status: duplicate.data.status as string, created: false };
    databaseError("邮件发送任务没有确认创建。", error);
  }
  return { jobId: data.id as string, status: data.status as string, created: true };
}

export async function getOutboundStatus(identity: MailIdentity, jobId: string): Promise<OutboundJobReceipt> {
  let query = getSupabaseServiceRoleClient().from("mail_outbound_jobs")
    .select("id,status,provider_message_id,provider_thread_id,last_error")
    .eq("id", jobId);
  if (identity.role !== "administrator") query = query.eq("actor_user_id", identity.userId);
  const { data, error } = await query.maybeSingle();
  if (error) databaseError("发送状态暂时无法读取。", error);
  if (!data) throw new Error("没有找到这个发送任务。");
  return {
    jobId: data.id as string,
    status: data.status as OutboundJobReceipt["status"],
    providerMessageId: data.provider_message_id as string | null,
    providerThreadId: data.provider_thread_id as string | null,
    lastError: data.last_error as string | null,
  };
}

/** 页面丢失创建任务的响应时，按当前用户与发送标识找回原任务，不会再次入队。 */
export async function findOutboundJobByKey(identity: MailIdentity, key: string) {
  if (!key || key.length > 100) throw new Error("发送标识无效。");
  const { data, error } = await getSupabaseServiceRoleClient().from("mail_outbound_jobs")
    .select("id").eq("actor_user_id", identity.userId).eq("idempotency_key", key).maybeSingle();
  if (error) databaseError("发送状态暂时无法读取。", error);
  return { jobId: (data?.id as string | undefined) ?? null };
}
