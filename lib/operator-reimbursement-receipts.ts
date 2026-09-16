import type { OperatorReimbursementBatchResult } from "./operator-reimbursements-types";

/**
 * 周期报销必须返回同一周期、正数影响行数和可核对金额。
 * 0 行表示没有发生写入，即使 RPC 没报错也不能关闭弹窗或显示成功。
 */
export function requireOperatorReimbursementBatchReceipt(
  value: unknown,
  expectedPeriodStart: string,
): OperatorReimbursementBatchResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("报销操作没有返回可确认的结果。");
  }

  const receipt = value as Record<string, unknown>;
  const updatedCount = Number(receipt.updated_count);
  const reimbursedTotal = Number(receipt.reimbursed_total);
  if (
    receipt.period_start !== expectedPeriodStart ||
    typeof receipt.period_end !== "string" ||
    !receipt.period_end ||
    !Number.isInteger(updatedCount) ||
    updatedCount <= 0 ||
    !Number.isFinite(reimbursedTotal) ||
    reimbursedTotal <= 0
  ) {
    throw new Error("所选周期没有确认完成报销，请刷新后核对。");
  }

  return {
    periodEnd: receipt.period_end,
    periodStart: receipt.period_start,
    reimbursedTotal,
    updatedCount,
  };
}
