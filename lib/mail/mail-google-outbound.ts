import "server-only";

import { gmailJson } from "./mail-google-api";

export const sendRawMessage = (accessToken: string, raw: string, threadId?: string) =>
  gmailJson<{ id: string; threadId: string; labelIds?: string[] }>(accessToken, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url"), ...(threadId ? { threadId } : {}) }),
  });

/** 发送响应丢失时按预先保存的 Message-ID 查询 Gmail 已发送邮件，不重新投递。 */
export async function findSentMessageByRfcId(accessToken: string, rfcMessageId: string) {
  const query = new URLSearchParams({ q: `in:sent rfc822msgid:${rfcMessageId}`, maxResults: "2" });
  const result = await gmailJson<{ messages?: Array<{ id: string; threadId: string }> }>(
    accessToken,
    `/messages?${query}`,
  );
  if ((result.messages?.length ?? 0) > 1) throw new Error("公司邮箱中找到多封相同标识的已发送邮件，需要人工核对。");
  return result.messages?.[0] ?? null;
}

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
