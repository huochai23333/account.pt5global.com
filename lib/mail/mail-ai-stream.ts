import type { ChatCompletionMessageParam } from "@/lib/ai-assistant/deepseek-client";
import { createDeepSeekAssistantTextStream } from "@/lib/ai-assistant/deepseek-client";
import { acquireApiRequestQuota, releaseApiRequestQuota } from "@/lib/api-request-quota";
import { createServerOperationRun, finishServerOperationRun } from "@/lib/server-operation-runs";
import type { getServerSupabaseClient } from "@/lib/supabase-server";

/** AI 结果只有在正文非空、流完整结束且运行账本落库后才会对页面显示完成。 */
export async function createMailAiStream(input: {
  messages: ChatCompletionMessageParam[];
  operationKey: string;
  requestId: string;
  requestPayload: Record<string, unknown>;
  supabase: Awaited<ReturnType<typeof getServerSupabaseClient>>;
  userId: string;
}) {
  const quota = await acquireApiRequestQuota(input.supabase, "ai");
  if (!quota.allowed) throw new Error(`请求较多，请在 ${quota.retryAfterSeconds} 秒后重试。`);
  let leaseId = quota.leaseId;
  const release = async () => {
    const current = leaseId;
    leaseId = null;
    await releaseApiRequestQuota(input.supabase, current);
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const operation = await createServerOperationRun({
      idempotencyKey: input.requestId,
      operationKey: input.operationKey,
      requestPayload: input.requestPayload,
      requestedByUserId: input.userId,
    });
    if (operation.isReplay) throw new Error("这次生成仍在确认结果，请稍后刷新。");
    const stream = await createDeepSeekAssistantTextStream({
      messages: input.messages,
      onCompleted: async (contentLength) => {
        if (contentLength <= 0) throw new Error("ai_empty_content");
        await finishServerOperationRun({
          operationId: operation.operationId,
          outcome: "succeeded",
          proof: { completed: true, contentLength },
        });
      },
      onFailed: async (code) => {
        await finishServerOperationRun({
          operationId: operation.operationId,
          outcome: "failed",
          errorCode: "mail_ai_stream_failed",
          errorMessage: code,
        });
      },
      onSettled: () => { clearTimeout(timeout); void release(); },
      signal: controller.signal,
      userId: input.userId,
    });
    return new Response(stream, {
      headers: { "cache-control": "no-store", "content-type": "application/x-ndjson; charset=utf-8" },
    });
  } catch (error) {
    clearTimeout(timeout);
    await release();
    throw error;
  }
}
