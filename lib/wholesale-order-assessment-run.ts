import type { SupabaseClient } from "@supabase/supabase-js";

import { createDeepSeekAssistantTextStream } from "./ai-assistant/deepseek-client";
import { acquireApiRequestQuota, releaseApiRequestQuota } from "./api-request-quota";
import { createServerOperationRun, finishServerOperationRun } from "./server-operation-runs";
import { buildWholesaleOrderAssessmentMessages } from "./wholesale-order-assessment-messages";
import type { WholesaleOrderAssessmentFilters } from "./wholesale-order-assessment-types";
import { getWholesalePageData } from "./wholesale";

const ASSESSMENT_TIMEOUT_MS = 30_000;

type AssessmentResult =
  | { kind: "stream"; body: ReadableStream<Uint8Array> }
  | { kind: "limited"; retryAfterSeconds: number }
  | { kind: "forbidden" | "empty" | "replay" | "failed" };

/**
 * 只有授权且有订单时才登记生成。响应中的完成事件必须等账本确认，才能发给页面。
 */
export async function startWholesaleOrderAssessment({
  filters,
  requestId,
  supabase,
  userId,
}: {
  filters: WholesaleOrderAssessmentFilters;
  requestId: string;
  supabase: SupabaseClient;
  userId: string;
}): Promise<AssessmentResult> {
  let releaseQuota: (() => Promise<void>) | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let operationId: string | undefined;
  let streamOwnsCleanup = false;

  try {
    const quota = await acquireApiRequestQuota(supabase, "ai");
    if (!quota.allowed) {
      return { kind: "limited", retryAfterSeconds: quota.retryAfterSeconds };
    }
    releaseQuota = () => releaseApiRequestQuota(supabase, quota.leaseId);

    // 同一个分页函数决定列表和评估的范围、时区与内部字段权限。
    const data = await getWholesalePageData(supabase, "orders", {
      orderFilters: filters,
      orderSampleSize: 100,
    });
    if (!data.orderPage) return { kind: "failed" };
    if (!data.orderPage.canViewInternalFields) return { kind: "forbidden" };
    if (data.orders.length === 0) return { kind: "empty" };

    const operation = await createServerOperationRun({
      idempotencyKey: requestId,
      operationKey: "ai-order-assessment",
      requestPayload: { kind: "wholesale-order-assessment" },
      requestedByUserId: userId,
    });
    // 重复请求已有运行记录，本次不能开始生成或改变那条记录。
    if (operation.isReplay) return { kind: "replay" };
    operationId = operation.operationId;

    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), ASSESSMENT_TIMEOUT_MS);
    const body = await createDeepSeekAssistantTextStream({
      messages: buildWholesaleOrderAssessmentMessages({ data, filters, orders: data.orders }),
      onCompleted: (contentLength) =>
        finishServerOperationRun({
          operationId: operation.operationId,
          outcome: "succeeded",
          proof: { completed: true, contentLength },
        }),
      onFailed: (code) =>
        finishServerOperationRun({
          errorCode: "ai_assessment_stream_failed",
          errorMessage: code,
          operationId: operation.operationId,
          outcome: "failed",
        }),
      onSettled: () => {
        clearTimeout(timeout);
        void releaseQuota?.();
      },
      signal: controller.signal,
      userId,
    });
    streamOwnsCleanup = true;
    return { kind: "stream", body };
  } catch {
    if (operationId) {
      try {
        await finishServerOperationRun({
          errorCode: "ai_assessment_failed",
          errorMessage: "订单评估没有生成完整结果。",
          operationId,
          outcome: "failed",
        });
      } catch {
        console.error("Wholesale order assessment failure was not recorded", { operationId });
      }
    }
    return { kind: "failed" };
  } finally {
    // 流返回前失败由本函数清理。流已开始时，清理由流的完成或取消回调执行。
    if (!streamOwnsCleanup) {
      clearTimeout(timeout);
      await releaseQuota?.();
    }
  }
}
