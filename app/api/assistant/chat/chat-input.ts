import type { AiAssistantChatMessage, AiAssistantLocale } from "@/lib/ai-assistant/assistant-types";
import { readLimitedJsonBody } from "@/lib/server-request-body";

const MAX_ASSISTANT_BODY_BYTES = 64 * 1024;
const MAX_HISTORY_ITEMS = 6;
const MAX_MESSAGE_LENGTH = 600;

// 请求先限字节，再整理正文和最近对话，避免把任意浏览器数据直接传给供应商。
export async function readAssistantChatInput(request: Request) {
  return normalizeRequestPayload(await readLimitedJsonBody(request, MAX_ASSISTANT_BODY_BYTES));
}

export type NormalizedAssistantPayload = {
  history: AiAssistantChatMessage[];
  locale: AiAssistantLocale;
  message: string;
  pathname: string;
  requestId: string;
};

function normalizeRequestPayload(value: unknown): NormalizedAssistantPayload {
  if (!isRecord(value)) {
    throw new Error("invalid assistant payload");
  }

  const message = normalizeString(value.message, MAX_MESSAGE_LENGTH);

  if (!message) {
    throw new Error("empty assistant message");
  }

  return {
    history: normalizeHistory(value.history),
    locale: value.locale === "en" ? "en" : "zh",
    message,
    pathname: normalizeString(value.pathname, 160) || "/",
    requestId: normalizeRequestId(value.requestId),
  };
}

function normalizeRequestId(value: unknown) {
  const requestId = normalizeString(value, 120);
  if (!/^[a-zA-Z0-9_-]{16,120}$/.test(requestId)) {
    throw new Error("invalid assistant request id");
  }
  return requestId;
}

function normalizeHistory(value: unknown): AiAssistantChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item): AiAssistantChatMessage => {
      const role: AiAssistantChatMessage["role"] =
        item.role === "assistant" ? "assistant" : "user";

      return {
        content: normalizeString(item.content, MAX_MESSAGE_LENGTH),
        role,
      };
    })
    .filter((item) => item.content.length > 0)
    .slice(-MAX_HISTORY_ITEMS);
}

function normalizeString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
