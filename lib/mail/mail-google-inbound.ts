import "server-only";

import { gmailJson } from "./mail-google-api";

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

/** 按 Gmail 分页令牌累积邮件编号，同一邮件出现在多个变更记录中时只处理一次。 */
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
  const messageIds = new Set<string>();
  const seenPageTokens = new Set<string>();
  // 历史游标过期后要读完整个时间范围；分页失败时抛出，由后台保留原游标再试。
  while (true) {
    const result = await gmailJson<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(
      accessToken, `/messages?${query}`, { signal: AbortSignal.timeout(10_000) },
    );
    for (const message of result.messages ?? []) messageIds.add(message.id);
    if (!result.nextPageToken) return [...messageIds];
    if (seenPageTokens.has(result.nextPageToken)) throw new Error("邮箱返回了重复的来信分页位置。");
    seenPageTokens.add(result.nextPageToken);
    query.set("pageToken", result.nextPageToken);
  }
}
