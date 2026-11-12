/** 对已确认发送的邮件核对/补齐业务归档；该模块不再次调用发送接口。 */
import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";
import { getMailEnv } from "./mail-env";
import { createBlindIndex, encryptMailValue } from "./mail-security";
import { recordSuccessfulOutboundRecipients } from "./mail-recipient-service";
import type { OutboundMessageInput } from "./mail-types";
import type { JobRow, Context } from "./mail-outbound-types";
import type { buildMime } from "./mail-outbound-content";

export async function finalizeSentJob(
  job: JobRow,
  payload: OutboundMessageInput,
  context: Context,
  mime: Awaited<ReturnType<typeof buildMime>>,
  providerMessageId: string,
  providerThreadId: string,
) {
  const supabase = getSupabaseServiceRoleClient();
  const existing = await supabase
    .from("mail_messages")
    .select("id,thread_id,occurred_at")
    .eq("mailbox_id", job.mailbox_id)
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();
  if (existing.error) throw new Error("已发送邮件状态暂时无法确认。", { cause: existing.error });
  if (existing.data) {
    await recordSuccessfulOutboundRecipients({
      mailboxId: job.mailbox_id,
      messageId: existing.data.id as string,
      threadId: existing.data.thread_id as string,
      actorUserId: job.actor_user_id,
      mailboxEmail: context.mailboxEmail,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      occurredAt: String(existing.data.occurred_at),
    });
    const done = await supabase
      .from("mail_outbound_jobs")
      .update({
        status: "sent",
        sent_message_id: existing.data.id,
        completed_at: new Date().toISOString(),
        locked_at: null,
        last_error: null,
      })
      .eq("id", job.id)
      .select("id,status")
      .single();
    if (done.error || done.data?.status !== "sent")
      throw new Error("发送任务没有确认完成。", { cause: done.error });
    return;
  }

  let threadId = job.thread_id;
  const now = new Date().toISOString();
  if (!threadId) {
    const customerEmail = payload.to[0];
    if (!customerEmail) throw new Error("新邮件没有主收件人。");
    const { data: createdData, error: createdError } = await supabase
      .from("mail_threads")
      .insert({
        mailbox_id: job.mailbox_id,
        provider_thread_id: providerThreadId,
        subject_enc: encryptMailValue(mime.subject, getMailEnv().contentKey),
        customer_email_enc: encryptMailValue(customerEmail, getMailEnv().contentKey),
        customer_email_hash: createBlindIndex(customerEmail, getMailEnv().emailHashSecret),
        assigned_user_id: job.actor_user_id,
        state: "waiting_customer",
        ref_code: mime.refCode,
        routing_source: "manual",
        last_message_at: now,
        last_outbound_at: now,
      })
      .select("id")
      .single();
    if (createdError || !createdData)
      throw new Error("新发邮件会话没有确认保存。", { cause: createdError });
    threadId = createdData.id as string;
    const { data: assignmentData, error: assignmentError } = await supabase
      .from("mail_assignment_events")
      .insert({
        thread_id: threadId,
        actor_user_id: job.actor_user_id,
        assigned_user_id: job.actor_user_id,
        reason: "新建邮件",
        thread_version: 1,
      })
      .select("id")
      .single();
    if (assignmentError || !assignmentData)
      throw new Error("新邮件指派记录没有确认保存。", { cause: assignmentError });
  } else {
    const current = await supabase
      .from("mail_threads")
      .select("version,assigned_user_id")
      .eq("id", threadId)
      .single();
    if (current.error || current.data?.assigned_user_id !== job.actor_user_id)
      throw new Error("回复后的会话负责人没有确认。", { cause: current.error });
    const updated = await supabase
      .from("mail_threads")
      .update({
        state: "waiting_customer",
        last_message_at: now,
        last_outbound_at: now,
        version: Number(current.data.version) + 1,
        updated_at: now,
      })
      .eq("id", threadId)
      .eq("version", current.data.version)
      .select("id")
      .maybeSingle();
    if (updated.error || updated.data?.id !== threadId)
      throw new Error("回复后的会话状态没有确认保存。", { cause: updated.error });
  }

  const { data: savedData, error: savedError } = await supabase
    .from("mail_messages")
    .insert({
      mailbox_id: job.mailbox_id,
      thread_id: threadId,
      provider_message_id: providerMessageId,
      rfc_message_id_hash: mime.rfcMessageId
        ? createBlindIndex(mime.rfcMessageId, getMailEnv().emailHashSecret)
        : null,
      direction: "outbound",
      actor_user_id: job.actor_user_id,
      from_enc: encryptMailValue(
        `${context.senderDisplayName} <${context.mailboxEmail}>`,
        getMailEnv().contentKey,
      ),
      to_enc: encryptMailValue(JSON.stringify(payload.to), getMailEnv().contentKey),
      cc_enc: encryptMailValue(JSON.stringify(payload.cc), getMailEnv().contentKey),
      bcc_enc: encryptMailValue(JSON.stringify(payload.bcc), getMailEnv().contentKey),
      subject_enc: encryptMailValue(mime.subject, getMailEnv().contentKey),
      text_body_enc: encryptMailValue(mime.text, getMailEnv().contentKey),
      html_body_enc: encryptMailValue(mime.html, getMailEnv().contentKey),
      raw_headers_enc: encryptMailValue(
        JSON.stringify({ "message-id": mime.rfcMessageId }),
        getMailEnv().contentKey,
      ),
      occurred_at: now,
    })
    .select("id,occurred_at")
    .single();
  if (savedError || !savedData) throw new Error("已发送邮件没有确认保存。", { cause: savedError });
  for (const attachment of mime.attachments) {
    const { data: archivedData, error: archivedError } = await supabase
      .from("mail_attachments")
      .insert({
        message_id: savedData.id,
        storage_path: attachment.storagePath,
        filename_enc: attachment.filenameEnc,
        content_type_enc: attachment.contentTypeEnc,
        byte_size: attachment.byteSize,
        cipher_sha256: attachment.cipherSha256,
        scan_status: attachment.scanStatus,
      })
      .select("id")
      .single();
    if (archivedError || !archivedData)
      throw new Error("已发送附件没有确认归档。", { cause: archivedError });
    const { data: consumedData, error: consumedError } = await supabase
      .from("mail_uploads")
      .update({ consumed_at: now })
      .eq("id", attachment.id)
      .is("consumed_at", null)
      .select("id")
      .single();
    if (consumedError || consumedData?.id !== attachment.id)
      throw new Error("附件上传记录没有确认归档。", { cause: consumedError });
  }
  await recordSuccessfulOutboundRecipients({
    mailboxId: job.mailbox_id,
    messageId: savedData.id as string,
    threadId,
    actorUserId: job.actor_user_id,
    mailboxEmail: context.mailboxEmail,
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    occurredAt: String(savedData.occurred_at),
  });
  const { data: completedData, error: completedError } = await supabase
    .from("mail_outbound_jobs")
    .update({
      status: "sent",
      sent_message_id: savedData.id,
      completed_at: now,
      locked_at: null,
      last_error: null,
      updated_at: now,
    })
    .eq("id", job.id)
    .select("id,status,provider_message_id")
    .single();
  if (
    completedError ||
    completedData?.status !== "sent" ||
    completedData.provider_message_id !== providerMessageId
  ) {
    throw new Error("发送完成凭证没有确认保存。", { cause: completedError });
  }
}
