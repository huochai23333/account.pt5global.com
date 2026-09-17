"use client";

import * as FormControls from "@/components/ui/form-controls";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Plus, RefreshCcw, ReceiptText } from "lucide-react";
import {
  DashboardFilterField,
  DashboardListSection,
  dashboardFilterInputClassName,
} from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type {
  WholesaleCustomer,
  WholesaleOrder,
  WholesaleOrderSettlement,
  WholesaleProfile,
} from "@/lib/wholesale";
import type {
  WholesaleSettlementRelease,
  WholesaleSettlementReleaseAllocation,
} from "@/lib/wholesale-settlement-releases";
import type { MonthlySettlementAllocatedUsdSummary } from "@/lib/wholesale-settlement-release-summary";
import { normalizeSearchText } from "@/lib/value-normalizers";
import { WholesaleSettlementReleaseAllocationDialog } from "./wholesale-settlement-release-allocation-dialog";
import { WholesaleSettlementReleaseCreateDialog } from "./wholesale-settlement-release-dialogs";
import {
  getSettlementReleaseSearchText,
  WHOLESALE_SETTLEMENT_RELEASE_STATUS_LABELS,
} from "./wholesale-settlement-release-display";
import { WholesaleSettlementReleaseTable } from "./wholesale-settlement-release-table";
import { WholesaleSettlementReleaseSummary } from "./wholesale-settlement-release-summary";
import type { SettlementReleaseAllocationSubmission } from "./use-wholesale-settlement-release-actions";
import {
  WholesaleEmptyState,
  WholesalePageShell,
} from "./wholesale-ui";
type WholesaleSettlementReleaseSectionProps = {
  allocations: WholesaleSettlementReleaseAllocation[];
  canAllocate: boolean;
  canPublish: boolean;
  customers: WholesaleCustomer[];
  onCancelRelease: (releaseId: string) => Promise<boolean>;
  onClearAllocations: (
    releaseId: string,
    expectedRevision: number,
  ) => Promise<boolean>;
  onCreateRelease: (formData: FormData) => Promise<boolean>;
  onSaveAllocations: (
    submission: SettlementReleaseAllocationSubmission,
  ) => Promise<boolean>;
  monthlyAllocatedUsd: MonthlySettlementAllocatedUsdSummary | null;
  orderSettlements: WholesaleOrderSettlement[];
  orders: WholesaleOrder[];
  pendingKey: string | null;
  profiles: WholesaleProfile[];
  releases: WholesaleSettlementRelease[];
};
const ALL = "all";
const FALLBACK_CURRENCIES = ["USD", "CNY", "EUR", "JPY", "AUD"];
export function WholesaleSettlementReleaseSection({
  allocations,
  canAllocate,
  canPublish,
  customers,
  onCancelRelease,
  onClearAllocations,
  onCreateRelease,
  onSaveAllocations,
  monthlyAllocatedUsd,
  orderSettlements,
  orders,
  pendingKey,
  profiles,
  releases,
}: WholesaleSettlementReleaseSectionProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_settlement_release_section",
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedAllocationRelease, setSelectedAllocationRelease] =
    useState<WholesaleSettlementRelease | null>(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const ordersById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );
  const customersById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const profilesById = useMemo(
    () => new Map(profiles.map((profile) => [profile.user_id, profile])),
    [profiles],
  );
  const allocationsByReleaseId = useMemo(() => {
    // 列表的进度、订单摘要和搜索都需要同一组分配记录，集中分组可以避免每行反复扫描完整数组。
    const grouped = new Map<string, WholesaleSettlementReleaseAllocation[]>();
    for (const allocation of allocations) {
      const rows = grouped.get(allocation.release_id) ?? [];
      rows.push(allocation);
      grouped.set(allocation.release_id, rows);
    }
    return grouped;
  }, [allocations]);
  const currencyOptions = useMemo(() => {
    const values = new Set([
      ...FALLBACK_CURRENCIES,
      ...orders.map((order) => order.customer_payment_currency),
      ...releases.map((release) => release.release_currency),
    ]);
    return Array.from(values).filter(Boolean).sort();
  }, [orders, releases]);
  const filteredReleases = useMemo(() => {
    const searchValue = normalizeSearchText(searchText);
    return releases.filter((release) => {
      if (statusFilter !== ALL && release.status !== statusFilter) return false;
      if (!searchValue) return true;
      return normalizeSearchText(
        getSettlementReleaseSearchText({
          allocationsByReleaseId,
          ordersById,
          profilesById,
          release,
        }),
      ).includes(searchValue);
    });
  }, [
    allocationsByReleaseId,
    ordersById,
    profilesById,
    releases,
    searchText,
    statusFilter,
  ]);
  const hasActiveFilters = searchText || statusFilter !== ALL;
  return (
    <WholesalePageShell
      actions={
        canPublish ? (
          <Button
            variant="primary"
            size="default"
            onClick={() => setCreateDialogOpen(true)}
            type="button"
          >
            <Plus className="size-4" />
            <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_section.text001" />
          </Button>
        ) : null
      }
      title={uiText("attribute003")}
    >
      <WholesaleSettlementReleaseSummary
        allocations={allocations}
        monthlyAllocatedUsd={monthlyAllocatedUsd}
        releases={releases}
      />

      <DashboardListSection
        actions={
          <Button
            size="default"
            disabled={!hasActiveFilters}
            onClick={() => {
              setSearchText("");
              setStatusFilter(ALL);
            }}
            type="button"
            variant="outline"
          >
            <RefreshCcw className="size-4" />
            <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_section.text002" />
          </Button>
        }
        ariaLabel={uiText("attribute004")}
      >
        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <DashboardFilterField label={uiText("attribute005")}>
            <FormControls.Input
              aria-label={uiText("attribute006")}
              className={dashboardFilterInputClassName}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={uiText("attribute007")}
              value={searchText}
            />
          </DashboardFilterField>
          <DashboardFilterField label={uiText("attribute008")}>
            <Select
              aria-label={uiText("attribute008")}
              onValueChange={setStatusFilter}
              options={[
                {
                  label: (
                    <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_section.text003" />
                  ),
                  value: ALL,
                },
                ...Object.entries(
                  WHOLESALE_SETTLEMENT_RELEASE_STATUS_LABELS,
                ).map(([status, label]) => ({ label, value: status })),
              ]}
              value={statusFilter}
            />
          </DashboardFilterField>
        </div>

        {filteredReleases.length > 0 ? (
          <WholesaleSettlementReleaseTable
            allocationsByReleaseId={allocationsByReleaseId}
            canAllocate={canAllocate}
            canPublish={canPublish}
            customersById={customersById}
            onCancelRelease={onCancelRelease}
            onOpenAllocation={setSelectedAllocationRelease}
            ordersById={ordersById}
            pendingKey={pendingKey}
            profilesById={profilesById}
            releases={filteredReleases}
          />
        ) : (
          <WholesaleEmptyState
            description={uiText("attribute009")}
            icon={<ReceiptText className="size-6" />}
            title={uiText("attribute010")}
          />
        )}
      </DashboardListSection>

      {createDialogOpen ? (
        <WholesaleSettlementReleaseCreateDialog
          currencyOptions={currencyOptions}
          customers={customers}
          onCreateRelease={onCreateRelease}
          onOpenChange={setCreateDialogOpen}
          pending={pendingKey === "settlement-release:create"}
        />
      ) : null}

      {selectedAllocationRelease ? (
        <WholesaleSettlementReleaseAllocationDialog
          allocations={allocations}
          customers={customers}
          onClearAllocations={onClearAllocations}
          onOpenChange={(open) => {
            if (!open) setSelectedAllocationRelease(null);
          }}
          onSaveAllocations={onSaveAllocations}
          orderSettlements={orderSettlements}
          orders={orders}
          pendingAction={
            pendingKey ===
            `settlement-release:allocate:${selectedAllocationRelease.id}`
              ? "save"
              : pendingKey ===
                  `settlement-release:clear:${selectedAllocationRelease.id}`
                ? "clear"
                : null
          }
          release={selectedAllocationRelease}
        />
      ) : null}
    </WholesalePageShell>
  );
}
