import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { getEmailConnectConfig } from "./emailconnect-config";

const usedNonces = new Map<string, number>();

/**
 * PT5 首版不新增数据表，因此在单实例进程内保存短期 nonce。
 * 时间戳和 HMAC 仍负责请求完整性；若以后扩展为多实例，应把 nonce 放入共享存储。
 */
export function verifyEmailConnectRequest(request: Request, body: string) {
  const config = getEmailConnectConfig();
  if (!config) throw new Error("邮件提醒服务尚未完成配置。");
  const installation = request.headers.get("x-emailconnect-installation") ?? "";
  const timestamp = request.headers.get("x-emailconnect-timestamp") ?? "";
  const nonce = request.headers.get("x-emailconnect-nonce") ?? "";
  const signature = request.headers.get("x-emailconnect-signature") ?? "";
  const now = Date.now();
  const requestTime = Number(timestamp) * 1000;
  if (installation !== config.installationId || !nonce || Math.abs(now - requestTime) > 5 * 60_000) {
    throw new Error("邮件提醒服务身份校验失败。");
  }

  for (const [storedNonce, expiresAt] of usedNonces) {
    if (expiresAt <= now) usedNonces.delete(storedNonce);
  }
  if (usedNonces.has(nonce)) throw new Error("重复的人员验证请求。");
  const pathname = new URL(request.url).pathname;
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const expected = Buffer.from(
    createHmac("sha256", config.signingSecret)
      .update([timestamp, nonce, request.method.toUpperCase(), pathname, bodyHash].join("."))
      .digest("base64url"),
  );
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error("邮件提醒服务签名不正确。");
  }
  usedNonces.set(nonce, now + 5 * 60_000);
}
