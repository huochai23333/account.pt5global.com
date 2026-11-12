import "server-only";

import { getMailEnv } from "./mail-env";
import { requireMailAdministrator } from "./mail-identity";
import type { MailIdentity } from "./mail-types";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 尚未配置。`);
  return value;
}

export function createGoogleAuthorizationUrl(state: string, challenge: string) {
  // 本地回归的同意页与令牌交换共用外部边界；线上未配置覆盖地址时使用官方入口。
  const oauthBase = process.env.MAIL_GOOGLE_OAUTH_BASE_URL?.replace(/\/$/, "");
  const url = new URL(oauthBase ? `${oauthBase}/authorize` : "https://accounts.google.com/o/oauth2/v2/auth");
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

/** 飞书和 Gmail 分别声明自己的授权范围，共用站点配置中的固定回调来源。 */
export function createFeishuAuthorizationUrl(state: string) {
  const url = new URL("https://accounts.feishu.cn/open-apis/authen/v1/authorize");
  url.searchParams.set("client_id", requireEnv("FEISHU_APP_ID"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "contact:user.base:readonly");
  url.searchParams.set("redirect_uri", `${getMailEnv().siteUrl}/api/mail/oauth/feishu/callback`);
  url.searchParams.set("state", state);
  return url;
}

/** 邮件页面先回到本应用授权入口，由该入口登记一次性状态后才跳往供应商。 */
export function createSharedMailboxConnectSession(identity: MailIdentity, returnUrl: string) {
  requireMailAdministrator(identity);
  const target = new URL("/api/mail/oauth/google/start", getMailEnv().siteUrl);
  target.searchParams.set("returnUrl", returnUrl);
  return Promise.resolve({
    connectUrl: target.toString(),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
}

export function createFeishuConnectSession(returnUrl: string) {
  const target = new URL("/api/mail/oauth/feishu/start", getMailEnv().siteUrl);
  target.searchParams.set("returnUrl", returnUrl);
  return Promise.resolve({
    connectUrl: target.toString(),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
}
