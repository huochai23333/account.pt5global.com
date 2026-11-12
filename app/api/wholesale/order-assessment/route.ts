import { NextResponse } from "next/server";

import { getServerAuthContext } from "@/lib/server-auth";
import { readLimitedJsonBody, RequestBodyTooLargeError } from "@/lib/server-request-body";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { normalizeWholesaleOrderAssessmentPayload } from "@/lib/wholesale-order-assessment";
import { startWholesaleOrderAssessment } from "@/lib/wholesale-order-assessment-run";
import { getCurrentWorkspaceBusinessAccess } from "@/lib/workspace-business-access";

export const runtime = "nodejs";

const MAX_ASSESSMENT_BODY_BYTES = 64 * 1024;

export async function POST(request: Request) {
  const { status, userId } = await getServerAuthContext();
  if (!userId || status !== "active") {
    return createErrorResponse("请先登录后再生成评估。", 401);
  }

  let filters: ReturnType<typeof normalizeWholesaleOrderAssessmentPayload>;
  let requestId: string;
  try {
    const payload = await readLimitedJsonBody(request, MAX_ASSESSMENT_BODY_BYTES);
    filters = normalizeWholesaleOrderAssessmentPayload(payload);
    requestId = readRequestId(payload);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return createErrorResponse("提交的筛选内容太多，请减少后再试。", 413);
    }
    return createErrorResponse("筛选条件暂时无法识别，请调整后重试。", 400);
  }

  const supabase = await getServerSupabaseClient();
  const businessAccess = await getCurrentWorkspaceBusinessAccess(supabase);
  // 业务入口权限在这里检查，内部订单字段权限由评估流程查询数据库后判断。
  if (!businessAccess.includes("wholesale")) {
    return createErrorResponse("当前账号不能查看批发业务订单。", 403);
  }

  const result = await startWholesaleOrderAssessment({ filters, requestId, supabase, userId });
  switch (result.kind) {
    case "stream":
      return new Response(result.body, {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/x-ndjson; charset=utf-8",
        },
      });
    case "forbidden":
      return createErrorResponse("当前账号不能使用订单评估。", 403);
    case "empty":
      return createErrorResponse("当前范围没有可评估的订单，请调整筛选条件。", 400);
    case "limited":
      return createErrorResponse("操作有些频繁，请稍后再生成评估。", 429, result.retryAfterSeconds);
    case "replay":
      return createErrorResponse("上一次评估结果仍在确认中，请稍后再生成。", 409);
    case "failed":
      return createErrorResponse("评估暂时没有生成成功，请稍后再试。", 503);
  }
}

function readRequestId(value: unknown) {
  if (!value || typeof value !== "object" || !("requestId" in value)) {
    throw new Error("missing request id");
  }
  const requestId = String(value.requestId ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{16,120}$/.test(requestId)) {
    throw new Error("invalid request id");
  }
  return requestId;
}

function createErrorResponse(message: string, status: number, retryAfterSeconds?: number) {
  return NextResponse.json(
    { message },
    {
      headers: retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : undefined,
      status,
    },
  );
}
