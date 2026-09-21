"use client";

import * as FormControls from "@/components/ui/form-controls";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
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
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { CommissionRuleSetting } from "@/lib/commission-settings";
import type { WholesaleReferralCommissionRow } from "@/lib/wholesale-referral-commissions";
import { normalizeSearchText } from "@/lib/value-normalizers";
import type {
  WholesaleCommission,
  WholesaleCustomer,
  WholesaleOrder,
  WholesaleProfile,
} from "@/lib/wholesale";
import {
  formatCurrency,
  getCustomerName,
  getProfileName,
} from "./wholesale-display";
import {
  WholesaleEmptyState,
  WholesalePageShell,
  WholesaleStatGrid,
} from "./wholesale-ui";
import { formatWholesaleOrderCommissionDescription } from "./wholesale-commission-settings";
import { WholesaleReferralCommissionSection } from "./wholesale-referral-commission-section";
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
  referralRows: WholesaleReferralCommissionRow[];
  variant: "commission" | "incentives";
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
  referralRows,
  variant,
}: WholesaleCommissionSectionProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_commission_section",
  );
  const [incentiveSearch, setIncentiveSearch] = useState("");
  const [incentiveStatusFilter, setIncentiveStatusFilter] = useState(ALL);
  const [incentiveSalesFilter, setIncentiveSalesFilter] = useState(ALL);
  const { locale } = useLocale();
  const orderById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );
  const commissionDescription = useMemo(
    () =>
      formatWholesaleOrderCommissionDescription(commissionRuleSettings, locale),
    [commissionRuleSettings, locale],
  );
  const filteredCommissions = useMemo(() => {
    const searchValue = normalizeSearchText(incentiveSearch);
    return commissions.filter((commission) => {
      const order = orderById.get(commission.order_id);
      if (
        incentiveStatusFilter !== ALL &&
        commission.status !== incentiveStatusFilter
      ) {
        return false;
      }
      if (
        incentiveSalesFilter !== ALL &&
        (commission.beneficiary_user_id ?? "") !== incentiveSalesFilter
      ) {
        return false;
      }
      if (!searchValue) return true;
      return [
        order?.order_number ?? "",
        getCustomerName(customersById, commission.customer_id),
        getProfileName(profilesById, commission.beneficiary_user_id),
      ].some((value) => normalizeSearchText(value).includes(searchValue));
    });
  }, [
    commissions,
    customersById,
    incentiveSalesFilter,
    incentiveSearch,
    incentiveStatusFilter,
    orderById,
    profilesById,
  ]);
  const totalCommission = commissions.reduce(
    (sum, row) => sum + Number(row.commission_amount_rmb ?? 0),
    0,
  );
  const pendingCommission = commissions
    .filter((row) => row.status === "pending")
    .reduce((sum, row) => sum + Number(row.commission_amount_rmb ?? 0), 0);
  const salesAccounts = useMemo(() => {
    const userIds = new Set(
      commissions
        .map((commission) => commission.beneficiary_user_id)
        .filter((value): value is string => Boolean(value)),
    );
    return [...userIds].map((userId) => ({
      label: getProfileName(profilesById, userId),
      userId,
    }));
  }, [commissions, profilesById]);
  if (variant === "commission") {
    return (
      <WholesaleReferralCommissionSection
        customersById={customersById}
        referralRows={referralRows}
      />
    );
  }
  const hasActiveFilters =
    incentiveSearch ||
    incentiveStatusFilter !== ALL ||
    incentiveSalesFilter !== ALL;
  return (
    <WholesalePageShell
      meta={commissionDescription}
      title={uiText("attribute002")}
    >
      <WholesaleStatGrid
        stats={[
          {
            icon: <CircleDollarSign className="size-4" />,
            label: "提成合计",
            tone: "success",
            value: formatCurrency(totalCommission),
          },
          {
            icon: <Clock3 className="size-4" />,
            label: "待结算提成",
            tone: "warning",
            value: formatCurrency(pendingCommission),
          },
          {
            icon: <ReceiptText className="size-4" />,
            label: "提成记录",
            tone: "info",
            value: `${commissions.length}`,
          },
          {
            icon: <ListFilter className="size-4" />,
            label: "当前显示",
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
          <WholesaleCommissionRecords
            canAdmin={canAdmin}
            commissions={filteredCommissions}
            customersById={customersById}
            onSettleCommission={onSettleCommission}
            orderById={orderById}
            pendingKey={pendingKey}
            profilesById={profilesById}
          />
        )}
      </DashboardListSection>
    </WholesalePageShell>
  );
}
