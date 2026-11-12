import "server-only";

import { OAuth2Client } from "google-auth-library";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { createBlindIndex } from "./mail-security";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 尚未配置。`);
  return value;
}

type GooglePushEnvelope = {
  message?: { messageId?: string; data?: string; publishTime?: string };
};

export function parseGoogleNotification(decoded: string) {
  const parsed = JSON.parse(decoded) as { emailAddress?: string; historyId?: string | number };
  const historyId = typeof parsed.historyId === "number" && Number.isSafeInteger(parsed.historyId)
    ? String(parsed.historyId)
    : typeof parsed.historyId === "string" && /^\d+$/.test(parsed.historyId)
      ? parsed.historyId
      : null;
  if (!parsed.emailAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.emailAddress) || !historyId) {
    throw new Error("Gmail 通知内容不完整。");
  }
  return { emailAddress: parsed.emailAddress.toLowerCase(), historyId };
}

/** 先核对 Google 签名、受众和服务账号，再信任请求中的通知内容。 */
export async function verifyGooglePush(request: Request, rawBody: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!idToken) throw new Error("缺少 Google Pub/Sub 身份令牌。");
  const ticket = await new OAuth2Client().verifyIdToken({ idToken, audience: requireEnv("GOOGLE_PUBSUB_AUDIENCE") });
  const payload = ticket.getPayload();
  // 验签后的声明仍需按字段类型核对；字符串 "false" 在 JavaScript 中也是真值，不能表示身份已验证。
  if (payload?.email_verified !== true || payload.email !== requireEnv("GOOGLE_PUBSUB_SERVICE_ACCOUNT")) {
    throw new Error("Google Pub/Sub 服务身份不匹配。");
  }
  const envelope = JSON.parse(rawBody) as GooglePushEnvelope;
  if (!envelope.message?.messageId || !envelope.message.data) throw new Error("Google Pub/Sub 通知格式不完整。");
  return {
    messageId: envelope.message.messageId,
    publishTime: envelope.message.publishTime ? new Date(envelope.message.publishTime) : null,
    notification: parseGoogleNotification(Buffer.from(envelope.message.data, "base64").toString("utf8")),
  };
}

/** 使用供应商消息编号去重。只有数据库中的原记录也匹配时才接受重送。 */
export async function persistGooglePush(input: Awaited<ReturnType<typeof verifyGooglePush>>) {
  const supabase = getSupabaseServiceRoleClient();
  const emailHash = createBlindIndex(input.notification.emailAddress, getMailEnv().emailHashSecret);
  const { data: mailbox, error: mailboxError } = await supabase.from("mail_shared_mailboxes")
    .select("id").eq("email_hash", emailHash).eq("status", "active").maybeSingle();
  if (mailboxError) throw new Error("公司邮箱状态暂时无法确认。", { cause: mailboxError });
  const record = {
    pubsub_message_id: input.messageId,
    mailbox_id: mailbox?.id ?? null,
    notified_email_hash: emailHash,
    target_history_id: input.notification.historyId,
    published_at: input.publishTime?.toISOString() ?? null,
    status: mailbox ? "pending" : "completed",
    completed_at: mailbox ? null : new Date().toISOString(),
  };
  const { data, error } = await supabase.from("mail_inbound_events").insert(record).select("id,mailbox_id,target_history_id,status").maybeSingle();
  if (!error && data) return { created: true, eventId: data.id as string, status: data.status as string };
  if (error?.code !== "23505") throw new Error("Gmail 通知没有确认入队。", { cause: error });
  const existing = await supabase.from("mail_inbound_events")
    .select("id,mailbox_id,target_history_id,status").eq("pubsub_message_id", input.messageId).maybeSingle();
  if (existing.error || !existing.data || existing.data.mailbox_id !== (mailbox?.id ?? null) || existing.data.target_history_id !== input.notification.historyId) {
    throw new Error("重复 Gmail 通知没有找到一致的入队凭证。", { cause: existing.error });
  }
  return { created: false, eventId: existing.data.id as string, status: existing.data.status as string };
}
