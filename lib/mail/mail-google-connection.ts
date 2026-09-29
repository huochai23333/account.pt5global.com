import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";
import { getMailEnv } from "./mail-env";
import { MailConnectionError } from "./mail-connection-feedback";
import { createBlindIndex, encryptMailValue, maskEmail } from "./mail-security";

type GoogleTokens = { accessToken: string; refreshToken: string; expiresAt: Date | null; scope: string[] };
function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("公司邮箱连接设置不完整，请联系管理员。");
  return value;
}

/** 一次性授权码和 PKCE 必须一起交换；缺少离线凭据时不能宣告邮箱已连接。 */
export async function exchangeGoogleCode(code: string, verifier: string) {
  const oauthBase = process.env.MAIL_GOOGLE_OAUTH_BASE_URL?.replace(/\/$/, "");
  const response = await fetch(`${oauthBase ?? "https://oauth2.googleapis.com"}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: `${getMailEnv().siteUrl}/api/mail/oauth/google/callback`,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error_description?: string;
  };
  if (!response.ok || !data.access_token || !data.refresh_token) {
    throw new MailConnectionError("tokens");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    scope: data.scope?.split(" ").filter(Boolean) ?? [],
  } satisfies GoogleTokens;
}

export async function getGoogleProfile(accessToken: string) {
  // 与令牌接口使用同一个本机测试边界；线上没有覆盖变量时使用 Google 官方身份接口。
  const oauthBase = process.env.MAIL_GOOGLE_OAUTH_BASE_URL?.replace(/\/$/, "");
  const response = await fetch(oauthBase ? `${oauthBase}/userinfo` : "https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const profile = (await response.json()) as { sub?: string; email?: string; email_verified?: boolean };
  if (!response.ok || !profile.sub || !profile.email || !profile.email_verified) throw new MailConnectionError("profile");
  return { subject: profile.sub, email: profile.email.toLowerCase() };
}

export async function startGmailWatch(accessToken: string) {
  const topicName = requireEnv("GOOGLE_PUBSUB_TOPIC");
  const gmailBase = process.env.MAIL_GOOGLE_API_BASE_URL?.replace(/\/$/, "") ?? "https://gmail.googleapis.com/gmail/v1/users/me";
  const response = await fetch(`${gmailBase}/watch`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ topicName }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const watch = (await response.json()) as { historyId?: string; expiration?: string; error?: { message?: string } };
  const expiration = new Date(Number(watch.expiration));
  if (!response.ok || !watch.historyId || !/^\d+$/.test(watch.historyId) || !(expiration.getTime() > Date.now())) throw new MailConnectionError("watch");
  return { historyId: watch.historyId, expiration, topicName };
}

export function validateCompanyMailbox(email: string, tokens: GoogleTokens) {
  if (email.toLowerCase() !== getMailEnv().sharedMailboxEmail) throw new MailConnectionError("account");
  if (!tokens.scope.includes("https://www.googleapis.com/auth/gmail.modify")) throw new MailConnectionError("scope");
}

/** 数据库事务统一保存邮箱、加密凭据和通知游标，再核对返回的邮箱编号及游标。 */
export async function saveSharedMailbox(input: {
  subject: string;
  email: string;
  tokens: GoogleTokens;
  watch: { historyId: string; expiration: Date; topicName: string };
}) {
  const env = getMailEnv();
  validateCompanyMailbox(input.email, input.tokens);
  const { data, error } = await getSupabaseServiceRoleClient().rpc("save_mail_shared_mailbox", {
    p_provider_subject: input.subject,
    p_email_enc: encryptMailValue(input.email, env.contentKey),
    p_email_hash: createBlindIndex(input.email, env.emailHashSecret),
    p_email_masked: maskEmail(input.email),
    p_access_token_enc: encryptMailValue(input.tokens.accessToken, env.credentialKey),
    p_refresh_token_enc: encryptMailValue(input.tokens.refreshToken, env.credentialKey),
    p_access_token_expires_at: input.tokens.expiresAt?.toISOString() ?? null,
    p_scopes: input.tokens.scope,
    p_history_id: input.watch.historyId,
    p_expiration: input.watch.expiration.toISOString(),
    p_topic_name: input.watch.topicName,
  });
  const saved = Array.isArray(data) ? data[0] : null;
  if (error || !saved?.mailbox_id || saved.history_id !== input.watch.historyId) {
    throw new Error("公司邮箱授权没有完整保存。", { cause: error });
  }
  return saved.mailbox_id as string;
}
