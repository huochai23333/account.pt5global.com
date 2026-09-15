import type { SupabaseClient } from "@supabase/supabase-js";

export const OPERATION_TERMINAL_STATUSES = [
  "succeeded",
  "partial_failed",
  "failed",
  "needs_attention",
  "skipped",
] as const;

export type OperationTerminalStatus =
  (typeof OPERATION_TERMINAL_STATUSES)[number];
export type OperationStatus =
  | "queued"
  | "running"
  | OperationTerminalStatus;

export type OperationRun = {
  operationId: string;
  operationKey: string;
  status: OperationStatus;
  attemptCount: number;
  expectedCount: number | null;
  succeededCount: number;
  failedCount: number;
  resultProof: Record<string, unknown>;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  nextAttemptAt: string | null;
};

export type OperationRequestReceipt = {
  operationId: string;
  status: OperationStatus;
  transportRequestId: number | null;
};

const STATUS_SET = new Set<string>([
  "queued",
  "running",
  ...OPERATION_TERMINAL_STATUSES,
]);

/**
 * 后台请求的 HTTP 状态只能证明“请求已经送达”，不能证明业务完成。
 * 这里强制校验运行编号和状态，避免调用方把任意 JSON 或 pg_net 编号当成成功回执。
 */
export function parseOperationRequestReceipt(value: unknown): OperationRequestReceipt {
  if (!isRecord(value)) throw new Error("operation_receipt_invalid");
  const operationId = readRequiredString(value.operationId);
  const status = readOperationStatus(value.status);
  const transportRequestId = typeof value.transportRequestId === "number"
    ? value.transportRequestId
    : null;

  return { operationId, status, transportRequestId };
}

export async function getOperationRun(
  supabase: SupabaseClient,
  operationId: string,
): Promise<OperationRun> {
  const { data, error } = await supabase.rpc("get_operation_run", {
    p_operation_id: operationId,
  });
  if (error) throw error;
  return parseOperationRun(data);
}

export async function waitForOperationTerminal(
  supabase: SupabaseClient,
  operationId: string,
  options: { pollIntervalMs?: number; timeoutMs?: number } = {},
) {
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  const timeoutMs = options.timeoutMs ?? 90_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const run = await getOperationRun(supabase, operationId);
    if (OPERATION_TERMINAL_STATUSES.includes(run.status as OperationTerminalStatus)) {
      return { kind: "terminal" as const, run };
    }
    await new Promise((resolve) => window.setTimeout(resolve, pollIntervalMs));
  }

  // 超时是“结果尚未确认”，不是失败；调用方应保留 operationId 供用户继续查看。
  return {
    kind: "confirming" as const,
    run: await getOperationRun(supabase, operationId),
  };
}

/**
 * “已经到终态”不等于成功：partial_failed、failed、needs_attention 和 skipped
 * 都必须保留各自业务含义。调用方只有拿到完成时间、0 个失败项，并确认成功数量
 * 与预期数量一致时，才能继续依赖这次后台结果执行下一项写操作。
 */
export function requireSucceededOperationRun(
  run: OperationRun,
  errorMessage = "后台处理没有确认全部完成。",
) {
  if (
    run.status !== "succeeded"
    || !run.completedAt
    || run.failedCount !== 0
    || (
      run.expectedCount !== null
      && run.succeededCount !== run.expectedCount
    )
  ) {
    throw new Error(errorMessage);
  }

  return run;
}

function parseOperationRun(value: unknown): OperationRun {
  if (!isRecord(value)) throw new Error("operation_run_invalid");

  return {
    operationId: readRequiredString(value.operationId),
    operationKey: readRequiredString(value.operationKey),
    status: readOperationStatus(value.status),
    attemptCount: readNumber(value.attemptCount),
    expectedCount: value.expectedCount === null ? null : readNumber(value.expectedCount),
    succeededCount: readNumber(value.succeededCount),
    failedCount: readNumber(value.failedCount),
    resultProof: isRecord(value.resultProof) ? value.resultProof : {},
    lastErrorCode: readOptionalString(value.lastErrorCode),
    lastErrorMessage: readOptionalString(value.lastErrorMessage),
    createdAt: readRequiredString(value.createdAt),
    completedAt: readOptionalString(value.completedAt),
    nextAttemptAt: readOptionalString(value.nextAttemptAt),
  };
}

function readOperationStatus(value: unknown): OperationStatus {
  const status = readRequiredString(value);
  if (!STATUS_SET.has(status)) throw new Error("operation_status_invalid");
  return status as OperationStatus;
}

function readRequiredString(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("operation_value_invalid");
  }
  return value;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error("operation_number_invalid");
  return number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
