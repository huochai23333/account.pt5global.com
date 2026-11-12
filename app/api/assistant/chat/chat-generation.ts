import { buildAssistantMessages } from "@/lib/ai-assistant/assistant-prompt";
import { createDeepSeekAssistantTextStream } from "@/lib/ai-assistant/deepseek-client";
import { acquireApiRequestQuota, releaseApiRequestQuota } from "@/lib/api-request-quota";
import type { getServerAuthContext } from "@/lib/server-auth";
import { createServerOperationRun, finishServerOperationRun } from "@/lib/server-operation-runs";
import type { getServerSupabaseClient } from "@/lib/supabase-server";

import { createErrorResponse } from "./chat-error-response";
import type { NormalizedAssistantPayload } from "./chat-input";

const ASSISTANT_TIMEOUT_MS = 20_000;

export async function startAssistantGeneration({
  payload,
  requestSignal,
  role,
  supabase,
  userId,
}: {
  payload: NormalizedAssistantPayload;
  requestSignal: AbortSignal;
  role: Awaited<ReturnType<typeof getServerAuthContext>>["role"];
  supabase: Awaited<ReturnType<typeof getServerSupabaseClient>>;
  userId: string;
}) {
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
  const timeout = setTimeout(() => {
    controller.abort(new DOMException("Provider request timed out", "TimeoutError"));
  }, ASSISTANT_TIMEOUT_MS);
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
    // 浏览器断开或到达时限都会停止供应商请求，账本回写仍独立完成。
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
        return releaseQuota();
      },
      signal: AbortSignal.any([requestSignal, controller.signal]),
      userId,
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
    });
  } catch {
    clearTimeout(timeout);

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

    await releaseQuota();
    return createErrorResponse("serviceUnavailable");
  }
}
