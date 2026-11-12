"use client";

import * as FormControls from "@/components/ui/form-controls";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardSearchInput } from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "./wholesale-display";
import type { SettlementReleaseAllocationCandidate } from "./use-wholesale-settlement-release-allocation-form";

type AllocationOrderListProps = {
  currency: string;
  onAmountChange: (orderId: string, value: string) => void;
  onSearchTextChange: (value: string) => void;
  searchText: string;
  visibleCandidates: SettlementReleaseAllocationCandidate[];
};

/**
 * 订单金额列表在手机上改成纵向卡片，在桌面上恢复为对齐的多列表格。
 * 两种宽度复用同一组数据，避免桌面和手机分别维护业务规则。
 */
export function WholesaleSettlementReleaseAllocationOrderList({
  currency,
  onAmountChange,
  onSearchTextChange,
  searchText,
  visibleCandidates,
}: AllocationOrderListProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_settlement_release_allocation_order_list",
  );

  return (
    <section className="min-w-0 space-y-3" data-testid="settlement-allocation-order-list">
      <FormControls.Field label={uiText("searchLabel")}>
        <DashboardSearchInput
          ariaLabel={uiText("searchLabel")}
          onChange={onSearchTextChange}
          placeholder={uiText("searchPlaceholder")}
          value={searchText}
        />
      </FormControls.Field>

      {visibleCandidates.length > 0 ? (
        <div className="min-w-0 overflow-hidden rounded-record-card border border-border-subtle bg-surface-panel">
          <div
            aria-hidden="true"
            className="hidden grid-cols-[minmax(150px,1.4fr)_minmax(120px,0.9fr)_minmax(120px,0.9fr)_minmax(150px,1fr)_44px] gap-3 border-b border-border-subtle bg-surface-inset px-4 py-3 text-[11px] font-semibold tracking-[0.14em] text-content-muted uppercase sm:grid"
          >
            <span>{uiText("orderColumn")}</span>
            <span>{uiText("orderAmountColumn")}</span>
            <span>{uiText("availableColumn")}</span>
            <span>{uiText("allocationColumn")}</span>
            <span />
          </div>

          <div className="divide-y divide-border-subtle">
            {visibleCandidates.map((candidate) => {
              const afterAllocation = Math.max(
                candidate.availableAmount - candidate.allocatedAmount,
                0,
              );
              const inputLabel = uiText("allocationInputLabel", {
                orderNumber: candidate.order.order_number,
              });

              return (
                <div
                  className="grid min-w-0 gap-4 p-4 sm:grid-cols-[minmax(150px,1.4fr)_minmax(120px,0.9fr)_minmax(120px,0.9fr)_minmax(150px,1fr)_44px] sm:items-center sm:gap-3"
                  data-testid={`settlement-allocation-order-${candidate.order.id}`}
                  key={candidate.order.id}
                >
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-content-strong [overflow-wrap:anywhere]">
                      {candidate.order.order_number}
                    </p>
                    <p className="mt-1 text-xs text-content-muted">
                      {uiText("orderedOn", {
                        date: formatDate(candidate.order.ordered_at),
                      })}
                    </p>
                  </div>

                  <AllocationValue
                    label={uiText("orderAmountColumn")}
                    value={formatCurrency(candidate.order.customer_payment_amount, currency)}
                  />
                  <AllocationValue
                    label={uiText("availableColumn")}
                    value={formatCurrency(candidate.availableAmount, currency)}
                  />

                  <div className="min-w-0">
                    <FormControls.Field
                      error={
                        candidate.error === "exceeds_available"
                          ? uiText("exceedsAvailable")
                          : candidate.error === "invalid"
                            ? uiText("invalidAmount")
                            : undefined
                      }
                      hint={
                        candidate.error
                          ? undefined
                          : uiText("remainingAfter", {
                              amount: formatCurrency(afterAllocation, currency),
                            })
                      }
                      label={inputLabel}
                      labelHidden
                    >
                      <FormControls.Input
                        min="0"
                        onChange={(event) => onAmountChange(candidate.order.id, event.target.value)}
                        step="0.01"
                        type="number"
                        value={candidate.allocationInput}
                      />
                    </FormControls.Field>
                  </div>

                  <Button
                    aria-label={uiText("clearOrder", {
                      orderNumber: candidate.order.order_number,
                    })}
                    disabled={!candidate.allocationInput}
                    onClick={() => onAmountChange(candidate.order.id, "")}
                    size="icon-compact"
                    type="button"
                    variant="ghost"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-record-card border border-dashed border-border-subtle bg-surface-panel px-4 py-8 text-center">
          <p className="text-sm font-semibold text-content-strong">
            {searchText ? uiText("noSearchResult") : uiText("noOrders")}
          </p>
          <p className="mt-2 text-sm leading-6 text-content-muted">
            {searchText ? uiText("noSearchResultHint") : uiText("noOrdersHint")}
          </p>
        </div>
      )}
    </section>
  );
}

function AllocationValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-content-muted sm:sr-only">{label}</p>
      <p className="mt-1 break-words text-sm text-content-strong [overflow-wrap:anywhere] sm:mt-0">
        {value}
      </p>
    </div>
  );
}
