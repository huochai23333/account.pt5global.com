import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { decryptMailValue, encryptMailValue } from "./mail-security";

export class GoogleAuthorizationError extends Error {
  readonly name = "GoogleAuthorizationError";
}

function requireGoogleEnv(name: "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "GOOGLE_PUBSUB_TOPIC") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 尚未配置。`);
  return value;
}

export async function getSharedAccessToken(mailboxId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data: row, error } = await supabase.from("mail_shared_mailbox_credentials")
    .select("mailbox_id,access_token_enc,refresh_token_enc,access_token_expires_at")
    .eq("mailbox_id", mailboxId).maybeSingle();
  if (error || !row) throw new Error("公司邮箱授权凭据不存在。", { cause: error });
  const expiresAt = row.access_token_expires_at ? new Date(row.access_token_expires_at as string) : null;
  if (expiresAt && expiresAt.getTime() >= Date.now() + 60_000) {
    return decryptMailValue(row.access_token_enc as string, getMailEnv().credentialKey);
  }
  const response = await fetch(`${process.env.MAIL_GOOGLE_OAUTH_BASE_URL?.replace(/\/$/, "") ?? "https://oauth2.googleapis.com"}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireGoogleEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireGoogleEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: decryptMailValue(row.refresh_token_enc as string, getMailEnv().credentialKey),
      grant_type: "refresh_token",
    }),
  });
  const token = (await response.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !token.access_token) throw new GoogleAuthorizationError(token.error_description ?? "公司邮箱授权已经失效。");
  const nextExpiry = new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString();
  const { data: savedData, error: savedError } = await supabase.from("mail_shared_mailbox_credentials").update({
    access_token_enc: encryptMailValue(token.access_token, getMailEnv().credentialKey),
    access_token_expires_at: nextExpiry,
    updated_at: new Date().toISOString(),
  }).eq("mailbox_id", mailboxId).select("mailbox_id").single();
  if (savedError || savedData?.mailbox_id !== mailboxId) throw new Error("更新后的 Google 访问凭据没有确认保存。", { cause: savedError });
  return token.access_token;
}

async function gmailJson<T>(accessToken: string, path: string, init?: RequestInit) {
  // 测试环境可替换为本机故障注入边界；生产环境未配置时始终使用 Gmail 官方地址。
  const baseUrl = process.env.MAIL_GOOGLE_API_BASE_URL?.replace(/\/$/, "")
    ?? "https://gmail.googleapis.com/gmail/v1/users/me";
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const error = new Error(`Gmail API 返回 ${response.status}：${await response.text()}`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return (await response.json()) as T;
}

export type GmailPayloadPart = {
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPayloadPart[];
};

export type GmailFullMessage = {
  id: string;
  threadId: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPayloadPart;
};

export const getFullMessage = (accessToken: string, messageId: string) =>
  gmailJson<GmailFullMessage>(accessToken, `/messages/${encodeURIComponent(messageId)}?format=full`);

export const getMessageAttachment = (accessToken: string, messageId: string, attachmentId: string) =>
  gmailJson<{ data: string; size: number }>(accessToken, `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`);

export const sendRawMessage = (accessToken: string, raw: string, threadId?: string) =>
  gmailJson<{ id: string; threadId: string; labelIds?: string[] }>(accessToken, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url"), ...(threadId ? { threadId } : {}) }),
  });

/** Gmail 返回编号后再次读取 SENT 标签，作为实际发送完成凭证。 */
export async function verifySentMessage(accessToken: string, messageId: string) {
  const message = await gmailJson<{ id: string; threadId: string; labelIds?: string[] }>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}?format=minimal`,
  );
  if (message.id !== messageId || !message.labelIds?.includes("SENT")) {
    throw new Error("Gmail 返回了邮件编号，但在已发送邮件中没有找到它。");
  }
  return message;
}

export async function listHistoryMessageIds(accessToken: string, startHistoryId: string) {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  let latestHistoryId = startHistoryId;
  do {
    const query = new URLSearchParams({ startHistoryId, historyTypes: "messageAdded", maxResults: "500" });
    if (pageToken) query.set("pageToken", pageToken);
    const result = await gmailJson<{
      history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }>;
      historyId?: string;
      nextPageToken?: string;
    }>(accessToken, `/history?${query}`);
    for (const history of result.history ?? []) {
      for (const added of history.messagesAdded ?? []) if (added.message?.id) ids.add(added.message.id);
    }
    latestHistoryId = result.historyId ?? latestHistoryId;
    pageToken = result.nextPageToken;
  } while (pageToken);
  return { ids: [...ids], latestHistoryId };
}

export async function listMessagesSince(accessToken: string, since: Date) {
  const query = new URLSearchParams({ q: `after:${Math.floor(since.getTime() / 1000)}`, maxResults: "500" });
  const result = await gmailJson<{ messages?: Array<{ id: string }> }>(accessToken, `/messages?${query}`);
  return (result.messages ?? []).map((message) => message.id);
}

export async function renewSharedWatch(mailboxId: string) {
  const accessToken = await getSharedAccessToken(mailboxId);
  return gmailJson<{ historyId: string; expiration: string }>(accessToken, "/watch", {
    method: "POST",
    body: JSON.stringify({ topicName: requireGoogleEnv("GOOGLE_PUBSUB_TOPIC") }),
  });
}
