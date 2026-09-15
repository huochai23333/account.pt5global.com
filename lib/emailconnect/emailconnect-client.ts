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
  return emailConnectRequest<unknown>("/api/v1/connect-sessions", {
    method: "POST",
    body: JSON.stringify({ identity, returnUrl }),
  }).then((value) => {
    const result = requireRecord(value, "连接服务没有返回完整结果。");
    if (typeof result.connectUrl !== "string" || typeof result.expiresAt !== "string") {
      throw new Error("连接服务没有返回完整结果。");
    }
    return { connectUrl: result.connectUrl, expiresAt: result.expiresAt };
  });
}

export function getEmailConnectionSummary(externalUserId: string) {
  return emailConnectRequest<unknown>(
    `/api/v1/users/${encodeURIComponent(externalUserId)}/summary`,
  ).then(validateConnectionSummary);
}

export function disconnectEmailConnection(externalUserId: string, connectionId: string) {
  return emailConnectRequest<unknown>(
    `/api/v1/connections/${encodeURIComponent(connectionId)}`,
    { method: "DELETE", body: JSON.stringify({ externalUserId }) },
  ).then((value) => {
    const result = requireRecord(value, "邮箱连接没有确认断开。");
    if (result.disconnected !== true) throw new Error("邮箱连接没有确认断开。");
    return { disconnected: true as const };
  });
}

export function getEmailPlatformRules(identity: EmailConnectIdentity) {
  return emailConnectRequest<unknown>("/api/v1/rules/query", {
    method: "POST",
    body: JSON.stringify({ identity }),
  }).then(validateRulesResponse);
}

export async function updateEmailPlatformRules(identity: EmailConnectIdentity, rules: EmailPlatformRule[]) {
  const result = validateRulesResponse(await emailConnectRequest<unknown>("/api/v1/rules", {
    method: "PUT",
    body: JSON.stringify({ identity, rules }),
  }));
  if (result.rules.length !== rules.length || rules.some((rule) =>
    !result.rules.some((savedRule) => savedRule.id === rule.id)
  )) {
    throw new Error("部分提醒规则没有确认保存，请刷新后核对。");
  }
  return result;
}

export function getAdminEmailConnectionHealth(identity: EmailConnectIdentity) {
  return emailConnectRequest<unknown>("/api/v1/admin/connections", {
    method: "POST",
    body: JSON.stringify({ identity }),
  }).then((value) => {
    const result = requireRecord(value, "邮箱连接健康状态返回不完整。");
    if (!Array.isArray(result.connections)) throw new Error("邮箱连接健康状态返回不完整。");
    return { connections: result.connections as AdminEmailConnectionHealth[] };
  });
}

function validateRulesResponse(value: unknown) {
  const result = requireRecord(value, "提醒规则返回不完整。");
  if (!Array.isArray(result.rules) || result.rules.some((rule) =>
    !isRecord(rule) || typeof rule.id !== "string" || typeof rule.name !== "string" ||
    !Array.isArray(rule.senderDomains) || !Array.isArray(rule.subjectKeywords) ||
    !["all", "any"].includes(String(rule.keywordMode)) || typeof rule.enabled !== "boolean"
  )) {
    throw new Error("提醒规则返回不完整。");
  }
  return { rules: result.rules as EmailPlatformRule[] };
}

function validateConnectionSummary(value: unknown): EmailConnectionSummary {
  const result = requireRecord(value, "邮箱连接状态返回不完整。");
  if (typeof result.feishuBound !== "boolean" || !Array.isArray(result.connections)) {
    throw new Error("邮箱连接状态返回不完整。");
  }
  return result as EmailConnectionSummary;
}

function requireRecord(value: unknown, message: string) {
  if (!isRecord(value)) throw new Error(message);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
