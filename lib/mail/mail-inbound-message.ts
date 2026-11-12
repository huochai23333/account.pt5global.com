/** 单封收件的接收规则、分配与归档；外层 worker 仅调度事件和检查点。 */
import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";
import { getMailEnv } from "./mail-env";
import { UnsupportedInboundMessageError } from "./mail-inbound-errors";
import { type GmailFullMessage } from "./mail-google-inbound";
import { decideMailIntake } from "./mail-intake";
import { loadDecryptedMailIntakeRules } from "./mail-intake-rules-service";
import { extractEmailAddresses } from "./mail-recipient-addresses";
import { loadInboundRecipientHistory, recordIgnoredUnknownInbound } from "./mail-recipient-service";
import { decideMailRouting } from "./mail-routing";
import { createUniqueMailRef, loadMailRoutingAgents } from "./mail-routing-service";
import { createBlindIndex, encryptMailValue } from "./mail-security";
import { scanAttachment, uploadEncryptedObject } from "./mail-storage";
import { deleteUnreferencedInboundObjects } from "./mail-inbound-persistence";
import { parseEnvelope, parseMessage } from "./mail-inbound-parser";
import type { ParsedAttachment } from "./mail-inbound-parser";

async function listBoundAdministrators() {
  const supabase = getSupabaseServiceRoleClient();
  const role = await supabase.from("user_roles").select("id").eq("role", "administrator").single();
  if (role.error || !role.data) throw new Error("管理员角色暂时无法读取。", { cause: role.error });
  const links = await supabase
    .from("user_roles_data")
    .select("user_id")
    .eq("role_id", role.data.id);
  if (links.error) throw new Error("管理员名单暂时无法读取。", { cause: links.error });
  const ids = (links.data ?? []).map((row) => row.user_id as string);
  if (ids.length === 0) return [];
  const bindings = await supabase.from("mail_feishu_bindings").select("user_id").in("user_id", ids);
  if (bindings.error) throw new Error("管理员飞书状态暂时无法读取。", { cause: bindings.error });
  return (bindings.data ?? []).map((row) => row.user_id as string);
}

export async function persistInboundMessage(
  mailboxId: string,
  accessToken: string,
  message: GmailFullMessage,
) {
  if (!message.labelIds?.includes("INBOX")) return;
  const supabase = getSupabaseServiceRoleClient();
  const duplicate = await supabase
    .from("mail_messages")
    .select("id")
    .eq("mailbox_id", mailboxId)
    .eq("provider_message_id", message.id)
    .maybeSingle();
  if (duplicate.error) throw new Error("来信重复状态暂时无法确认。", { cause: duplicate.error });
  if (duplicate.data) return;
  const envelope = parseEnvelope(message);
  const customerEmail = extractEmailAddresses(envelope.from)[0];
  if (!customerEmail) throw new UnsupportedInboundMessageError("missing_sender");
  const occurredAt = new Date(Number(message.internalDate ?? Date.now())).toISOString();
  const recipientHistory = await loadInboundRecipientHistory(mailboxId, customerEmail);
  if (!recipientHistory.known) {
    // 陌生来信到这里立即结束：不解析正文、不下载附件，也不创建业务会话。
    await recordIgnoredUnknownInbound({ mailboxId, providerMessageId: message.id, occurredAt });
    return;
  }
  const existing = await supabase
    .from("mail_threads")
    .select("id,assigned_user_id,ref_code,intake_status,quarantine_reason,intake_rule_id")
    .eq("mailbox_id", mailboxId)
    .eq("provider_thread_id", message.threadId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing.error) throw new Error("邮件会话暂时无法确认。", { cause: existing.error });
  const parsed = await parseMessage(accessToken, message, envelope);
  const intake =
    existing.data?.intake_status === "quarantined"
      ? {
          status: "quarantined" as const,
          reason: String(existing.data.quarantine_reason ?? "会话已在隔离区"),
          ruleId: existing.data.intake_rule_id as string | null,
        }
      : decideMailIntake(
          {
            sender: customerEmail,
            subject: parsed.subject,
            headers: parsed.headers,
            existingActiveThread: existing.data?.intake_status === "active",
          },
          await loadDecryptedMailIntakeRules(),
        );
  const agents = await loadMailRoutingAgents();
  const routing = decideMailRouting(
    {
      knownAssignedMemberId:
        intake.status === "active"
          ? (existing.data?.assigned_user_id as string | null | undefined)
          : null,
      recipientHistoryMemberIds: recipientHistory.assignedMemberIds,
      deliveredTo: parsed.deliveredTo,
      to: parsed.to,
      cc: parsed.cc,
      subject: parsed.subject,
      textBody: parsed.textBody,
      htmlBody: parsed.htmlBody,
    },
    agents,
  );
  const assignedAgent = agents.find((agent) => agent.memberId === routing.assignedMemberId);
  const refCode =
    (existing.data?.ref_code as string | null | undefined) ??
    (intake.status === "active"
      ? await createUniqueMailRef(assignedAgent?.refPrefix ?? "GENERAL")
      : null);
  const stagedPaths: string[] = [];
  const staged = [] as Array<
    ParsedAttachment & {
      path: string;
      hash: string;
      status: "clean" | "quarantined";
      error: string | null;
    }
  >;
  try {
    for (const [index, attachment] of parsed.attachments.entries()) {
      const path = `${mailboxId}/${message.id}/${index}-${crypto.randomUUID().slice(0, 10)}`;
      const stored = await uploadEncryptedObject(
        path,
        encryptMailValue(attachment.bytes.toString("base64"), getMailEnv().contentKey),
      );
      stagedPaths.push(path);
      const scan = await scanAttachment(attachment.bytes, attachment.filename);
      staged.push({
        ...attachment,
        path,
        hash: stored.cipherSha256,
        status: scan.clean ? "clean" : "quarantined",
        error: scan.reason,
      });
    }

    const targetIds =
      intake.status !== "active"
        ? []
        : routing.assignedMemberId
          ? [routing.assignedMemberId]
          : await listBoundAdministrators();
    const notificationReason = routing.assignedMemberId ? "assigned_inbound" : "unassigned_inbound";
    // 会话、邮件、附件元数据与提醒由一个数据库事务提交。这里只在事务确认后视为已归档。
    const { data: receipt, error: commitError } = await supabase
      .rpc("commit_mail_inbound", {
        p_thread: {
          mailbox_id: mailboxId,
          provider_thread_id: message.threadId,
          subject_enc: encryptMailValue(parsed.subject, getMailEnv().contentKey),
          customer_email_enc: encryptMailValue(customerEmail, getMailEnv().contentKey),
          customer_email_hash: createBlindIndex(customerEmail, getMailEnv().emailHashSecret),
          assigned_user_id: routing.assignedMemberId,
          ref_code: refCode,
          routing_source: intake.status === "active" ? routing.source : "quarantine",
          routing_evidence: { ...routing.evidence, conflicting: routing.conflicting },
          name_hint_user_ids: routing.nameHintMemberIds,
          intake_status: intake.status,
          quarantine_reason: intake.reason,
          intake_rule_id: intake.ruleId,
          occurred_at: occurredAt,
        },
        p_message: {
          provider_message_id: message.id,
          rfc_message_id_hash: parsed.messageIdHeader
            ? createBlindIndex(parsed.messageIdHeader, getMailEnv().emailHashSecret)
            : null,
          from_enc: encryptMailValue(parsed.from, getMailEnv().contentKey),
          to_enc: encryptMailValue(JSON.stringify(parsed.to), getMailEnv().contentKey),
          cc_enc: encryptMailValue(JSON.stringify(parsed.cc), getMailEnv().contentKey),
          bcc_enc: encryptMailValue(JSON.stringify(parsed.bcc), getMailEnv().contentKey),
          subject_enc: encryptMailValue(parsed.subject, getMailEnv().contentKey),
          text_body_enc: encryptMailValue(parsed.textBody, getMailEnv().contentKey),
          html_body_enc: encryptMailValue(parsed.htmlBody, getMailEnv().contentKey),
          raw_headers_enc: encryptMailValue(
            JSON.stringify(parsed.headers),
            getMailEnv().contentKey,
          ),
        },
        p_attachments: staged.map((attachment) => ({
          storage_path: attachment.path,
          filename_enc: encryptMailValue(attachment.filename, getMailEnv().contentKey),
          content_type_enc: encryptMailValue(attachment.contentType, getMailEnv().contentKey),
          byte_size: attachment.bytes.length,
          cipher_sha256: attachment.hash,
          scan_status: attachment.status,
          scan_error: attachment.error,
        })),
        p_target_user_ids: targetIds,
        p_notification_reason: notificationReason,
      })
      .single();
    const committed = receipt as {
      attachment_count: number;
      notification_count: number;
      created: boolean;
    } | null;
    if (
      commitError ||
      !committed ||
      Number(committed.attachment_count) !== staged.length ||
      Number(committed.notification_count) !== targetIds.length
    ) {
      throw new Error("来信归档结果没有全部确认。", { cause: commitError });
    }
    // 并发重放可能返回已有邮件，此轮上传的对象没有被引用，应按精确路径清理。
    if (!committed.created) await deleteUnreferencedInboundObjects(stagedPaths);
  } catch (error) {
    await deleteUnreferencedInboundObjects(stagedPaths).catch(() => undefined);
    throw error;
  }
}
