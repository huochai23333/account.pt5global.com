import { NextResponse } from "next/server";

import { buildAssistantMessages } from "@/lib/ai-assistant/assistant-prompt";
import type {
  AiAssistantChatErrorCode,
  AiAssistantChatMessage,
  AiAssistantLocale,
  AiAssistantStructuredResponse,
} from "@/lib/ai-assistant/assistant-types";
import {
  AiAssistantServiceError,
  createDeepSeekAssistantTextStream,
} from "@/lib/ai-assistant/deepseek-client";
import { parseSettlementReleaseCommand } from "@/lib/ai-assistant/settlement-release-command";
import {
  buildSettlementReleaseConfirmation,
  SettlementReleaseServiceError,
} from "@/lib/ai-assistant/settlement-release-server";
import {
  acquireApiRequestQuota,
  releaseApiRequestQuota,
} from "@/lib/api-request-quota";
import { getServerAuthContext } from "@/lib/server-auth";
import {
  readLimitedJsonBody,
  RequestBodyTooLargeError,
} from "@/lib/server-request-body";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import {
  createServerOperationRun,
  finishServerOperationRun,
} from "@/lib/server-operation-runs";

export const runtime = "nodejs";

const ASSISTANT_TIMEOUT_MS = 20_000;
const MAX_ASSISTANT_BODY_BYTES = 64 * 1024;
const MAX_HISTORY_ITEMS = 6;
const MAX_MESSAGE_LENGTH = 600;

const STATUS_BY_ERROR_CODE = {
  invalidInput: 400,
  notSignedIn: 401,
  resultConfirming: 409,
  requestTooLarge: 413,
  tooManyRequests: 429,
  serviceUnavailable: 503,
} as const satisfies Record<AiAssistantChatErrorCode, number>;

export async function POST(request: Request) {
  const { role, status, userId } = await getServerAuthContext();

  if (!userId || status !== "active") {
    return createErrorResponse("notSignedIn");
  }

  let payload: NormalizedAssistantPayload;

  try {
    payload = normalizeRequestPayload(
      await readLimitedJsonBody(request, MAX_ASSISTANT_BODY_BYTES),
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return createErrorResponse("requestTooLarge");
    }

    return createErrorResponse("invalidInput");
  }

  const supabase = await getServerSupabaseClient();
  const settlementResponse = await buildSettlementResponse(
    supabase,
    payload.message,
    role,
  );

  if (settlementResponse) {
    return settlementResponse;
  }

  let leaseId: string | null = null;

  try {
    const quota = await acquireApiRequestQuota(supabase, "ai");

    if (!quota.allowed) {
      return createErrorResponse("tooManyRequests", quota.retryAfterSeconds);
    }

    leaseId = quota.leaseId;
  } catch {
    return createErrorResponse("serviceUnavailable");
  }

  const releaseQuota = async () => {
    const currentLeaseId = leaseId;
    leaseId = null;
    await releaseApiRequestQuota(supabase, currentLeaseId);
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ASSISTANT_TIMEOUT_MS);
  let operationId: string | null = null;

  try {
    const operation = await createServerOperationRun({
      idempotencyKey: payload.requestId,
      operationKey: "ai-assistant-generation",
      requestPayload: { locale: payload.locale, pathname: payload.pathname },
      requestedByUserId: userId,
    });
    operationId = operation.operationId;
    if (operation.isReplay) {
      clearTimeout(timeout);
      await releaseQuota();
      return createErrorResponse("resultConfirming");
    }

    const messages = buildAssistantMessages({
      context: {
        locale: payload.locale,
        pathname: payload.pathname,
        role,
      },
      history: payload.history,
      message: payload.message,
    });
    const stream = await createDeepSeekAssistantTextStream({
      messages,
      onCompleted: async (contentLength) => {
        await finishServerOperationRun({
          operationId: operation.operationId,
          outcome: "succeeded",
          proof: { completed: true, contentLength },
        });
      },
      onFailed: async (code) => {
        await finishServerOperationRun({
          errorCode: "ai_stream_failed",
          errorMessage: code,
          operationId: operation.operationId,
          outcome: "failed",
        });
      },
      onSettled: () => {
        clearTimeout(timeout);
        void releaseQuota();
      },
      signal: controller.signal,
      userId,
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
    });
  } catch (error) {
    clearTimeout(timeout);
    await releaseQuota();

    if (operationId) {
      try {
        await finishServerOperationRun({
          errorCode: "ai_request_failed",
          errorMessage: "智能助手没有生成完整回答。",
          operationId,
          outcome: "failed",
        });
      } catch {
        // 账本回写失败时仍返回不可用，不能把缺少完成凭证的请求包装成成功。
      }
    }

    if (error instanceof AiAssistantServiceError) {
      return createErrorResponse("serviceUnavailable");
    }

    return createErrorResponse("serviceUnavailable");
  }
}

async function buildSettlementResponse(
  supabase: Awaited<ReturnType<typeof getServerSupabaseClient>>,
  message: string,
  role: Awaited<ReturnType<typeof getServerAuthContext>>["role"],
) {
  const parsed = parseSettlementReleaseCommand(message);

  if (parsed.kind === "notCommand") {
    return null;
  }

  if (parsed.kind === "guidance") {
    return NextResponse.json<AiAssistantStructuredResponse>({
      code: parsed.code,
      kind: "settlementReleaseGuidance",
    });
  }

  if (role !== "administrator" && role !== "finance") {
    return NextResponse.json<AiAssistantStructuredResponse>({
      code: "notAllowed",
      kind: "settlementReleaseGuidance",
    });
  }

  try {
    const confirmation = await buildSettlementReleaseConfirmation(
      supabase,
      parsed.value,
    );

    if (confirmation.kind === "ambiguousCustomer") {
      return NextResponse.json<AiAssistantStructuredResponse>({
        code: "ambiguousCustomer",
        kind: "settlementReleaseGuidance",
      });
    }

    return NextResponse.json<AiAssistantStructuredResponse>({
      action: confirmation.action,
      kind: "settlementReleaseConfirmation",
    });
  } catch (error) {
    if (error instanceof SettlementReleaseServiceError) {
      return createErrorResponse("serviceUnavailable");
    }

    return createErrorResponse("serviceUnavailable");
  }
}

type NormalizedAssistantPayload = {
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

function createErrorResponse(
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
