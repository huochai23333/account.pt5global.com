import { createHash, createHmac, randomBytes } from "node:crypto";

import type {
  AdminEmailConnectionHealth,
  EmailConnectionSummary,
  EmailConnectIdentity,
  EmailPlatformRule,
} from "./emailconnect-types";
import { getEmailConnectConfig } from "./emailconnect-config";

function signRequest(method: string, pathname: string, timestamp: string, nonce: string, body: string, secret: string) {
  const bodyHash = createHash("sha256").update(body).digest("hex");
  return createHmac("sha256", secret)
    .update([timestamp, nonce, method.toUpperCase(), pathname, bodyHash].join("."))
    .digest("base64url");
}

/** 所有 EmailConnect 调用都从 PT5 服务端发出，浏览器无法读取安装密钥。 */
async function emailConnectRequest<T>(pathname: string, init: RequestInit = {}) {
  const config = getEmailConnectConfig();
  if (!config) throw new Error("邮件提醒服务尚未完成配置。");
  const method = init.method ?? "GET";
  const body = typeof init.body === "string" ? init.body : "";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(18).toString("base64url");
  const response = await fetch(new URL(pathname, config.baseUrl), {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-emailconnect-installation": config.installationId,
      "x-emailconnect-timestamp": timestamp,
      "x-emailconnect-nonce": nonce,
      "x-emailconnect-signature": signRequest(method, pathname, timestamp, nonce, body, config.signingSecret),
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(result?.error ?? "邮件提醒服务暂时无法使用。");
  }
  return (await response.json()) as T;
}

export function createEmailConnectSession(identity: EmailConnectIdentity, returnUrl: string) {
  return emailConnectRequest<{ connectUrl: string; expiresAt: string }>("/api/v1/connect-sessions", {
    method: "POST",
    body: JSON.stringify({ identity, returnUrl }),
  });
}

export function getEmailConnectionSummary(externalUserId: string) {
  return emailConnectRequest<EmailConnectionSummary>(
    `/api/v1/users/${encodeURIComponent(externalUserId)}/summary`,
  );
}

export function disconnectEmailConnection(externalUserId: string, connectionId: string) {
  return emailConnectRequest<{ disconnected: true }>(
    `/api/v1/connections/${encodeURIComponent(connectionId)}`,
    { method: "DELETE", body: JSON.stringify({ externalUserId }) },
  );
}

export function getEmailPlatformRules(identity: EmailConnectIdentity) {
  return emailConnectRequest<{ rules: EmailPlatformRule[] }>("/api/v1/rules/query", {
    method: "POST",
    body: JSON.stringify({ identity }),
  });
}

export function updateEmailPlatformRules(identity: EmailConnectIdentity, rules: EmailPlatformRule[]) {
  return emailConnectRequest<{ rules: EmailPlatformRule[] }>("/api/v1/rules", {
    method: "PUT",
    body: JSON.stringify({ identity, rules }),
  });
}

export function getAdminEmailConnectionHealth(identity: EmailConnectIdentity) {
  return emailConnectRequest<{ connections: AdminEmailConnectionHealth[] }>("/api/v1/admin/connections", {
    method: "POST",
    body: JSON.stringify({ identity }),
  });
}
