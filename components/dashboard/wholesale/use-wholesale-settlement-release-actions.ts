"use client";

import { useCallback } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase";
import { requireMutationId, requireMutationRecord } from "@/lib/mutation-receipts";
import { parseOperationRequestReceipt, waitForOperationTerminal } from "@/lib/operation-runs";

import {
  optionalString,
  positiveNumber,
  requiredString,
} from "./wholesale-action-utils";
import { useWholesaleActionRunner } from "./use-wholesale-action-runner";

export type SettlementReleaseAllocationSubmission = {
  allocations: Array<{ amount: number; order_id: string }>;
  customerId: string;
  expectedRevision: number;
  releaseId: string;
};

export function useWholesaleSettlementReleaseActions() {
  // 结汇发布与批发页面使用同一个成功契约，避免这里再次维护一套容易走偏的反馈逻辑。
  const { feedback, pendingKey, runAction } = useWholesaleActionRunner();

  const createRelease = useCallback(
    (formData: FormData) =>
      runAction("settlement-release:create", "结汇收款已发布。", async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        const { data, error } = await supabase.rpc(
          "create_wholesale_settlement_release",
          {
            p_customer_id: optionalString(formData.get("customer_id")),
            p_customer_name: optionalString(formData.get("customer_name")),
            p_note: optionalString(formData.get("note")),
            p_received_on: requiredString(formData.get("received_on")),
            p_release_amount: positiveNumber(formData.get("release_amount")),
            p_release_currency: requiredString(formData.get("release_currency")),
          },
        );

        if (error) throw error;
        requireMutationId(data, "结汇收款没有返回发布编号。");
      }),
    [runAction],
  );

  const cancelRelease = useCallback(
    (releaseId: string) =>
      runAction(
        `settlement-release:cancel:${releaseId}`,
        "这条结汇收款已取消。",
        async () => {
          const supabase = getBrowserSupabaseClient();
          if (!supabase) throw new Error("client unavailable");

          const { data, error } = await supabase.rpc(
            "cancel_wholesale_settlement_release",
            {
              p_release_id: releaseId,
            },
          );

          if (error) throw error;
          if (requireMutationId(data, "结汇收款没有确认取消。") !== releaseId) {
            throw new Error("取消结果与当前收款不一致。");
          }
        },
      ),
    [runAction],
  );

  const saveAllocations = useCallback(
    (submission: SettlementReleaseAllocationSubmission) => {
      return runAction(
        `settlement-release:allocate:${submission.releaseId}`,
        "结汇收款分配已保存。",
        async () => {
          const supabase = getBrowserSupabaseClient();
          if (!supabase) throw new Error("client unavailable");

          let result = await saveSettlementAllocations(supabase, submission);
          if (result.error && isMissingSettlementRate(result.error)) {
            const { data: repairData, error: repairError } = await supabase.rpc(
              "request_settlement_exchange_rate_repair",
              { p_release_id: submission.releaseId },
            );
            if (repairError) throw repairError;
            const repairReceipt = parseOperationRequestReceipt(repairData);
            const repairResult = await waitForOperationTerminal(
              supabase,
              repairReceipt.operationId,
            );
            if (repairResult.kind === "confirming") {
              throw new Error("这天的汇率正在自动补齐，结果仍在确认中，请稍后再保存。");
            }
            result = await saveSettlementAllocations(supabase, submission);
          }

          if (result.error) throw result.error;
          const data = result.data;
          const receipt = requireMutationRecord(data, "结汇分配没有返回保存结果。");
          if (
            receipt.release_id !== submission.releaseId ||
            (receipt.status !== "allocated" && receipt.status !== "partially_allocated") ||
            typeof receipt.allocation_revision !== "number"
          ) {
            throw new Error("结汇分配的保存结果不完整，请刷新后核对。");
          }
        },
      );
    },
    [runAction],
  );

  const clearAllocations = useCallback(
    (releaseId: string, expectedRevision: number) =>
      runAction(
        `settlement-release:clear:${releaseId}`,
        "这笔收款的订单分配已清空。",
        async () => {
          const supabase = getBrowserSupabaseClient();
          if (!supabase) throw new Error("client unavailable");

          const { data, error } = await supabase.rpc(
            "clear_wholesale_settlement_release_allocations",
            {
              p_expected_revision: expectedRevision,
              p_release_id: releaseId,
            },
          );

          if (error) throw error;
          const receipt = requireMutationRecord(data, "结汇分配没有确认清空。");
          if (receipt.release_id !== releaseId || receipt.status !== "pending") {
            throw new Error("清空结果与当前收款不一致，请刷新后核对。");
          }
        },
      ),
    [runAction],
  );

  return {
    cancelRelease,
    clearAllocations,
    createRelease,
    feedback,
    pendingKey,
    saveAllocations,
  };
}

function saveSettlementAllocations(
  supabase: NonNullable<ReturnType<typeof getBrowserSupabaseClient>>,
  submission: SettlementReleaseAllocationSubmission,
) {
  // verified-rpc: 调用方读取并校验返回的 release_id、status 与 revision。
  return supabase.rpc("replace_wholesale_settlement_release_allocations", {
    p_allocations: submission.allocations,
    p_customer_id: submission.customerId,
    p_expected_revision: submission.expectedRevision,
    p_release_id: submission.releaseId,
  });
}

function isMissingSettlementRate(error: unknown) {
  return typeof error === "object" && error !== null && "message" in error &&
    String(error.message).includes("wholesale_order_settlement_rate_missing");
}
