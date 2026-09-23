import type { OutboundMessageInput } from "@/lib/mail/mail-types";

function storageKey(userId: string) {
  // 不同登录账号共用同一浏览器标签页时，不能互相继承发送中的任务标识。
  return `pt5:pending-mail-send:${userId}`;
}

export type MailSendIntent = {
  key: string;
  fingerprint: string;
  jobId: string | null;
};

/** 只保存发送标识与内容指纹；邮件正文和地址不写入浏览器存储。 */
export async function fingerprintMailMessage(message: Omit<OutboundMessageInput, "idempotencyKey">) {
  const bytes = new TextEncoder().encode(JSON.stringify(message));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readMailSendIntent(userId: string): MailSendIntent | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<MailSendIntent>;
    return typeof value.key === "string" && typeof value.fingerprint === "string"
      ? { key: value.key, fingerprint: value.fingerprint, jobId: value.jobId ?? null }
      : null;
  } catch {
    return null;
  }
}

export function writeMailSendIntent(userId: string, value: MailSendIntent | null) {
  try {
    if (value) window.sessionStorage.setItem(storageKey(userId), JSON.stringify(value));
    else window.sessionStorage.removeItem(storageKey(userId));
  } catch {
    // 私密浏览模式可能禁用存储；当前页面仍用内存状态守住同一发送意图。
  }
}
