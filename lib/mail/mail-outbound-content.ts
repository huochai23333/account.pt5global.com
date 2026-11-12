/** 读取发件上下文与构建 MIME；构建完成不代表提供商已经发送，也不写发送终态。 */
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import sanitizeHtml from "sanitize-html";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";
import { getMailEnv } from "./mail-env";
import { decryptMailValue } from "./mail-security";
import { downloadEncryptedObject } from "./mail-storage";
import type { OutboundMessageInput } from "./mail-types";
import type { JobRow, Context, LoadedAttachment } from "./mail-outbound-types";

export function cleanHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [
      "p",
      "br",
      "div",
      "span",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "a",
    ],
    allowedAttributes: { a: ["href", "title"], "*": ["dir"] },
    allowedSchemes: ["http", "https", "mailto"],
  });
}

function createRef(prefix: string, job: JobRow) {
  // 同一任务即使 worker 重启也要得到同一个业务参考号，便于对账和归档。
  const year = new Date(job.created_at || Date.now()).getUTCFullYear();
  return `PT5-${year}-${prefix}-${job.id.slice(0, 8).toUpperCase()}`;
}

export async function loadContext(job: JobRow): Promise<Context> {
  const supabase = getSupabaseServiceRoleClient();
  const [mailbox, profile, thread] = await Promise.all([
    supabase
      .from("mail_shared_mailboxes")
      .select("email_enc,status")
      .eq("id", job.mailbox_id)
      .single(),
    supabase
      .from("mail_agent_profiles")
      .select("alias_local_part,ref_prefix,sender_display_name_enc,signature_html_enc,enabled")
      .eq("user_id", job.actor_user_id)
      .single(),
    job.thread_id
      ? supabase
          .from("mail_threads")
          .select("provider_thread_id,subject_enc,ref_code,assigned_user_id")
          .eq("id", job.thread_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (
    mailbox.error ||
    profile.error ||
    thread.error ||
    mailbox.data?.status !== "active" ||
    (!job.dispatch_started_at && profile.data?.enabled !== true)
  ) {
    throw new Error("发件人配置不存在、已停用，或公司邮箱当前不可用。", {
      cause: mailbox.error ?? profile.error ?? thread.error,
    });
  }
  // 已经调用 Gmail 的任务只能核对和归档，负责人变化不应阻止核对既有发送结果。
  if (
    !job.dispatch_started_at &&
    job.thread_id &&
    thread.data?.assigned_user_id !== job.actor_user_id
  )
    throw new Error("会话负责人已经变化，请刷新后重新发送。");
  return {
    mailboxEmail: decryptMailValue(mailbox.data.email_enc as string, getMailEnv().contentKey),
    senderDisplayName: decryptMailValue(
      profile.data.sender_display_name_enc as string,
      getMailEnv().contentKey,
    ),
    aliasLocalPart: profile.data.alias_local_part as string,
    refPrefix: profile.data.ref_prefix as string,
    signatureHtml: decryptMailValue(
      profile.data.signature_html_enc as string,
      getMailEnv().contentKey,
    ),
    providerThreadId: (thread.data?.provider_thread_id as string | undefined) ?? null,
    threadSubject: thread.data?.subject_enc
      ? decryptMailValue(thread.data.subject_enc as string, getMailEnv().contentKey)
      : null,
    refCode: (thread.data?.ref_code as string | undefined) ?? null,
  };
}

async function loadReplyHeaders(threadId: string | null) {
  if (!threadId) return { inReplyTo: undefined, references: undefined };
  const result = await getSupabaseServiceRoleClient()
    .from("mail_messages")
    .select("raw_headers_enc")
    .eq("thread_id", threadId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw new Error("回复邮件头暂时无法读取。", { cause: result.error });
  if (!result.data) return { inReplyTo: undefined, references: undefined };
  const headers = JSON.parse(
    decryptMailValue(result.data.raw_headers_enc as string, getMailEnv().contentKey),
  ) as Record<string, string>;
  const messageId = headers["message-id"];
  return {
    inReplyTo: messageId || undefined,
    references: [headers.references, messageId].filter(Boolean).join(" ") || undefined,
  };
}

async function loadAttachments(job: JobRow, ids: string[]): Promise<LoadedAttachment[]> {
  if (ids.length === 0) return [];
  const result = await getSupabaseServiceRoleClient()
    .from("mail_uploads")
    .select(
      "id,storage_path,filename_enc,content_type_enc,byte_size,cipher_sha256,scan_status,consumed_at,expires_at",
    )
    .eq("user_id", job.actor_user_id)
    .in("id", ids);
  if (result.error) throw new Error("附件暂时无法读取。", { cause: result.error });
  const rows = result.data ?? [];
  if (
    rows.length !== ids.length ||
    rows.some(
      (row) =>
        row.scan_status !== "clean" ||
        (!job.dispatch_started_at &&
          (row.consumed_at || new Date(row.expires_at as string) <= new Date())),
    )
  ) {
    throw new Error("部分附件不存在、已过期或未通过安全检查。");
  }
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id as string,
      storagePath: row.storage_path as string,
      filename: decryptMailValue(row.filename_enc as string, getMailEnv().contentKey),
      contentType: decryptMailValue(row.content_type_enc as string, getMailEnv().contentKey),
      byteSize: Number(row.byte_size),
      content: Buffer.from(
        decryptMailValue(
          await downloadEncryptedObject(row.storage_path as string),
          getMailEnv().contentKey,
        ),
        "base64",
      ),
      filenameEnc: row.filename_enc as string,
      contentTypeEnc: row.content_type_enc as string,
      cipherSha256: row.cipher_sha256 as string,
      scanStatus: row.scan_status as string,
    })),
  );
}

export async function buildMime(job: JobRow, payload: OutboundMessageInput, context: Context) {
  const signature = cleanHtml(context.signatureHtml);
  const refCode = context.refCode ?? createRef(context.refPrefix, job);
  const subject = context.threadSubject ?? payload.subject;
  const replyHeaders = await loadReplyHeaders(job.thread_id);
  const attachments = await loadAttachments(job, payload.attachmentIds);
  const signatureText = signature
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const text = `${payload.textBody.trim()}\n\n${signatureText}\nRef: ${refCode}`.trim();
  const escaped = payload.textBody
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll("\n", "<br>");
  const html = `${cleanHtml(payload.htmlBody || `<p>${escaped}</p>`)}<hr>${signature}<p>Ref: ${refCode}</p>`;
  const stableMessageId = job.rfc_message_id ?? `<pt5-${job.id}@pt5china.com>`;
  const raw = (
    await new MailComposer({
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
      attachments: attachments.map((item) => ({
        filename: item.filename,
        contentType: item.contentType,
        content: item.content,
      })),
    })
      .compile()
      .build()
  ).toString("utf8");
  const rfcMessageId = raw.match(/^Message-ID:\s*(.+)$/im)?.[1]?.trim() ?? "";
  if (!rfcMessageId) throw new Error("邮件发送标识没有生成。");
  return { raw, rfcMessageId, refCode, subject, text, html, attachments };
}
