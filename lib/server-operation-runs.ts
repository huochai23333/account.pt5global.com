import { getSupabaseServiceRoleClient } from "./supabase-admin-server";

/** Node.js 路由使用服务角色写运行账本，但只保存计数和摘要，不保存用户问题或 AI 正文。 */
export async function createServerOperationRun(options: {
  idempotencyKey: string;
  operationKey: string;
  requestPayload: Record<string, unknown>;
  requestedByUserId: string;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("create_service_operation_run", {
    p_idempotency_key: options.idempotencyKey,
    p_operation_key: options.operationKey,
    p_request_payload: options.requestPayload,
    p_requested_by_user_id: options.requestedByUserId,
    p_trigger_source: "manual",
  });
  if (error) throw error;
  if (!isRecord(data) || typeof data.operationId !== "string") {
    throw new Error("server_operation_run_invalid");
  }
  return {
    attemptNumber: 1,
    isReplay: data.isReplay === true,
    operationId: data.operationId,
    status: typeof data.status === "string" ? data.status : "running",
  };
}

export async function finishServerOperationRun(options: {
  attemptNumber?: number;
  errorCode?: string;
  errorMessage?: string;
  operationId: string;
  outcome: "succeeded" | "failed";
  proof?: Record<string, unknown>;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const succeeded = options.outcome === "succeeded";
  const { data, error } = await supabase.rpc("finish_operation_attempt_checked", {
    p_attempt_number: options.attemptNumber ?? 1,
    p_error_code: options.errorCode ?? null,
    p_error_message: options.errorMessage ?? null,
    p_expected_count: 1,
    p_failed_count: succeeded ? 0 : 1,
    p_operation_id: options.operationId,
    p_outcome: options.outcome,
    p_result_proof: options.proof ?? {},
    p_succeeded_count: succeeded ? 1 : 0,
  });
  if (error) throw error;
  const expectedStatuses = succeeded ? ["succeeded"] : ["failed", "needs_attention"];
  if (!isRecord(data) || !expectedStatuses.includes(String(data.status))) {
    throw new Error("server_operation_finish_invalid");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
