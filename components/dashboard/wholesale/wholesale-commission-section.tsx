"use client";

import { DashboardPagedRecords } from "@/components/dashboard/dashboard-paged-records";

import * as FormControls from "@/components/ui/form-controls";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import {
  Calculator,
  CircleDollarSign,
  Clock3,
  ListFilter,
  ReceiptText,
  RefreshCcw,
} from "lucide-react";
import {
  DashboardFilterField,
  DashboardListSection,
  dashboardFilterInputClassName,
} from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { CommissionRuleSetting } from "@/lib/commission-settings";
import type {
  WholesaleCommission,
  WholesaleCustomer,
  WholesaleOrder,
  WholesaleProfile,
} from "@/lib/wholesale";
import {
  formatCurrency,
} from "./wholesale-display";
import {
  WholesaleEmptyState,
  WholesaleStatGrid,
} from "./wholesale-ui";
import { useWholesaleIncentiveViewModel } from "./use-wholesale-incentive-view-model";
import { WholesaleCommissionRecords } from "./wholesale-commission-records";
type WholesaleCommissionSectionProps = {
  canAdmin: boolean;
  commissionRuleSettings: CommissionRuleSetting[];
  commissions: WholesaleCommission[];
  customersById: Map<string, WholesaleCustomer>;
  onSettleCommission: (commissionId: string) => void;
  orders: WholesaleOrder[];
  pendingKey: string | null;
  profilesById: Map<string, WholesaleProfile>;
};
const ALL = "all";
export function WholesaleCommissionSection({
  canAdmin,
  commissionRuleSettings,
  commissions,
  customersById,
  onSettleCommission,
  orders,
  pendingKey,
  profilesById,
}: WholesaleCommissionSectionProps) {
  const boardText = useTranslations("WholesaleBusiness.commissionBoards");
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_commission_section",
  );
  const { incentiveSearch, setIncentiveSearch, incentiveStatusFilter, setIncentiveStatusFilter,
    incentiveSalesFilter, setIncentiveSalesFilter, orderById, commissionDescription,
    filteredCommissions, totalCommission, pendingCommission, salesAccounts, hasActiveFilters } =
    useWholesaleIncentiveViewModel({ commissions, customersById, orders, profilesById, commissionRuleSettings });
  return (
    <div className="space-y-6">
      <p className="text-sm text-content-muted">{commissionDescription}</p>
      <WholesaleStatGrid
        stats={[
          {
            icon: <CircleDollarSign className="size-4" />,
            label: boardText("incentiveTotal"),
            tone: "success",
            value: formatCurrency(totalCommission),
          },
          {
            icon: <Clock3 className="size-4" />,
            label: boardText("incentivePending"),
            tone: "warning",
            value: formatCurrency(pendingCommission),
          },
          {
            icon: <ReceiptText className="size-4" />,
            label: boardText("incentiveRecords"),
            tone: "info",
            value: `${commissions.length}`,
          },
          {
            icon: <ListFilter className="size-4" />,
            label: boardText("visibleRecords"),
            tone: "info",
            value: `${filteredCommissions.length}`,
          },
        ]}
      />

      <DashboardListSection
        actions={
          <Button
            size="default"
            disabled={!hasActiveFilters}
            onClick={() => {
              setIncentiveSearch("");
              setIncentiveStatusFilter(ALL);
              setIncentiveSalesFilter(ALL);
            }}
            type="button"
            variant="outline"
          >
            <RefreshCcw className="size-4" />
            <UiMessage id="components_dashboard_wholesale_wholesale_commission_section.text001" />
          </Button>
        }
        ariaLabel={uiText("attribute003")}
      >
        <div className="mb-5 grid gap-4 md:grid-cols-3">
          <DashboardFilterField label={uiText("attribute004")}>
            <FormControls.Input
              className={dashboardFilterInputClassName}
              onChange={(event) => setIncentiveSearch(event.target.value)}
              placeholder={uiText("attribute005")}
              type="search"
              value={incentiveSearch}
            />
          </DashboardFilterField>
          <DashboardFilterField label={uiText("attribute006")}>
            <Select
              aria-label={uiText("attribute006")}
              onValueChange={setIncentiveSalesFilter}
              options={[
                {
                  label: (
                    <UiMessage id="components_dashboard_wholesale_wholesale_commission_section.text002" />
                  ),
                  value: ALL,
                },
                ...salesAccounts.map((account) => ({
                  label: account.label,
                  value: account.userId,
                })),
              ]}
              value={incentiveSalesFilter}
            />
          </DashboardFilterField>
          <DashboardFilterField label={uiText("attribute007")}>
            <Select
              aria-label={uiText("attribute007")}
              onValueChange={setIncentiveStatusFilter}
              options={[
                {
                  label: (
                    <UiMessage id="components_dashboard_wholesale_wholesale_commission_section.text003" />
                  ),
                  value: ALL,
                },
                {
                  label: (
                    <UiMessage id="components_dashboard_wholesale_wholesale_commission_section.text004" />
                  ),
                  value: "pending",
                },
                {
                  label: (
                    <UiMessage id="components_dashboard_wholesale_wholesale_commission_section.text005" />
                  ),
                  value: "settled",
                },
                {
                  label: (
                    <UiMessage id="components_dashboard_wholesale_wholesale_commission_section.text006" />
                  ),
                  value: "cancelled",
                },
              ]}
              value={incentiveStatusFilter}
            />
          </DashboardFilterField>
        </div>

        {filteredCommissions.length === 0 ? (
          <WholesaleEmptyState
            description={uiText("attribute008")}
            icon={<Calculator className="size-5" />}
            title={uiText("attribute009")}
          />
        ) : (
          <DashboardPagedRecords items={filteredCommissions}
            queryKey={JSON.stringify([incentiveSearch, incentiveStatusFilter, incentiveSalesFilter])}>
            {(pageRows) => (
              <>
              <WholesaleCommissionRecords
                canAdmin={canAdmin}
                commissions={pageRows}
                customersById={customersById}
                onSettleCommission={onSettleCommission}
                orderById={orderById}
                pendingKey={pendingKey}
                profilesById={profilesById}
              />
              </>
            )}
          </DashboardPagedRecords>
        )}
      </DashboardListSection>
    </div>
  );
}
