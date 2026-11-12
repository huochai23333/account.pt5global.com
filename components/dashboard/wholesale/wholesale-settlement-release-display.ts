import type {
  WholesaleOrder,
  WholesaleOrderSettlement,
  WholesaleProfile,
} from "@/lib/wholesale";
import type {
  WholesaleSettlementRelease,
  WholesaleSettlementReleaseAllocation,
  WholesaleSettlementReleaseStatus,
} from "@/lib/wholesale-settlement-releases";

import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getProfileName,
} from "./wholesale-display";

// 枚举供筛选与列表共享，界面标签随当前语言从词典读取。
export const WHOLESALE_SETTLEMENT_RELEASE_STATUSES = [
  "allocated", "cancelled", "partially_allocated", "pending",
] as const satisfies readonly WholesaleSettlementReleaseStatus[];

export function getSettlementReleaseStatusTone(
  status: WholesaleSettlementReleaseStatus,
): "danger" | "success" | "warning" {
  if (status === "allocated") return "success";
  if (status === "cancelled") return "danger";
  return "warning";
}

export function getActiveSettlementReleaseAllocations(
  releaseId: string,
  allocationsByReleaseId: Map<string, WholesaleSettlementReleaseAllocation[]>,
) {
  return (allocationsByReleaseId.get(releaseId) ?? []).filter(
    (allocation) => allocation.status === "active",
  );
}

export function getSettlementReleaseAllocatedAmount(
  releaseId: string,
  allocationsByReleaseId: Map<string, WholesaleSettlementReleaseAllocation[]>,
) {
  return getActiveSettlementReleaseAllocations(
    releaseId,
    allocationsByReleaseId,
  ).reduce(
    (sum, allocation) => sum + Number(allocation.allocation_amount ?? 0),
    0,
  );
}

export function getSettlementReleaseRemainingAmount(
  release: WholesaleSettlementRelease,
  allocationsByReleaseId: Map<string, WholesaleSettlementReleaseAllocation[]>,
) {
  return Math.max(
    Number(release.release_amount ?? 0) -
      getSettlementReleaseAllocatedAmount(release.id, allocationsByReleaseId),
    0,
  );
}

export function getWholesaleOrderSettledAmount(
  orderId: string,
  orderSettlementsByOrderId: Map<string, WholesaleOrderSettlement[]>,
) {
  return (orderSettlementsByOrderId.get(orderId) ?? []).reduce(
    (sum, settlement) => sum + Number(settlement.settlement_amount ?? 0),
    0,
  );
}

export function getWholesaleOrderRemainingAmount(
  order: WholesaleOrder,
  orderSettlementsByOrderId: Map<string, WholesaleOrderSettlement[]>,
) {
  return Math.max(
    Number(order.customer_payment_amount ?? 0) -
      getWholesaleOrderSettledAmount(order.id, orderSettlementsByOrderId),
    0,
  );
}

export function getSettlementReleaseSearchText({
  allocationsByReleaseId,
  ordersById,
  profilesById,
  release,
  statusLabel,
}: {
  allocationsByReleaseId: Map<
    string,
    WholesaleSettlementReleaseAllocation[]
  >;
  ordersById: Map<string, WholesaleOrder>;
  profilesById: Map<string, WholesaleProfile>;
  release: WholesaleSettlementRelease;
  statusLabel: string;
}) {
  const allocations = allocationsByReleaseId.get(release.id) ?? [];

  return [
    release.customer_name,
    release.release_currency,
    release.note ?? "",
    statusLabel,
    ...allocations.map(
      (allocation) => ordersById.get(allocation.order_id)?.order_number ?? "",
    ),
    getProfileName(profilesById, release.published_by_user_id),
    ...allocations.flatMap((allocation) => [
      getProfileName(profilesById, allocation.created_by_user_id),
      getProfileName(profilesById, allocation.reversed_by_user_id),
    ]),
  ].join(" ");
}

export function formatSettlementReleaseSummary(
  release: WholesaleSettlementRelease,
) {
  return `${release.customer_name} / ${formatCurrency(
    release.release_amount,
    release.release_currency,
  )} / ${formatDate(release.received_on)}`;
}

export function formatSettlementReleaseHandledAt(
  release: WholesaleSettlementRelease,
  allocations: WholesaleSettlementReleaseAllocation[],
  awaitingLabel: string,
) {
  if (release.status === "cancelled") {
    return formatDateTime(release.cancelled_at);
  }

  const latestAllocation = getLatestSettlementReleaseAllocationEvent(allocations);

  if (latestAllocation) {
    return formatDateTime(
      latestAllocation.status === "reversed" && latestAllocation.reversed_at
        ? latestAllocation.reversed_at
        : latestAllocation.created_at,
    );
  }

  return awaitingLabel;
}

export function getSettlementReleaseLatestActorId(
  allocations: WholesaleSettlementReleaseAllocation[],
) {
  const latestAllocation = getLatestSettlementReleaseAllocationEvent(allocations);
  if (!latestAllocation) return null;

  return latestAllocation.status === "reversed"
    ? latestAllocation.reversed_by_user_id
    : latestAllocation.created_by_user_id;
}

function getLatestSettlementReleaseAllocationEvent(
  allocations: WholesaleSettlementReleaseAllocation[],
) {
  return [...allocations].sort((left, right) => {
    const leftTime = left.reversed_at ?? left.created_at;
    const rightTime = right.reversed_at ?? right.created_at;
    return rightTime.localeCompare(leftTime);
  })[0];
}
