"use client";

import { useMemo, useState } from "react";

import type {
  WholesaleOrder,
  WholesaleOrderSettlement,
} from "@/lib/wholesale";
import type {
  WholesaleSettlementRelease,
  WholesaleSettlementReleaseAllocation,
} from "@/lib/wholesale-settlement-releases";

const AMOUNT_TOLERANCE = 0.005;

export type SettlementReleaseAllocationCandidate = {
  allocatedAmount: number;
  allocationInput: string;
  availableAmount: number;
  error: "exceeds_available" | "invalid" | null;
  order: WholesaleOrder;
};

type AllocationFormInput = {
  allocations: WholesaleSettlementReleaseAllocation[];
  orderSettlements: WholesaleOrderSettlement[];
  orders: WholesaleOrder[];
  release: WholesaleSettlementRelease;
};

/**
 * 分配弹窗的金额计算、自动建议和输入校验集中在这个 hook 中。
 * 弹窗组件只负责摆放控件，避免以后修改业务规则时还要穿过大量 JSX。
 */
export function useWholesaleSettlementReleaseAllocationForm({
  allocations,
  orderSettlements,
  orders,
  release,
}: AllocationFormInput) {
  const activeAllocations = useMemo(
    () =>
      allocations.filter(
        (allocation) =>
          allocation.release_id === release.id && allocation.status === "active",
      ),
    [allocations, release.id],
  );
  const initialCustomerId =
    release.customer_id ?? release.allocation_customer_id ?? "";
  const [customerId, setCustomerIdState] = useState(initialCustomerId);
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>(
    () => {
      if (activeAllocations.length > 0) {
        return Object.fromEntries(
          activeAllocations.map((allocation) => [
            allocation.order_id,
            formatEditableAmount(allocation.allocation_amount),
          ]),
        );
      }

      // 第一次处理时直接给出“最早订单优先”的草稿，用户仍可逐笔改金额或清空。
      return buildSuggestedInputs({
        customerId: initialCustomerId,
        orders,
        otherSettledAmountByOrderId: buildOtherSettledAmountByOrderId(
          orderSettlements,
          release.id,
        ),
        release,
      });
    },
  );
  const [searchText, setSearchText] = useState("");

  const otherSettledAmountByOrderId = useMemo(() => {
    return buildOtherSettledAmountByOrderId(orderSettlements, release.id);
  }, [orderSettlements, release.id]);

  const candidates = useMemo(
    () =>
      buildCandidates({
        amountInputs,
        customerId,
        orders,
        otherSettledAmountByOrderId,
        release,
      }),
    [amountInputs, customerId, orders, otherSettledAmountByOrderId, release],
  );
  const visibleCandidates = useMemo(() => {
    const normalizedSearch = searchText.trim().toLocaleLowerCase();
    if (!normalizedSearch) return candidates;

    return candidates.filter((candidate) =>
      candidate.order.order_number
        .toLocaleLowerCase()
        .includes(normalizedSearch),
    );
  }, [candidates, searchText]);
  const allocatedAmount = roundAmount(
    candidates.reduce(
      (sum, candidate) => sum + candidate.allocatedAmount,
      0,
    ),
  );
  const remainingAmount = Math.max(
    roundAmount(Number(release.release_amount) - allocatedAmount),
    0,
  );
  const hasRowError = candidates.some((candidate) => candidate.error);
  const exceedsReleaseAmount =
    allocatedAmount - Number(release.release_amount) > AMOUNT_TOLERANCE;
  const canSubmit =
    Boolean(customerId) &&
    allocatedAmount > 0 &&
    !hasRowError &&
    !exceedsReleaseAmount;

  function setCustomerId(nextCustomerId: string) {
    setCustomerIdState(nextCustomerId);
    setSearchText("");
    // 手填名称的收款允许改成正式客户。客户变化后旧订单不再属于新客户，必须先清空草稿。
    setAmountInputs(
      buildSuggestedInputs({
        customerId: nextCustomerId,
        orders,
        otherSettledAmountByOrderId,
        release,
      }),
    );
  }

  function setAllocationAmount(orderId: string, value: string) {
    setAmountInputs((current) => ({ ...current, [orderId]: value }));
  }

  function fillSuggestion() {
    setAmountInputs(
      buildSuggestedInputs({
        customerId,
        orders,
        otherSettledAmountByOrderId,
        release,
      }),
    );
  }

  return {
    allocatedAmount,
    canSubmit,
    candidates,
    customerId,
    exceedsReleaseAmount,
    fillSuggestion,
    activeAllocationIds: activeAllocations.map((allocation) => allocation.id),
    remainingAmount,
    searchText,
    setAllocationAmount,
    setCustomerId,
    setSearchText,
    submissionAllocations: candidates
      .filter((candidate) => candidate.allocatedAmount > 0)
      .map((candidate) => ({
        amount: candidate.allocatedAmount,
        order_id: candidate.order.id,
      })),
    visibleCandidates,
  };
}

function buildCandidates({
  amountInputs,
  customerId,
  orders,
  otherSettledAmountByOrderId,
  release,
}: {
  amountInputs: Record<string, string>;
  customerId: string;
  orders: WholesaleOrder[];
  otherSettledAmountByOrderId: Map<string, number>;
  release: WholesaleSettlementRelease;
}) {
  return orders
    .filter(
      (order) =>
        order.customer_id === customerId &&
        order.customer_payment_currency === release.release_currency,
    )
    .map((order): SettlementReleaseAllocationCandidate => {
      const availableAmount = Math.max(
        roundAmount(
          Number(order.customer_payment_amount) -
            (otherSettledAmountByOrderId.get(order.id) ?? 0),
        ),
        0,
      );
      const allocationInput = amountInputs[order.id] ?? "";
      const parsedAmount = Number(allocationInput);
      const allocatedAmount =
        allocationInput.trim() && Number.isFinite(parsedAmount)
          ? roundAmount(parsedAmount)
          : 0;
      let error: SettlementReleaseAllocationCandidate["error"] = null;

      if (
        allocationInput.trim() &&
        (!Number.isFinite(parsedAmount) || parsedAmount < 0)
      ) {
        error = "invalid";
      } else if (allocatedAmount - availableAmount > AMOUNT_TOLERANCE) {
        error = "exceeds_available";
      }

      return {
        allocatedAmount,
        allocationInput,
        availableAmount,
        error,
        order,
      };
    })
    .filter(
      (candidate) =>
        candidate.availableAmount > AMOUNT_TOLERANCE ||
        Boolean(candidate.allocationInput.trim()),
    )
    .sort((left, right) => {
      // 系统建议按最早下单的订单优先；时间相同再按订单号排序，结果始终稳定。
      const timeDifference =
        getSafeTimestamp(left.order.ordered_at) -
        getSafeTimestamp(right.order.ordered_at);
      return (
        timeDifference ||
        left.order.order_number.localeCompare(right.order.order_number)
      );
    });
}

function buildSuggestedInputs({
  customerId,
  orders,
  otherSettledAmountByOrderId,
  release,
}: {
  customerId: string;
  orders: WholesaleOrder[];
  otherSettledAmountByOrderId: Map<string, number>;
  release: WholesaleSettlementRelease;
}) {
  const candidates = buildCandidates({
    amountInputs: {},
    customerId,
    orders,
    otherSettledAmountByOrderId,
    release,
  });
  const suggestion: Record<string, string> = {};
  let amountToAllocate = Number(release.release_amount);

  for (const candidate of candidates) {
    if (amountToAllocate <= AMOUNT_TOLERANCE) break;
    const suggestedAmount = Math.min(
      candidate.availableAmount,
      amountToAllocate,
    );
    suggestion[candidate.order.id] = formatEditableAmount(suggestedAmount);
    amountToAllocate = roundAmount(amountToAllocate - suggestedAmount);
  }

  return suggestion;
}

function buildOtherSettledAmountByOrderId(
  orderSettlements: WholesaleOrderSettlement[],
  releaseId: string,
) {
  const totals = new Map<string, number>();

  for (const settlement of orderSettlements) {
    // 当前收款生成的结汇记录会被本次方案整体替换，所以不能从订单可分配余额里重复扣除。
    if (settlement.source_settlement_release_id === releaseId) continue;
    totals.set(
      settlement.order_id,
      (totals.get(settlement.order_id) ?? 0) +
        Number(settlement.settlement_amount ?? 0),
    );
  }

  return totals;
}

function formatEditableAmount(value: number) {
  return roundAmount(Number(value)).toFixed(2);
}

function roundAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getSafeTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}
