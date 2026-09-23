import MailComposer from "nodemailer/lib/mail-composer/index.js";
import sanitizeHtml from "sanitize-html";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { findSentMessageByRfcId, getSharedAccessToken, sendRawMessage, verifySentMessage } from "./mail-google";
import { createBlindIndex, decryptMailValue, encryptMailValue } from "./mail-security";
import { recordSuccessfulOutboundRecipients } from "./mail-recipient-service";
import { downloadEncryptedObject } from "./mail-storage";
import type { OutboundMessageInput } from "./mail-types";

type JobRow = {
  id: string;
  mailbox_id: string;
  actor_user_id: string;
  thread_id: string | null;
  payload_enc: string;
  attempt_count: number;
  provider_message_id: string | null;
  provider_thread_id: string | null;
  dispatch_started_at: string | null;
  rfc_message_id: string | null;
  created_at: string;
};

type Context = {
  mailboxEmail: string;
  senderDisplayName: string;
  aliasLocalPart: string;
  refPrefix: string;
  signatureHtml: string;
  providerThreadId: string | null;
  threadSubject: string | null;
  refCode: string | null;
};

type LoadedAttachment = {
  id: string;
  storagePath: string;
  filename: string;
  contentType: string;
  byteSize: number;
  content: Buffer;
  filenameEnc: string;
  contentTypeEnc: string;
  cipherSha256: string;
  scanStatus: string;
};

function cleanHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: ["p", "br", "div", "span", "strong", "b", "em", "i", "u", "ul", "ol", "li", "blockquote", "pre", "code", "table", "thead", "tbody", "tr", "th", "td", "a"],
    allowedAttributes: { a: ["href", "title"], "*": ["dir"] },
    allowedSchemes: ["http", "https", "mailto"],
  });
}

function createRef(prefix: string, job: JobRow) {
  // 同一任务即使 worker 重启也要得到同一个业务参考号，便于对账和归档。
  const year = new Date(job.created_at || Date.now()).getUTCFullYear();
  return `PT5-${year}-${prefix}-${job.id.slice(0, 8).toUpperCase()}`;
}

async function loadContext(job: JobRow): Promise<Context> {
  const supabase = getSupabaseServiceRoleClient();
  const [mailbox, profile, thread] = await Promise.all([
    supabase.from("mail_shared_mailboxes").select("email_enc,status").eq("id", job.mailbox_id).single(),
    supabase.from("mail_agent_profiles")
      .select("alias_local_part,ref_prefix,sender_display_name_enc,signature_html_enc,enabled")
      .eq("user_id", job.actor_user_id).single(),
    job.thread_id
      ? supabase.from("mail_threads").select("provider_thread_id,subject_enc,ref_code,assigned_user_id").eq("id", job.thread_id).single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (mailbox.error || profile.error || thread.error || mailbox.data?.status !== "active"
    || (!job.dispatch_started_at && profile.data?.enabled !== true)) {
    throw new Error("发件人配置不存在、已停用，或公司邮箱当前不可用。", { cause: mailbox.error ?? profile.error ?? thread.error });
  }
  // 已经调用 Gmail 的任务只能核对和归档，负责人变化不应阻止核对既有发送结果。
  if (!job.dispatch_started_at && job.thread_id && thread.data?.assigned_user_id !== job.actor_user_id) throw new Error("会话负责人已经变化，请刷新后重新发送。");
  return {
    mailboxEmail: decryptMailValue(mailbox.data.email_enc as string, getMailEnv().contentKey),
    senderDisplayName: decryptMailValue(profile.data.sender_display_name_enc as string, getMailEnv().contentKey),
    aliasLocalPart: profile.data.alias_local_part as string,
    refPrefix: profile.data.ref_prefix as string,
    signatureHtml: decryptMailValue(profile.data.signature_html_enc as string, getMailEnv().contentKey),
    providerThreadId: (thread.data?.provider_thread_id as string | undefined) ?? null,
    threadSubject: thread.data?.subject_enc ? decryptMailValue(thread.data.subject_enc as string, getMailEnv().contentKey) : null,
    refCode: (thread.data?.ref_code as string | undefined) ?? null,
  };
}

async function loadReplyHeaders(threadId: string | null) {
  if (!threadId) return { inReplyTo: undefined, references: undefined };
  const result = await getSupabaseServiceRoleClient().from("mail_messages")
    .select("raw_headers_enc").eq("thread_id", threadId)
    .order("occurred_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw new Error("回复邮件头暂时无法读取。", { cause: result.error });
  if (!result.data) return { inReplyTo: undefined, references: undefined };
  const headers = JSON.parse(decryptMailValue(result.data.raw_headers_enc as string, getMailEnv().contentKey)) as Record<string, string>;
  const messageId = headers["message-id"];
  return { inReplyTo: messageId || undefined, references: [headers.references, messageId].filter(Boolean).join(" ") || undefined };
}

async function loadAttachments(job: JobRow, ids: string[]): Promise<LoadedAttachment[]> {
  if (ids.length === 0) return [];
  const result = await getSupabaseServiceRoleClient().from("mail_uploads")
    .select("id,storage_path,filename_enc,content_type_enc,byte_size,cipher_sha256,scan_status,consumed_at,expires_at")
    .eq("user_id", job.actor_user_id).in("id", ids);
  if (result.error) throw new Error("附件暂时无法读取。", { cause: result.error });
  const rows = result.data ?? [];
  if (rows.length !== ids.length || rows.some((row) => row.scan_status !== "clean"
    || (!job.dispatch_started_at && (row.consumed_at || new Date(row.expires_at as string) <= new Date())))) {
    throw new Error("部分附件不存在、已过期或未通过安全检查。");
  }
  return Promise.all(rows.map(async (row) => ({
    id: row.id as string,
    storagePath: row.storage_path as string,
    filename: decryptMailValue(row.filename_enc as string, getMailEnv().contentKey),
    contentType: decryptMailValue(row.content_type_enc as string, getMailEnv().contentKey),
    byteSize: Number(row.byte_size),
    content: Buffer.from(decryptMailValue(await downloadEncryptedObject(row.storage_path as string), getMailEnv().contentKey), "base64"),
    filenameEnc: row.filename_enc as string,
    contentTypeEnc: row.content_type_enc as string,
    cipherSha256: row.cipher_sha256 as string,
    scanStatus: row.scan_status as string,
  })));
}

async function buildMime(job: JobRow, payload: OutboundMessageInput, context: Context) {
  const signature = cleanHtml(context.signatureHtml);
  const refCode = context.refCode ?? createRef(context.refPrefix, job);
  const subject = context.threadSubject ?? payload.subject;
  const replyHeaders = await loadReplyHeaders(job.thread_id);
  const attachments = await loadAttachments(job, payload.attachmentIds);
  const signatureText = signature.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const text = `${payload.textBody.trim()}\n\n${signatureText}\nRef: ${refCode}`.trim();
  const escaped = payload.textBody.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll("\n", "<br>");
  const html = `${cleanHtml(payload.htmlBody || `<p>${escaped}</p>`)}<hr>${signature}<p>Ref: ${refCode}</p>`;
  const stableMessageId = job.rfc_message_id ?? `<pt5-${job.id}@pt5china.com>`;
  const raw = (await new MailComposer({
    from: { name: context.senderDisplayName, address: context.mailboxEmail },
    replyTo: `${context.mailboxEmail.split("@")[0]}+${context.aliasLocalPart}@gmail.com`,
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    subject,
    messageId: stableMessageId,
    text,
    html,
    inReplyTo: replyHeaders.inReplyTo,
    references: replyHeaders.references,
    attachments: attachments.map((item) => ({ filename: item.filename, contentType: item.contentType, content: item.content })),
  }).compile().build()).toString("utf8");
  const rfcMessageId = raw.match(/^Message-ID:\s*(.+)$/im)?.[1]?.trim() ?? "";
  if (!rfcMessageId) throw new Error("邮件发送标识没有生成。");
  return { raw, rfcMessageId, refCode, subject, text, html, attachments };
}

async function finalizeSentJob(job: JobRow, payload: OutboundMessageInput, context: Context, mime: Awaited<ReturnType<typeof buildMime>>, providerMessageId: string, providerThreadId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const existing = await supabase.from("mail_messages").select("id,thread_id,occurred_at")
    .eq("mailbox_id", job.mailbox_id).eq("provider_message_id", providerMessageId).maybeSingle();
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
    const done = await supabase.from("mail_outbound_jobs").update({ status: "sent", sent_message_id: existing.data.id, completed_at: new Date().toISOString(), locked_at: null, last_error: null }).eq("id", job.id).select("id,status").single();
    if (done.error || done.data?.status !== "sent") throw new Error("发送任务没有确认完成。", { cause: done.error });
    return;
  }

  let threadId = job.thread_id;
  const now = new Date().toISOString();
  if (!threadId) {
    const customerEmail = payload.to[0];
    if (!customerEmail) throw new Error("新邮件没有主收件人。");
    const { data: createdData, error: createdError } = await supabase.from("mail_threads").insert({
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
    }).select("id").single();
    if (createdError || !createdData) throw new Error("新发邮件会话没有确认保存。", { cause: createdError });
    threadId = createdData.id as string;
    const { data: assignmentData, error: assignmentError } = await supabase.from("mail_assignment_events").insert({
      thread_id: threadId,
      actor_user_id: job.actor_user_id,
      assigned_user_id: job.actor_user_id,
      reason: "新建邮件",
      thread_version: 1,
    }).select("id").single();
    if (assignmentError || !assignmentData) throw new Error("新邮件指派记录没有确认保存。", { cause: assignmentError });
  } else {
    const current = await supabase.from("mail_threads").select("version,assigned_user_id").eq("id", threadId).single();
    if (current.error || current.data?.assigned_user_id !== job.actor_user_id) throw new Error("回复后的会话负责人没有确认。", { cause: current.error });
    const updated = await supabase.from("mail_threads").update({
      state: "waiting_customer",
      last_message_at: now,
      last_outbound_at: now,
      version: Number(current.data.version) + 1,
      updated_at: now,
    }).eq("id", threadId).eq("version", current.data.version).select("id").maybeSingle();
    if (updated.error || updated.data?.id !== threadId) throw new Error("回复后的会话状态没有确认保存。", { cause: updated.error });
  }

  const { data: savedData, error: savedError } = await supabase.from("mail_messages").insert({
    mailbox_id: job.mailbox_id,
    thread_id: threadId,
    provider_message_id: providerMessageId,
    rfc_message_id_hash: mime.rfcMessageId ? createBlindIndex(mime.rfcMessageId, getMailEnv().emailHashSecret) : null,
    direction: "outbound",
    actor_user_id: job.actor_user_id,
    from_enc: encryptMailValue(`${context.senderDisplayName} <${context.mailboxEmail}>`, getMailEnv().contentKey),
    to_enc: encryptMailValue(JSON.stringify(payload.to), getMailEnv().contentKey),
    cc_enc: encryptMailValue(JSON.stringify(payload.cc), getMailEnv().contentKey),
    bcc_enc: encryptMailValue(JSON.stringify(payload.bcc), getMailEnv().contentKey),
    subject_enc: encryptMailValue(mime.subject, getMailEnv().contentKey),
    text_body_enc: encryptMailValue(mime.text, getMailEnv().contentKey),
    html_body_enc: encryptMailValue(mime.html, getMailEnv().contentKey),
    raw_headers_enc: encryptMailValue(JSON.stringify({ "message-id": mime.rfcMessageId }), getMailEnv().contentKey),
    occurred_at: now,
  }).select("id,occurred_at").single();
  if (savedError || !savedData) throw new Error("已发送邮件没有确认保存。", { cause: savedError });
  for (const attachment of mime.attachments) {
    const { data: archivedData, error: archivedError } = await supabase.from("mail_attachments").insert({
      message_id: savedData.id,
      storage_path: attachment.storagePath,
      filename_enc: attachment.filenameEnc,
      content_type_enc: attachment.contentTypeEnc,
      byte_size: attachment.byteSize,
      cipher_sha256: attachment.cipherSha256,
      scan_status: attachment.scanStatus,
    }).select("id").single();
    if (archivedError || !archivedData) throw new Error("已发送附件没有确认归档。", { cause: archivedError });
    const { data: consumedData, error: consumedError } = await supabase.from("mail_uploads").update({ consumed_at: now }).eq("id", attachment.id).is("consumed_at", null).select("id").single();
    if (consumedError || consumedData?.id !== attachment.id) throw new Error("附件上传记录没有确认归档。", { cause: consumedError });
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
  const { data: completedData, error: completedError } = await supabase.from("mail_outbound_jobs").update({
    status: "sent",
    sent_message_id: savedData.id,
    completed_at: now,
    locked_at: null,
    last_error: null,
    updated_at: now,
  }).eq("id", job.id).select("id,status,provider_message_id").single();
  if (completedError || completedData?.status !== "sent" || completedData.provider_message_id !== providerMessageId) {
    throw new Error("发送完成凭证没有确认保存。", { cause: completedError });
  }
}

async function processJob(job: JobRow) {
  const payload = JSON.parse(decryptMailValue(job.payload_enc, getMailEnv().contentKey)) as OutboundMessageInput;
  const context = await loadContext(job);
  const mime = await buildMime(job, payload, context);
  const accessToken = await getSharedAccessToken(job.mailbox_id);
  let providerMessageId = job.provider_message_id;
  let providerThreadId = job.provider_thread_id;
  if (!providerMessageId || !providerThreadId) {
    let sent: { id: string; threadId: string };
    if (job.dispatch_started_at) {
      // 只要已经开始对外发送，结果不明时只查询供应商；重试发送会造成重复邮件。
      const found = await findSentMessageByRfcId(accessToken, job.rfc_message_id ?? mime.rfcMessageId);
      if (!found) throw new Error("已开始发送，正在等待公司邮箱确认结果。");
      sent = found;
    } else {
      const dispatchStartedAt = new Date().toISOString();
      // 先持久化发送标识。即使后面的 Gmail 响应或数据库回执丢失，下一次也只能查询。
      job.dispatch_started_at = dispatchStartedAt;
      job.rfc_message_id = mime.rfcMessageId;
      const { data: preparedData, error: preparedError } = await getSupabaseServiceRoleClient().from("mail_outbound_jobs").update({
        dispatch_started_at: dispatchStartedAt,
        rfc_message_id: mime.rfcMessageId,
        updated_at: dispatchStartedAt,
      }).eq("id", job.id).is("dispatch_started_at", null).select("id").single();
      if (preparedError || preparedData?.id !== job.id) throw new Error("发送标识没有确认保存。", { cause: preparedError });
      sent = await sendRawMessage(accessToken, mime.raw, context.providerThreadId ?? undefined);
    }
    // 编号写库失败时只按已持久化的 Message-ID 查 Gmail，不能因为内存里有编号就结束对账。
    const { data: recordedData, error: recordedError } = await getSupabaseServiceRoleClient().from("mail_outbound_jobs").update({
      provider_message_id: sent.id,
      provider_thread_id: sent.threadId,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id).select("provider_message_id,provider_thread_id").single();
    if (recordedError || recordedData?.provider_message_id !== sent.id) throw new Error("Gmail 返回编号没有确认保存。", { cause: recordedError });
    job.provider_message_id = sent.id;
    job.provider_thread_id = sent.threadId;
    providerMessageId = sent.id;
    providerThreadId = sent.threadId;
    // 核验 SENT 失败时已有可靠编号，可以立即标记为部分失败等待人工核对。
  }
  await verifySentMessage(accessToken, providerMessageId);
  await finalizeSentJob(job, payload, context, mime, providerMessageId, providerThreadId);
}

export async function processOutboundJobBatch() {
  const supabase = getSupabaseServiceRoleClient();
  const { data: claimedData, error: claimedError } = await supabase.rpc("claim_mail_outbound_jobs", { batch_size: 20 });
  if (claimedError) throw new Error("发信任务暂时无法领取。", { cause: claimedError });
  const jobs = (claimedData ?? []) as JobRow[];
  let succeededCount = 0;
  let failedCount = 0;
  for (const job of jobs) {
    try {
      await processJob(job);
      succeededCount += 1;
    } catch (error) {
      failedCount += 1;
      // Gmail 已给出邮件编号却没有最终凭证时立即标记需人工核对；继续自动重试会长时间误导页面。
      // 只有已经发起请求但尚无编号的情况才按同一 Message-ID 查询，绝不重新投递。
      const terminal = job.dispatch_started_at || job.provider_message_id ? "partial_failed" : "failed";
      const nextStatus = job.provider_message_id ? "partial_failed" : job.attempt_count < 4 ? "retrying" : terminal;
      const { data: savedData, error: savedError } = await supabase.from("mail_outbound_jobs").update({
        status: nextStatus,
        next_attempt_at: new Date(Date.now() + Math.min(60_000 * 2 ** job.attempt_count, 3_600_000)).toISOString(),
        locked_at: null,
        last_error: error instanceof Error ? error.message : "邮件发送失败",
        updated_at: new Date().toISOString(),
      }).eq("id", job.id).select("id,status").single();
      if (savedError || savedData?.status !== nextStatus) throw new Error("发信失败状态没有确认保存。", { cause: savedError });
    }
  }
  return { processedCount: jobs.length, succeededCount, failedCount };
}
