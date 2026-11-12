import type { ServerResponse } from "node:http";
import { writeBoundaryJson as json } from "../../test-support/loopback-http-boundary";
import { mailBoundaryState as state } from "./mail-boundary-state";

/** Gmail 的发送凭证、入站 MIME 与附件下载各在同一协议处理器中，全部只是内存假响应。 */
export function handleGmailBoundary(
  url: URL,
  body: Record<string, unknown>,
  response: ServerResponse,
) {
  if (url.pathname === "/gmail/v1/users/me/messages/send") {
    const raw = Buffer.from(String(body.raw ?? ""), "base64url").toString(
      "utf8",
    );
    const messageId = `gmail-${state.sent.length + 1}`;
    const threadId =
      typeof body.threadId === "string"
        ? body.threadId
        : `gmail-thread-${state.sent.length + 1}`;
    state.sent.push({
      messageId,
      threadId,
      verifiedInSent: !raw.includes("BROKEN RECEIPT"),
      raw,
    });
    return json(response, { id: messageId, threadId });
  }
  if (url.pathname === "/gmail/v1/users/me/history") {
    return json(response, {
      history: state.inbound.map((message) => ({
        messagesAdded: [{ message: { id: message.id } }],
      })),
      historyId: String(100 + state.inbound.length),
    });
  }
  const messageMatch = url.pathname.match(
    /^\/gmail\/v1\/users\/me\/messages\/(gmail-\d+)$/,
  );
  if (messageMatch) {
    const receipt = state.sent.find(
      (item) => item.messageId === messageMatch[1],
    );
    if (!receipt) return json(response, { error: "not found" }, 404);
    return json(response, {
      id: receipt.messageId,
      threadId: receipt.threadId,
      labelIds: receipt.verifiedInSent ? ["SENT"] : [],
    });
  }
  const inboundMessageMatch = url.pathname.match(
    /^\/gmail\/v1\/users\/me\/messages\/([^/]+)$/,
  );
  if (inboundMessageMatch) {
    const message = state.inbound.find(
      (item) => item.id === decodeURIComponent(inboundMessageMatch[1]),
    );
    if (!message) return json(response, { error: "not found" }, 404);
    const parts: Array<Record<string, unknown>> = [
      {
        mimeType: "text/plain",
        body: { data: Buffer.from(message.text).toString("base64url") },
      },
    ];
    if (message.attachment) {
      parts.push({
        mimeType: message.attachment.contentType,
        filename: message.attachment.filename,
        body: {
          attachmentId: message.attachment.id,
          size: Buffer.byteLength(message.attachment.content),
        },
      });
    }
    return json(response, {
      id: message.id,
      threadId: message.threadId,
      internalDate: String(Date.now()),
      labelIds: ["INBOX"],
      payload: {
        mimeType: "multipart/mixed",
        headers: [
          { name: "From", value: message.from },
          { name: "To", value: message.to },
          { name: "Subject", value: message.subject },
          { name: "Message-ID", value: `<${message.id}@example.com>` },
        ],
        parts,
      },
    });
  }
  const attachmentMatch = url.pathname.match(
    /^\/gmail\/v1\/users\/me\/messages\/([^/]+)\/attachments\/([^/]+)$/,
  );
  if (attachmentMatch) {
    const message = state.inbound.find(
      (item) => item.id === decodeURIComponent(attachmentMatch[1]),
    );
    if (
      !message?.attachment ||
      message.attachment.id !== decodeURIComponent(attachmentMatch[2])
    ) {
      return json(response, { error: "not found" }, 404);
    }
    state.attachmentFetches += 1;
    return json(response, {
      data: Buffer.from(message.attachment.content).toString("base64url"),
      size: Buffer.byteLength(message.attachment.content),
    });
  }
  return json(response, { error: "not found" }, 404);
}
