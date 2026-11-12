import type { AiAssistantChatRequest } from "@/lib/ai-assistant/assistant-types";
import { readAssistantEventStream } from "@/lib/ai-assistant/assistant-event-stream";

import { readAssistantStructuredResponse } from "./ai-assistant-response";

type AssistantRequestErrorCopy = {
  requestTooLarge: string;
  resultConfirming: string;
  serviceUnavailable: string;
  tooManyRequests: string;
};

// 普通聊天按片段更新，结汇指令返回结构化确认；两种结果共用请求与错误处理。
export async function requestAssistantReply(
  body: AiAssistantChatRequest,
  signal: AbortSignal,
  onChunk: (chunk: string) => void,
) {
  const response = await fetch("/api/assistant/chat", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal,
  });

  if (!response.ok) {
    throw new AiAssistantRequestError(await readAssistantErrorCode(response));
  }

  if (response.headers.get("content-type")?.includes("application/json")) {
    return readAssistantStructuredResponse(response);
  }

  if (!response.body) throw new Error("assistant unavailable");

  await readAssistantEventStream(response.body, onChunk);
  return null;
}

export function getAssistantErrorMessage(
  error: unknown,
  copy: AssistantRequestErrorCopy,
) {
  if (error instanceof AiAssistantRequestError) {
    if (error.code === "tooManyRequests") {
      return copy.tooManyRequests;
    }

    if (error.code === "requestTooLarge") {
      return copy.requestTooLarge;
    }

    if (error.code === "resultConfirming") {
      return copy.resultConfirming;
    }
  }

  return copy.serviceUnavailable;
}

class AiAssistantRequestError extends Error {
  constructor(public code: string | null) {
    super(code ?? "assistant unavailable");
  }
}

async function readAssistantErrorCode(response: Response) {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}
