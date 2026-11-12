"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import { UiMessage } from "@/components/i18n/ui-message";
import { CircleDollarSign, LoaderCircle, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type {
  WholesaleCustomer,
  WholesaleOrder,
  WholesaleProfile,
} from "@/lib/wholesale";
import type {
  WholesaleSettlementRelease,
  WholesaleSettlementReleaseAllocation,
} from "@/lib/wholesale-settlement-releases";
import { formatCurrency, formatDate, getProfileName } from "./wholesale-display";
import {
  formatSettlementReleaseHandledAt,
  getActiveSettlementReleaseAllocations,
  getSettlementReleaseAllocatedAmount,
  getSettlementReleaseLatestActorId,
  getSettlementReleaseRemainingAmount,
  getSettlementReleaseStatusTone,
} from "./wholesale-settlement-release-display";
import {
  WholesaleTable,
  WholesaleTd,
  WholesaleTh,
  wholesaleStickyFirstTdClassName,
  wholesaleStickyFirstThClassName,
} from "./wholesale-ui";

type WholesaleSettlementReleaseTableProps = {
  allocationsByReleaseId: Map<
    string,
    WholesaleSettlementReleaseAllocation[]
  >;
  canAllocate: boolean;
  canPublish: boolean;
  customersById: Map<string, WholesaleCustomer>;
  onCancelRelease: (releaseId: string) => Promise<boolean>;
  onOpenAllocation: (release: WholesaleSettlementRelease) => void;
  ordersById: Map<string, WholesaleOrder>;
  pendingKey: string | null;
  profilesById: Map<string, WholesaleProfile>;
  releases: WholesaleSettlementRelease[];
};

export function WholesaleSettlementReleaseTable({
  allocationsByReleaseId,
  canAllocate,
  canPublish,
  customersById,
  onCancelRelease,
  onOpenAllocation,
  ordersById,
  pendingKey,
  profilesById,
  releases,
}: WholesaleSettlementReleaseTableProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_settlement_release_table",
  );

  return (
    <WholesaleTable minWidth={1480}>
      <thead>
        <tr>
          <WholesaleTh className={wholesaleStickyFirstThClassName}>
            <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_table.text001" />
          </WholesaleTh>
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_table.text002" />
          </WholesaleTh>
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_table.text003" />
          </WholesaleTh>
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_table.text004" />
          </WholesaleTh>
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_table.text005" />
          </WholesaleTh>
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_table.text006" />
          </WholesaleTh>
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_table.text007" />
          </WholesaleTh>
          <WholesaleTh className="min-w-[240px] whitespace-normal">
            <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_table.text008" />
          </WholesaleTh>
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_table.text009" />
          </WholesaleTh>
        </tr>
      </thead>
      <tbody>
        {releases.map((release) => {
          const allAllocations = allocationsByReleaseId.get(release.id) ?? [];
          const activeAllocations = getActiveSettlementReleaseAllocations(
            release.id,
            allocationsByReleaseId,
          );
          const cancelPending =
            pendingKey === `settlement-release:cancel:${release.id}`;
          const allocationPending =
            pendingKey === `settlement-release:allocate:${release.id}` ||
            pendingKey === `settlement-release:clear:${release.id}`;
          const allocatedAmount = getSettlementReleaseAllocatedAmount(
            release.id,
            allocationsByReleaseId,
          );
          const remainingAmount = getSettlementReleaseRemainingAmount(
            release,
            allocationsByReleaseId,
          );
          const officialCustomer = release.allocation_customer_id
            ? customersById.get(release.allocation_customer_id)
            : null;

          return (
            <tr
              className="group"
              data-testid={`wholesale-settlement-release-row-${release.id}`}
              key={release.id}
            >
              <WholesaleTd
                className={`${wholesaleStickyFirstTdClassName} min-w-[230px] px-4 py-3`}
              >
                <div className="space-y-1 whitespace-normal">
                  <p className="font-semibold [overflow-wrap:anywhere]">
                    {officialCustomer?.unique_name ?? release.customer_name}
                  </p>
                  {officialCustomer &&
                  officialCustomer.unique_name !== release.customer_name ? (
                    <p className="text-xs text-content-muted [overflow-wrap:anywhere]">
                      {uiText("publishedAs", {
                        customerName: release.customer_name,
                      })}
                    </p>
                  ) : null}
                  <p className="text-content-muted">
                    {formatCurrency(
                      release.release_amount,
                      release.release_currency,
                    )}
                  </p>
                </div>
              </WholesaleTd>
              <WholesaleTd>
                <StatusBadge tone={getSettlementReleaseStatusTone(release.status)}>
                  {uiText(`status.${release.status}`)}
                </StatusBadge>
              </WholesaleTd>
              <WholesaleTd>{formatDate(release.received_on)}</WholesaleTd>
              <WholesaleTd className="min-w-[190px] whitespace-normal">
                <p className="font-semibold text-content-strong">
                  {formatCurrency(allocatedAmount, release.release_currency)}
                </p>
                <p className="mt-1 text-xs text-content-muted">
                  {uiText("remainingAmount", {
                    amount: formatCurrency(
                      remainingAmount,
                      release.release_currency,
                    ),
                  })}
                </p>
              </WholesaleTd>
              <WholesaleTd className="min-w-[210px] whitespace-normal">
                <AllocationOrderSummary
                  activeAllocations={activeAllocations}
                  emptyLabel={uiText("notAllocated")}
                  moreOrdersLabel={(count) => uiText("moreOrders", { count })}
                  ordersById={ordersById}
                  removedOrderLabel={uiText("removedOrder")}
                />
              </WholesaleTd>
              <WholesaleTd className="min-w-[150px] whitespace-normal">
                <p>{getProfileName(profilesById, release.published_by_user_id)}</p>
                <p className="mt-1 text-xs text-content-muted">
                  {uiText("latestActor", {
                    actor: getProfileName(
                      profilesById,
                      getSettlementReleaseLatestActorId(allAllocations),
                    ),
                  })}
                </p>
              </WholesaleTd>
              <WholesaleTd className="min-w-[160px] whitespace-normal">
                {formatSettlementReleaseHandledAt(release, allAllocations, uiText("awaiting"))}
              </WholesaleTd>
              <WholesaleTd className="min-w-[240px] whitespace-normal">
                {release.note ?? uiText("noNote")}
              </WholesaleTd>
              <WholesaleTd className="min-w-[190px] whitespace-normal">
                <div className="flex flex-wrap gap-2">
                  {canAllocate && release.status !== "cancelled" ? (
                    <Button
                      disabled={allocationPending}
                      onClick={() => onOpenAllocation(release)}
                      size="compact"
                      type="button"
                      variant="primary"
                    >
                      {allocationPending ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        <CircleDollarSign className="size-3.5" />
                      )}
                      <AllocationActionLabel status={release.status} />
                    </Button>
                  ) : null}
                  {canPublish && release.status === "pending" ? (
                    <Button
                      disabled={cancelPending}
                      onClick={() => void onCancelRelease(release.id)}
                      size="compact"
                      type="button"
                      variant="danger"
                    >
                      {cancelPending ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        <XCircle className="size-3.5" />
                      )}
                      <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_table.text011" />
                    </Button>
                  ) : null}
                  {release.status === "cancelled" ? (
                    <span className="text-xs leading-6 text-content-muted">
                      <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_table.text012" />
                    </span>
                  ) : null}
                </div>
              </WholesaleTd>
            </tr>
          );
        })}
      </tbody>
    </WholesaleTable>
  );
}

function AllocationOrderSummary({
  activeAllocations,
  emptyLabel,
  moreOrdersLabel,
  ordersById,
  removedOrderLabel,
}: {
  activeAllocations: WholesaleSettlementReleaseAllocation[];
  emptyLabel: string;
  moreOrdersLabel: (count: number) => string;
  ordersById: Map<string, WholesaleOrder>;
  removedOrderLabel: string;
}) {
  if (activeAllocations.length === 0) {
    return <span className="text-content-muted">{emptyLabel}</span>;
  }

  const orderNumbers = activeAllocations.map(
    (allocation) =>
      ordersById.get(allocation.order_id)?.order_number ?? removedOrderLabel,
  );

  return (
    <div className="space-y-1">
      {orderNumbers.slice(0, 2).map((orderNumber) => (
        <p className="break-words [overflow-wrap:anywhere]" key={orderNumber}>
          {orderNumber}
        </p>
      ))}
      {orderNumbers.length > 2 ? (
        <p className="text-xs text-content-muted">
          {moreOrdersLabel(orderNumbers.length - 2)}
        </p>
      ) : null}
    </div>
  );
}

function AllocationActionLabel({
  status,
}: {
  status: WholesaleSettlementRelease["status"];
}) {
  if (status === "allocated") {
    return <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_table.text014" />;
  }
  if (status === "partially_allocated") {
    return <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_table.text013" />;
  }
  return <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_table.text010" />;
}
