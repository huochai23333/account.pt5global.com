import { randomBytes } from "node:crypto";

import sanitizeHtml from "sanitize-html";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import {
  getFullMessage,
  getMessageAttachment,
  getSharedAccessToken,
  GoogleAuthorizationError,
  listHistoryMessageIds,
  listMessagesSince,
  type GmailFullMessage,
  type GmailPayloadPart,
} from "./mail-google";
import { decideMailIntake } from "./mail-intake";
import { loadDecryptedMailIntakeRules, recordMailIntakeRuleHit } from "./mail-intake-service";
import { extractEmailAddresses } from "./mail-recipient-addresses";
import { loadInboundRecipientHistory, recordIgnoredUnknownInbound } from "./mail-recipient-service";
import { decideMailRouting } from "./mail-routing";
import { createUniqueMailRef, loadMailRoutingAgents } from "./mail-routing-service";
import { createBlindIndex, encryptMailValue } from "./mail-security";
import { cleanAttachmentFilename, deleteEncryptedObjects, scanAttachment, uploadEncryptedObject } from "./mail-storage";

type EventRow = {
  id: string;
  mailbox_id: string;
  target_history_id: string;
  published_at: string | null;
  attempt_count: number;
};

type ParsedAttachment = { filename: string; contentType: string; bytes: Buffer };

function decodeBody(value?: string) {
  return value ? Buffer.from(value, "base64url").toString("utf8") : "";
}

async function collectParts(
  accessToken: string,
  messageId: string,
  part: GmailPayloadPart | undefined,
  output: { texts: string[]; html: string[]; attachments: ParsedAttachment[] },
) {
  if (!part) return;
  for (const child of part.parts ?? []) await collectParts(accessToken, messageId, child, output);
  const contentType = part.mimeType ?? "application/octet-stream";
  if (part.filename) {
    const data = part.body?.data ?? (part.body?.attachmentId
      ? (await getMessageAttachment(accessToken, messageId, part.body.attachmentId)).data
      : "");
    const bytes = Buffer.from(data, "base64url");
    if (bytes.length > 10 * 1024 * 1024) throw new Error("收到的单个附件超过 10 MiB，已停止处理此邮件。");
    output.attachments.push({ filename: cleanAttachmentFilename(part.filename), contentType, bytes });
  } else if (contentType === "text/plain") {
    output.texts.push(decodeBody(part.body?.data));
  } else if (contentType === "text/html") {
    output.html.push(decodeBody(part.body?.data));
  }
}

function parseEnvelope(message: GmailFullMessage) {
  const headers = new Map((message.payload?.headers ?? []).map((header) => [header.name.toLowerCase(), header.value]));
  return {
    from: headers.get("from") ?? "",
    to: extractEmailAddresses(headers.get("to") ?? ""),
    cc: extractEmailAddresses(headers.get("cc") ?? ""),
    bcc: extractEmailAddresses(headers.get("bcc") ?? ""),
    deliveredTo: extractEmailAddresses(headers.get("delivered-to") ?? ""),
    subject: headers.get("subject") ?? "（无主题）",
    messageIdHeader: headers.get("message-id") ?? "",
    headers: Object.fromEntries([...headers].filter(([name]) => [
      "message-id", "in-reply-to", "references", "reply-to", "delivered-to",
      "list-unsubscribe", "list-id", "precedence", "auto-submitted",
    ].includes(name))),
  };
}

async function parseMessage(accessToken: string, message: GmailFullMessage, envelope: ReturnType<typeof parseEnvelope>) {
  const output: { texts: string[]; html: string[]; attachments: ParsedAttachment[] } = { texts: [], html: [], attachments: [] };
  await collectParts(accessToken, message.id, message.payload, output);
  if (output.attachments.length > 10) throw new Error("收到的附件数量超过 10 个，已停止处理此邮件。");
  if (output.attachments.reduce((sum, item) => sum + item.bytes.length, 0) > 20 * 1024 * 1024) {
    throw new Error("收到的附件合计超过 20 MiB，已停止处理此邮件。");
  }
  const htmlBody = sanitizeHtml(output.html.join("\n"), {
    allowedTags: ["p", "br", "div", "span", "strong", "b", "em", "i", "u", "ul", "ol", "li", "blockquote", "pre", "code", "table", "thead", "tbody", "tr", "th", "td", "a"],
    allowedAttributes: { a: ["href", "title"], "*": ["dir"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }) },
  });
  return {
    ...envelope,
    textBody: output.texts.join("\n").trim(),
    htmlBody,
    attachments: output.attachments,
  };
}

async function listBoundAdministrators() {
  const supabase = getSupabaseServiceRoleClient();
  const role = await supabase.from("user_roles").select("id").eq("role", "administrator").single();
  if (role.error || !role.data) throw new Error("管理员角色暂时无法读取。", { cause: role.error });
  const links = await supabase.from("user_roles_data").select("user_id").eq("role_id", role.data.id);
  if (links.error) throw new Error("管理员名单暂时无法读取。", { cause: links.error });
  const ids = (links.data ?? []).map((row) => row.user_id as string);
  if (ids.length === 0) return [];
  const bindings = await supabase.from("mail_feishu_bindings").select("user_id").in("user_id", ids);
  if (bindings.error) throw new Error("管理员飞书状态暂时无法读取。", { cause: bindings.error });
  return (bindings.data ?? []).map((row) => row.user_id as string);
}

async function persistInboundMessage(mailboxId: string, accessToken: string, message: GmailFullMessage) {
  if (!message.labelIds?.includes("INBOX")) return;
  const supabase = getSupabaseServiceRoleClient();
  const duplicate = await supabase.from("mail_messages").select("id").eq("mailbox_id", mailboxId).eq("provider_message_id", message.id).maybeSingle();
  if (duplicate.error) throw new Error("来信重复状态暂时无法确认。", { cause: duplicate.error });
  if (duplicate.data) return;
  const envelope = parseEnvelope(message);
  const customerEmail = extractEmailAddresses(envelope.from)[0];
  if (!customerEmail) throw new Error("客户来信没有可识别的发件邮箱。");
  const occurredAt = new Date(Number(message.internalDate ?? Date.now())).toISOString();
  const recipientHistory = await loadInboundRecipientHistory(mailboxId, customerEmail);
  if (!recipientHistory.known) {
    // 陌生来信到这里立即结束：不解析正文、不下载附件，也不创建业务会话。
    await recordIgnoredUnknownInbound({ mailboxId, providerMessageId: message.id, occurredAt });
    return;
  }
  const existing = await supabase.from("mail_threads")
    .select("id,assigned_user_id,ref_code,intake_status,quarantine_reason,intake_rule_id")
    .eq("mailbox_id", mailboxId).eq("provider_thread_id", message.threadId).is("deleted_at", null).maybeSingle();
  if (existing.error) throw new Error("邮件会话暂时无法确认。", { cause: existing.error });
  const parsed = await parseMessage(accessToken, message, envelope);
  const intake = existing.data?.intake_status === "quarantined"
    ? {
        status: "quarantined" as const,
        reason: String(existing.data.quarantine_reason ?? "会话已在隔离区"),
        ruleId: existing.data.intake_rule_id as string | null,
      }
    : decideMailIntake({
        sender: customerEmail,
        subject: parsed.subject,
        headers: parsed.headers,
        existingActiveThread: existing.data?.intake_status === "active",
      }, await loadDecryptedMailIntakeRules());
  const agents = await loadMailRoutingAgents();
  const routing = decideMailRouting({
    knownAssignedMemberId: intake.status === "active" ? existing.data?.assigned_user_id as string | null | undefined : null,
    recipientHistoryMemberIds: recipientHistory.assignedMemberIds,
    deliveredTo: parsed.deliveredTo,
    to: parsed.to,
    cc: parsed.cc,
    subject: parsed.subject,
    textBody: parsed.textBody,
    htmlBody: parsed.htmlBody,
  }, agents);
  const assignedAgent = agents.find((agent) => agent.memberId === routing.assignedMemberId);
  const refCode = (existing.data?.ref_code as string | null | undefined)
    ?? (intake.status === "active" ? await createUniqueMailRef(assignedAgent?.refPrefix ?? "GENERAL") : null);
  const stagedPaths: string[] = [];
  const staged = [] as Array<ParsedAttachment & { path: string; hash: string; status: "clean" | "quarantined"; error: string | null }>;
  try {
    for (const [index, attachment] of parsed.attachments.entries()) {
      const path = `${mailboxId}/${message.id}/${index}-${randomBytes(5).toString("hex")}`;
      const stored = await uploadEncryptedObject(path, encryptMailValue(attachment.bytes.toString("base64"), getMailEnv().contentKey));
      stagedPaths.push(path);
      const scan = await scanAttachment(attachment.bytes, attachment.filename);
      staged.push({ ...attachment, path, hash: stored.cipherSha256, status: scan.clean ? "clean" : "quarantined", error: scan.reason });
    }

    let threadId = existing.data?.id as string | undefined;
    if (!threadId) {
      const { data: createdData, error: createdError } = await supabase.from("mail_threads").insert({
        mailbox_id: mailboxId,
        provider_thread_id: message.threadId,
        subject_enc: encryptMailValue(parsed.subject, getMailEnv().contentKey),
        customer_email_enc: encryptMailValue(customerEmail, getMailEnv().contentKey),
        customer_email_hash: createBlindIndex(customerEmail, getMailEnv().emailHashSecret),
        assigned_user_id: intake.status === "active" ? routing.assignedMemberId : null,
        state: "waiting_pt5",
        ref_code: refCode,
        routing_source: intake.status === "active" ? routing.source : "quarantine",
        routing_evidence: { ...routing.evidence, conflicting: routing.conflicting },
        name_hint_user_ids: routing.nameHintMemberIds,
        intake_status: intake.status,
        quarantine_reason: intake.reason,
        intake_rule_id: intake.ruleId,
        quarantined_at: intake.status === "quarantined" ? new Date().toISOString() : null,
        last_message_at: occurredAt,
        last_inbound_at: occurredAt,
      }).select("id").single();
      if (createdError || !createdData) throw new Error("新邮件会话没有确认保存。", { cause: createdError });
      threadId = createdData.id as string;
      if (intake.status === "active" && routing.assignedMemberId) {
        const { data: assignmentData, error: assignmentError } = await supabase.from("mail_assignment_events").insert({
          thread_id: threadId,
          assigned_user_id: routing.assignedMemberId,
          reason: `自动分配：${routing.source}`,
          thread_version: 1,
        }).select("id").single();
        if (assignmentError || !assignmentData) throw new Error("自动指派记录没有确认保存。", { cause: assignmentError });
      }
    } else {
      const { data: updatedData, error: updatedError } = await supabase.from("mail_threads").update({
        state: "waiting_pt5",
        subject_enc: encryptMailValue(parsed.subject, getMailEnv().contentKey),
        customer_email_enc: encryptMailValue(customerEmail, getMailEnv().contentKey),
        customer_email_hash: createBlindIndex(customerEmail, getMailEnv().emailHashSecret),
        intake_status: intake.status,
        quarantine_reason: intake.reason,
        intake_rule_id: intake.ruleId,
        quarantined_at: intake.status === "quarantined" ? new Date().toISOString() : null,
        last_message_at: occurredAt,
        last_inbound_at: occurredAt,
        updated_at: new Date().toISOString(),
      }).eq("id", threadId).select("id,version").single();
      if (updatedError || updatedData?.id !== threadId) throw new Error("现有邮件会话没有确认更新。", { cause: updatedError });
      const { data: versionData, error: versionError } = await supabase.from("mail_threads").update({ version: Number(updatedData.version) + 1 }).eq("id", threadId).eq("version", updatedData.version).select("id").single();
      if (versionError || versionData?.id !== threadId) throw new Error("邮件会话版本没有确认推进。", { cause: versionError });
    }

    const { data: savedData, error: savedError } = await supabase.from("mail_messages").insert({
      mailbox_id: mailboxId,
      thread_id: threadId,
      provider_message_id: message.id,
      rfc_message_id_hash: parsed.messageIdHeader ? createBlindIndex(parsed.messageIdHeader, getMailEnv().emailHashSecret) : null,
      direction: "inbound",
      from_enc: encryptMailValue(parsed.from, getMailEnv().contentKey),
      to_enc: encryptMailValue(JSON.stringify(parsed.to), getMailEnv().contentKey),
      cc_enc: encryptMailValue(JSON.stringify(parsed.cc), getMailEnv().contentKey),
      bcc_enc: encryptMailValue(JSON.stringify(parsed.bcc), getMailEnv().contentKey),
      subject_enc: encryptMailValue(parsed.subject, getMailEnv().contentKey),
      text_body_enc: encryptMailValue(parsed.textBody, getMailEnv().contentKey),
      html_body_enc: encryptMailValue(parsed.htmlBody, getMailEnv().contentKey),
      raw_headers_enc: encryptMailValue(JSON.stringify(parsed.headers), getMailEnv().contentKey),
      occurred_at: occurredAt,
    }).select("id").single();
    if (savedError || !savedData) throw new Error("来信记录没有确认保存。", { cause: savedError });
    if (staged.length > 0) {
      const { data: insertedData, error: insertedError } = await supabase.from("mail_attachments").insert(staged.map((attachment) => ({
        message_id: savedData.id,
        storage_path: attachment.path,
        filename_enc: encryptMailValue(attachment.filename, getMailEnv().contentKey),
        content_type_enc: encryptMailValue(attachment.contentType, getMailEnv().contentKey),
        byte_size: attachment.bytes.length,
        cipher_sha256: attachment.hash,
        scan_status: attachment.status,
        scan_error: attachment.error,
      }))).select("id");
      if (insertedError || (insertedData?.length ?? 0) !== staged.length) throw new Error("来信附件没有全部确认保存。", { cause: insertedError });
    }
    if (intake.status === "active") {
      const targetIds = routing.assignedMemberId ? [routing.assignedMemberId] : await listBoundAdministrators();
      const reason = routing.assignedMemberId ? "assigned_inbound" : "unassigned_inbound";
      if (targetIds.length > 0) {
        const { data: notificationData, error: notificationError } = await supabase.from("mail_notifications").upsert(targetIds.map((userId) => ({
          message_id: savedData.id,
          target_user_id: userId,
          reason,
        })), { onConflict: "message_id,target_user_id,reason", ignoreDuplicates: true }).select("id");
        if (notificationError || (notificationData?.length ?? 0) !== targetIds.length) throw new Error("新邮件提醒没有确认入队。", { cause: notificationError });
      }
    }
    if (intake.ruleId) await recordMailIntakeRuleHit(intake.ruleId);
  } catch (error) {
    await deleteEncryptedObjects(stagedPaths).catch(() => undefined);
    throw error;
  }
}

async function processEvent(event: EventRow) {
  const supabase = getSupabaseServiceRoleClient();
  const [mailbox, watch] = await Promise.all([
    supabase.from("mail_shared_mailboxes").select("id,last_synced_at,cutover_started_at,status").eq("id", event.mailbox_id).single(),
    supabase.from("mail_shared_mailbox_watches").select("history_id").eq("mailbox_id", event.mailbox_id).single(),
  ]);
  if (mailbox.error || watch.error || mailbox.data?.status !== "active") throw new Error("公司邮箱已暂停或缺少同步位置。");
  const accessToken = await getSharedAccessToken(event.mailbox_id);
  let messageIds: string[];
  let nextHistoryId = event.target_history_id;
  try {
    const changes = await listHistoryMessageIds(accessToken, watch.data.history_id as string);
    messageIds = changes.ids;
    nextHistoryId = changes.latestHistoryId;
  } catch (error) {
    if (!(error instanceof Error) || (error as Error & { status?: number }).status !== 404) throw error;
    const cutover = new Date(mailbox.data.cutover_started_at as string);
    const last = mailbox.data.last_synced_at ? new Date(mailbox.data.last_synced_at as string) : event.published_at ? new Date(event.published_at) : cutover;
    const since = new Date(Math.max(cutover.getTime(), last.getTime()));
    messageIds = await listMessagesSince(accessToken, since);
    const { data: auditData, error: auditError } = await supabase.from("mail_audit_events").insert({
      actor_type: "worker",
      event_type: "mail_cursor_recovered",
      entity_type: "mailbox",
      entity_id: event.mailbox_id,
      details: { since: since.toISOString() },
    }).select("id").single();
    if (auditError || !auditData) throw new Error("同步位置恢复审计没有确认保存。", { cause: auditError });
  }
  for (const messageId of messageIds) await persistInboundMessage(event.mailbox_id, accessToken, await getFullMessage(accessToken, messageId));
  const now = new Date().toISOString();
  const data = await Promise.all([
    supabase.from("mail_shared_mailbox_watches").update({ history_id: nextHistoryId, last_notification_at: now, updated_at: now }).eq("mailbox_id", event.mailbox_id).select("mailbox_id").single(),
    supabase.from("mail_shared_mailboxes").update({ last_synced_at: now, last_healthy_at: now, last_error: null, updated_at: now }).eq("id", event.mailbox_id).select("id").single(),
    supabase.from("mail_inbound_events").update({ status: "completed", completed_at: now, locked_at: null, last_error: null }).eq("id", event.id).select("id").single(),
  ]);
  const [watchReceipt, mailboxReceipt, eventReceipt] = data;
  if (watchReceipt.error || mailboxReceipt.error || eventReceipt.error || eventReceipt.data?.id !== event.id) {
    throw new Error("同步完成状态没有全部确认保存。", { cause: watchReceipt.error ?? mailboxReceipt.error ?? eventReceipt.error });
  }
}

export async function processInboundEventBatch() {
  const supabase = getSupabaseServiceRoleClient();
  const { data: claimedData, error: claimedError } = await supabase.rpc("claim_mail_inbound_events", { batch_size: 20 });
  if (claimedError) throw new Error("收件任务暂时无法领取。", { cause: claimedError });
  const events = (claimedData ?? []) as EventRow[];
  let succeededCount = 0;
  let failedCount = 0;
  for (const event of events) {
    try {
      await processEvent(event);
      succeededCount += 1;
    } catch (error) {
      failedCount += 1;
      const message = error instanceof Error ? error.message : "公司邮箱同步失败";
      const needsAuthorization = error instanceof GoogleAuthorizationError;
      const data = await Promise.all([
        supabase.from("mail_inbound_events").update({
          status: "failed",
          available_at: new Date(Date.now() + (needsAuthorization ? 3_600_000 : 60_000)).toISOString(),
          locked_at: null,
          last_error: message,
        }).eq("id", event.id).select("id,status").single(),
        supabase.from("mail_shared_mailboxes").update({
          status: needsAuthorization ? "reauthorization_required" : "active",
          last_error: message,
          updated_at: new Date().toISOString(),
        }).eq("id", event.mailbox_id).select("id,status").single(),
      ]);
      const [eventFailure, mailboxFailure] = data;
      if (eventFailure.error || eventFailure.data?.status !== "failed" || mailboxFailure.error || !mailboxFailure.data?.id) {
        throw new Error("收件失败状态没有确认保存。", { cause: eventFailure.error ?? mailboxFailure.error });
      }
    }
  }
  return { processedCount: events.length, succeededCount, failedCount };
}
