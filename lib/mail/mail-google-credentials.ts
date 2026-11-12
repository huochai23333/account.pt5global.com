import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { gmailJson } from "./mail-google-api";
import { decryptMailValue, encryptMailValue } from "./mail-security";

export class GoogleAuthorizationError extends Error {
  readonly name = "GoogleAuthorizationError";
}

function requireGoogleEnv(name: "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "GOOGLE_PUBSUB_TOPIC") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 尚未配置。`);
  return value;
}

/** 先复用仍有效的访问凭据。需要刷新时，保存新凭据并核对数据库回执后才能继续。 */
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

export async function renewSharedWatch(mailboxId: string) {
  const accessToken = await getSharedAccessToken(mailboxId);
  return gmailJson<{ historyId: string; expiration: string }>(accessToken, "/watch", {
    method: "POST",
    body: JSON.stringify({ topicName: requireGoogleEnv("GOOGLE_PUBSUB_TOPIC") }),
  });
}
