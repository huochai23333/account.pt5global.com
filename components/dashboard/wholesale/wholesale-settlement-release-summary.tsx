import {
  BadgeCheck,
  CircleDollarSign,
  Clock3,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type {
  MonthlySettlementAllocatedUsdSummary,
  MonthlySettlementUnallocatedSummary,
} from "@/lib/wholesale-settlement-release-summary";
import type {
  WholesaleSettlementRelease,
  WholesaleSettlementReleaseAllocation,
} from "@/lib/wholesale-settlement-releases";

import { formatCurrency } from "./wholesale-display";
import { WholesaleStatGrid } from "./wholesale-ui";

export function WholesaleSettlementReleaseSummary({
  allocations,
  monthlyAllocatedUsd,
  monthlyUnallocated,
  releases,
}: {
  allocations: WholesaleSettlementReleaseAllocation[];
  monthlyAllocatedUsd: MonthlySettlementAllocatedUsdSummary | null;
  monthlyUnallocated: MonthlySettlementUnallocatedSummary;
  releases: WholesaleSettlementRelease[];
}) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_settlement_release_section",
  );
  const waitingCount = releases.filter(
    (release) =>
      release.status === "pending" || release.status === "partially_allocated",
  ).length;
  const allocatedCount = releases.filter(
    (release) => release.status === "allocated",
  ).length;
  const monthlyUnavailable = monthlyAllocatedUsd?.missingRateCount
    ? uiText("statMonthlyMissingRates", {
        count: monthlyAllocatedUsd.missingRateCount,
      })
    : monthlyAllocatedUsd === null
      ? uiText("statMonthlyUnavailableHelp")
      : undefined;

  return (
    <WholesaleStatGrid
      // 断点与 Tailwind 默认值统一使用 rem，确保宽屏三列覆盖 sm 两列。
      // 多币种金额在单张卡内换行，避免撑宽页面。
      className="min-[85rem]:grid-cols-3 [&_[data-slot=metric-card]>div:last-child]:shrink [&_[data-slot=metric-card]>div:last-child]:whitespace-normal [&_[data-slot=metric-card]>div:last-child]:[overflow-wrap:anywhere]"
      stats={[
        {
          icon: <ReceiptText className="size-4" />,
          label: uiText("statRecords"),
          tone: "info",
          value: `${releases.length}`,
        },
        {
          icon: <Clock3 className="size-4" />,
          label: uiText("statWaiting"),
          tone: "warning",
          value: `${waitingCount}`,
        },
        {
          icon: <BadgeCheck className="size-4" />,
          label: uiText("statAllocated"),
          tone: "success",
          value: `${allocatedCount}`,
        },
        {
          icon: <CircleDollarSign className="size-4" />,
          label: uiText("statUnallocatedAmount"),
          tone: "warning",
          value: formatUnallocatedAmountSummary(
            releases,
            allocations,
            uiText("allAllocated"),
          ),
        },
        {
          icon: <CircleDollarSign className="size-4" />,
          label: uiText("statMonthlyUnallocatedAmount"),
          tone: "warning",
          value: monthlyUnallocated.amounts.length === 0
            ? uiText("allAllocated")
            : monthlyUnallocated.amounts
                .map(({ currency, amount }) => formatCurrency(amount, currency))
                .join(" / "),
        },
        {
          helper: monthlyUnavailable,
          icon: <WalletCards className="size-4" />,
          label: uiText("statMonthlyAllocatedUsd"),
          tone: monthlyUnavailable ? "warning" : "success",
          value:
            monthlyAllocatedUsd?.amountUsd === null ||
            monthlyAllocatedUsd === null
              ? uiText("statMonthlyUnavailable")
              : formatCurrency(monthlyAllocatedUsd.amountUsd, "USD"),
        },
      ]}
    />
  );
}

function formatUnallocatedAmountSummary(
  releases: WholesaleSettlementRelease[],
  allocations: WholesaleSettlementReleaseAllocation[],
  allAllocatedLabel: string,
) {
  const activeAmountByRelease = new Map<string, number>();
  for (const allocation of allocations) {
    if (allocation.status !== "active") continue;
    activeAmountByRelease.set(
      allocation.release_id,
      (activeAmountByRelease.get(allocation.release_id) ?? 0) +
        Number(allocation.allocation_amount),
    );
  }

  const totals = new Map<string, number>();
  for (const release of releases) {
    if (release.status === "cancelled" || release.status === "allocated") continue;
    const remainingAmount = Math.max(
      Number(release.release_amount) -
        (activeAmountByRelease.get(release.id) ?? 0),
      0,
    );
    // 不同币种不能直接相加，未分配金额继续按原币分别展示。
    totals.set(
      release.release_currency,
      (totals.get(release.release_currency) ?? 0) + remainingAmount,
    );
  }

  if (totals.size === 0) return allAllocatedLabel;
  return Array.from(totals.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => formatCurrency(amount, currency))
    .join(" / ");
}
