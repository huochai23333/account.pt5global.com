/** 把 Gmail MIME 内容转换为受限正文与附件；解析不负责路由、分配或数据库归档。 */
import sanitizeHtml from "sanitize-html";
import { UnsupportedInboundMessageError } from "./mail-inbound-errors";
import { getMessageAttachment, type GmailFullMessage, type GmailPayloadPart } from "./mail-google-inbound";
import { extractEmailAddresses } from "./mail-recipient-addresses";
import { cleanAttachmentFilename } from "./mail-storage";

export type ParsedAttachment = { filename: string; contentType: string; bytes: Buffer };

function decodeBody(value?: string) {
  return value ? Buffer.from(value, "base64url").toString("utf8") : "";
}

async function collectParts(
  accessToken: string,
  messageId: string,
  part: GmailPayloadPart | undefined,
  output: { texts: string[]; html: string[]; attachments: ParsedAttachment[] },
) {
  if (!part) return;
  for (const child of part.parts ?? []) await collectParts(accessToken, messageId, child, output);
  const contentType = part.mimeType ?? "application/octet-stream";
  if (part.filename) {
    const data =
      part.body?.data ??
      (part.body?.attachmentId
        ? (await getMessageAttachment(accessToken, messageId, part.body.attachmentId)).data
        : "");
    const bytes = Buffer.from(data, "base64url");
    if (bytes.length > 10 * 1024 * 1024)
      throw new UnsupportedInboundMessageError("attachment_too_large");
    let filename: string;
    try {
      filename = cleanAttachmentFilename(part.filename);
    } catch {
      throw new UnsupportedInboundMessageError("blocked_attachment");
    }
    output.attachments.push({ filename, contentType, bytes });
  } else if (contentType === "text/plain") {
    output.texts.push(decodeBody(part.body?.data));
  } else if (contentType === "text/html") {
    output.html.push(decodeBody(part.body?.data));
  }
}

export function parseEnvelope(message: GmailFullMessage) {
  const headers = new Map(
    (message.payload?.headers ?? []).map((header) => [header.name.toLowerCase(), header.value]),
  );
  return {
    from: headers.get("from") ?? "",
    to: extractEmailAddresses(headers.get("to") ?? ""),
    cc: extractEmailAddresses(headers.get("cc") ?? ""),
    bcc: extractEmailAddresses(headers.get("bcc") ?? ""),
    deliveredTo: extractEmailAddresses(headers.get("delivered-to") ?? ""),
    subject: headers.get("subject") ?? "（无主题）",
    messageIdHeader: headers.get("message-id") ?? "",
    headers: Object.fromEntries(
      [...headers].filter(([name]) =>
        [
          "message-id",
          "in-reply-to",
          "references",
          "reply-to",
          "delivered-to",
          "list-unsubscribe",
          "list-id",
          "precedence",
          "auto-submitted",
        ].includes(name),
      ),
    ),
  };
}

export async function parseMessage(
  accessToken: string,
  message: GmailFullMessage,
  envelope: ReturnType<typeof parseEnvelope>,
) {
  const output: { texts: string[]; html: string[]; attachments: ParsedAttachment[] } = {
    texts: [],
    html: [],
    attachments: [],
  };
  await collectParts(accessToken, message.id, message.payload, output);
  if (output.attachments.length > 10)
    throw new UnsupportedInboundMessageError("too_many_attachments");
  if (output.attachments.reduce((sum, item) => sum + item.bytes.length, 0) > 20 * 1024 * 1024) {
    throw new UnsupportedInboundMessageError("attachments_too_large");
  }
  const htmlBody = sanitizeHtml(output.html.join("\n"), {
    allowedTags: [
      "p",
      "br",
      "div",
      "span",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "a",
    ],
    allowedAttributes: { a: ["href", "title"], "*": ["dir"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      }),
    },
  });
  return {
    ...envelope,
    textBody: output.texts.join("\n").trim(),
    htmlBody,
    attachments: output.attachments,
  };
}
