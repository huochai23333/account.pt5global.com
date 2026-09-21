import { createHash } from "node:crypto";

import { OAuth2Client } from "google-auth-library";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { createBlindIndex, decryptMailValue, encryptMailValue, maskEmail, randomToken, sha256 } from "./mail-security";
import type { MailIdentity } from "./mail-types";

type GoogleTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date | null;
  scope: string[];
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 尚未配置。`);
  return value;
}

function safeReturnUrl(value: string | null) {
  const fallback = new URL("/admin/mail", getMailEnv().siteUrl);
  if (!value) return fallback.toString();
  try {
    const candidate = new URL(value, getMailEnv().siteUrl);
    return candidate.origin === fallback.origin ? candidate.toString() : fallback.toString();
  } catch {
    return fallback.toString();
  }
}

export function createPkcePair() {
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export async function createOAuthTransaction(input: {
  identity: MailIdentity;
  provider: "google" | "feishu";
  purpose: "shared_mailbox" | "member_feishu";
  returnUrl: string | null;
  pkceVerifier?: string;
}) {
  const state = randomToken();
  const env = getMailEnv();
  const { data, error } = await getSupabaseServiceRoleClient().from("mail_oauth_transactions").insert({
    state_hash: sha256(state),
    user_id: input.identity.userId,
    provider: input.provider,
    purpose: input.purpose,
    return_url: safeReturnUrl(input.returnUrl),
    pkce_verifier_enc: input.pkceVerifier ? encryptMailValue(input.pkceVerifier, env.credentialKey) : null,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  }).select("state_hash").single();
  if (error || data?.state_hash !== sha256(state)) throw new Error("授权状态没有确认创建。", { cause: error });
  return state;
}

export async function consumeOAuthTransaction(input: {
  state: string;
  provider: "google" | "feishu";
  identity: MailIdentity;
}) {
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseServiceRoleClient().from("mail_oauth_transactions")
    .update({ consumed_at: now })
    .eq("state_hash", sha256(input.state))
    .eq("provider", input.provider)
    .eq("user_id", input.identity.userId)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("purpose,return_url,pkce_verifier_enc")
    .maybeSingle();
  if (error || !data) throw new Error("授权状态已使用或已经过期。", { cause: error });
  return {
    purpose: data.purpose as "shared_mailbox" | "member_feishu",
    returnUrl: safeReturnUrl(data.return_url as string),
    pkceVerifier: data.pkce_verifier_enc
      ? decryptMailValue(data.pkce_verifier_enc as string, getMailEnv().credentialKey)
      : null,
  };
}

export function createGoogleAuthorizationUrl(state: string, challenge: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", requireEnv("GOOGLE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", `${getMailEnv().siteUrl}/api/mail/oauth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email https://www.googleapis.com/auth/gmail.modify");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

export async function exchangeGoogleCode(code: string, verifier: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
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
  });
  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error_description?: string;
  };
  if (!response.ok || !data.access_token || !data.refresh_token) {
    throw new Error(data.error_description ?? "Google 授权交换失败，请重新授权并允许离线访问。");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    scope: data.scope?.split(" ").filter(Boolean) ?? [],
  } satisfies GoogleTokens;
}

export async function getGoogleProfile(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const profile = (await response.json()) as { sub?: string; email?: string; email_verified?: boolean };
  if (!response.ok || !profile.sub || !profile.email || !profile.email_verified) throw new Error("无法确认 Google 邮箱身份。");
  return { subject: profile.sub, email: profile.email.toLowerCase() };
}

export async function startGmailWatch(accessToken: string) {
  const topicName = requireEnv("GOOGLE_PUBSUB_TOPIC");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ topicName }),
    cache: "no-store",
  });
  const watch = (await response.json()) as { historyId?: string; expiration?: string; error?: { message?: string } };
  if (!response.ok || !watch.historyId || !watch.expiration) throw new Error(watch.error?.message ?? "无法启动 Gmail 新邮件通知。");
  return { historyId: watch.historyId, expiration: new Date(Number(watch.expiration)), topicName };
}

export async function saveSharedMailbox(input: {
  subject: string;
  email: string;
  tokens: GoogleTokens;
  watch: { historyId: string; expiration: Date; topicName: string };
}) {
  const env = getMailEnv();
  if (input.email.toLowerCase() !== env.sharedMailboxEmail) throw new Error(`请授权公司邮箱 ${env.sharedMailboxEmail}。`);
  if (!input.tokens.scope.includes("https://www.googleapis.com/auth/gmail.modify")) throw new Error("公司邮箱没有授予完整的收发权限。");
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

export function createFeishuAuthorizationUrl(state: string) {
  const url = new URL("https://accounts.feishu.cn/open-apis/authen/v1/authorize");
  url.searchParams.set("client_id", requireEnv("FEISHU_APP_ID"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "contact:user.base:readonly");
  url.searchParams.set("redirect_uri", `${getMailEnv().siteUrl}/api/mail/oauth/feishu/callback`);
  url.searchParams.set("state", state);
  return url;
}

export async function getFeishuIdentity(code: string) {
  const redirectUri = `${getMailEnv().siteUrl}/api/mail/oauth/feishu/callback`;
  const tokenResponse = await fetch("https://open.feishu.cn/open-apis/authen/v2/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: requireEnv("FEISHU_APP_ID"),
      client_secret: requireEnv("FEISHU_APP_SECRET"),
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  const token = (await tokenResponse.json()) as { access_token?: string; error_description?: string };
  if (!tokenResponse.ok || !token.access_token) throw new Error(token.error_description ?? "飞书授权交换失败。");
  const profileResponse = await fetch("https://open.feishu.cn/open-apis/authen/v1/user_info", {
    headers: { authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });
  const profile = (await profileResponse.json()) as {
    code?: number;
    msg?: string;
    data?: { open_id?: string; name?: string; en_name?: string };
  };
  if (!profileResponse.ok || profile.code !== 0 || !profile.data?.open_id) throw new Error(profile.msg ?? "无法读取飞书人员身份。");
  return { openId: profile.data.open_id, displayName: profile.data.name ?? profile.data.en_name ?? "飞书用户" };
}

export async function bindFeishuIdentity(identity: MailIdentity, openId: string, displayName: string) {
  const { data, error } = await getSupabaseServiceRoleClient().from("mail_feishu_bindings").upsert({
    user_id: identity.userId,
    open_id: openId,
    display_name_enc: encryptMailValue(displayName, getMailEnv().contentKey),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" }).select("user_id,open_id").single();
  if (error || data?.user_id !== identity.userId || data.open_id !== openId) {
    throw new Error("飞书身份没有确认绑定，可能已经属于其他账号。", { cause: error });
  }
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

export async function verifyGooglePush(request: Request, rawBody: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!idToken) throw new Error("缺少 Google Pub/Sub 身份令牌。");
  const ticket = await new OAuth2Client().verifyIdToken({ idToken, audience: requireEnv("GOOGLE_PUBSUB_AUDIENCE") });
  const payload = ticket.getPayload();
  if (!payload?.email_verified || payload.email !== requireEnv("GOOGLE_PUBSUB_SERVICE_ACCOUNT")) {
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
