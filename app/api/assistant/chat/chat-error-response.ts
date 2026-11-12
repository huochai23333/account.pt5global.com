import { NextResponse } from "next/server";

import type { AiAssistantChatErrorCode } from "@/lib/ai-assistant/assistant-types";

// 接口使用固定错误码，页面可以据此选择对应的双语提示。
const STATUS_BY_ERROR_CODE = {
  invalidInput: 400,
  notSignedIn: 401,
  resultConfirming: 409,
  requestTooLarge: 413,
  tooManyRequests: 429,
  serviceUnavailable: 503,
} as const satisfies Record<AiAssistantChatErrorCode, number>;

export function createErrorResponse(
  code: AiAssistantChatErrorCode,
  retryAfterSeconds?: number,
) {
  const headers = retryAfterSeconds
    ? { "Retry-After": String(retryAfterSeconds) }
    : undefined;

  return NextResponse.json(
    {
      error: code,
    },
    {
      headers,
      status: STATUS_BY_ERROR_CODE[code],
    },
  );
}
