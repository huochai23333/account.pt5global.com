"use client";

import { DashboardPagedRecords } from "@/components/dashboard/dashboard-paged-records";

import * as FormControls from "@/components/ui/form-controls";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { RefreshCcw } from "lucide-react";
import {
  DashboardFilterField,
  DashboardListSection,
  dashboardFilterInputClassName,
} from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { WholesaleCustomer, WholesaleProfile } from "@/lib/wholesale";
import {
  WholesaleCustomerDirectory,
  WholesaleSalesAccountDirectory,
} from "./wholesale-people-directories";
type WholesaleCustomerPeopleTabProps = {
  customerKindFilter: string;
  customerSalesFilter: string;
  customerSearch: string;
  customers: WholesaleCustomer[];
  filteredCustomers: WholesaleCustomer[];
  hasCustomerFilters: boolean;
  onCustomerKindFilterChange: (value: string) => void;
  onCustomerSalesFilterChange: (value: string) => void;
  onCustomerSearchChange: (value: string) => void;
  onResetCustomerFilters: () => void;
  onSelectCustomer: (customer: WholesaleCustomer) => void;
  profilesById: Map<string, WholesaleProfile>;
  salesAccounts: WholesaleProfile[];
};
type WholesaleSalesAccountPeopleTabProps = {
  accountRoleFilter: string;
  accountSearch: string;
  accountStatusFilter: string;
  filteredAccounts: WholesaleProfile[];
  hasAccountFilters: boolean;
  onAccountRoleFilterChange: (value: string) => void;
  onAccountSearchChange: (value: string) => void;
  onAccountStatusFilterChange: (value: string) => void;
  onResetAccountFilters: () => void;
  onSelectProfile: (profile: WholesaleProfile) => void;
  salesAccounts: WholesaleProfile[];
};
const ALL = "all";
export function WholesaleCustomerPeopleTab({
  customerKindFilter,
  customerSalesFilter,
  customerSearch,
  customers,
  filteredCustomers,
  hasCustomerFilters,
  onCustomerKindFilterChange,
  onCustomerSalesFilterChange,
  onCustomerSearchChange,
  onResetCustomerFilters,
  onSelectCustomer,
  profilesById,
  salesAccounts,
}: WholesaleCustomerPeopleTabProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_people_tabs",
  );
  const t = useTranslations("WholesaleBusiness.directoryUi");
  // 客户可能由管理员认领线索后建档，筛选补入实际负责人；业务员账户及订单候选范围保持独立。
  const ownerOptions = [...salesAccounts];
  for (const customer of customers) {
    const owner = customer.assigned_sales_user_id ? profilesById.get(customer.assigned_sales_user_id) : undefined;
    if (owner?.role === "administrator" && !ownerOptions.some((profile) => profile.user_id === owner.user_id)) ownerOptions.push(owner);
  }
  return (
    <DashboardListSection
      actions={
        <Button
          size="default"
          disabled={!hasCustomerFilters}
          onClick={onResetCustomerFilters}
          type="button"
          variant="outline"
        >
          <RefreshCcw className="size-4" />
          <UiMessage id="components_dashboard_wholesale_wholesale_people_tabs.text001" />
        </Button>
      }
      ariaLabel={uiText("attribute001")}
      description={t("customerCount", {
        total: customers.length,
        visible: filteredCustomers.length,
      })}
    >
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <DashboardFilterField label={uiText("attribute002")}>
          <FormControls.Input
            className={dashboardFilterInputClassName}
            onChange={(event) => onCustomerSearchChange(event.target.value)}
            placeholder={uiText("attribute003")}
            type="search"
            value={customerSearch}
          />
        </DashboardFilterField>
        <DashboardFilterField label={uiText("attribute004")}>
          <Select
            aria-label={uiText("attribute004")}
            onValueChange={onCustomerKindFilterChange}
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_people_tabs.text002" />
                ),
                value: ALL,
              },
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_people_tabs.text003" />
                ),
                value: "registered_account",
              },
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_people_tabs.text004" />
                ),
                value: "sales_created",
              },
            ]}
            value={customerKindFilter}
          />
        </DashboardFilterField>
        <DashboardFilterField label={uiText("attribute005")}>
          <Select
            aria-label={uiText("attribute005")}
            onValueChange={onCustomerSalesFilterChange}
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_people_tabs.text005" />
                ),
                value: ALL,
              },
              ...ownerOptions.map((profile) => ({
                label: profile.name || profile.email,
                value: profile.user_id,
              })),
            ]}
            value={customerSalesFilter}
          />
        </DashboardFilterField>
      </div>
      <DashboardPagedRecords items={filteredCustomers}
        queryKey={JSON.stringify([customerSearch, customerKindFilter, customerSalesFilter])}>
        {(pageRows) => (
          <>
          <WholesaleCustomerDirectory
            customers={pageRows}
            onSelect={onSelectCustomer}
            profilesById={profilesById}
          />
          </>
        )}
      </DashboardPagedRecords>
    </DashboardListSection>
  );
}
export function WholesaleSalesAccountPeopleTab({
  accountRoleFilter,
  accountSearch,
  accountStatusFilter,
  filteredAccounts,
  hasAccountFilters,
  onAccountRoleFilterChange,
  onAccountSearchChange,
  onAccountStatusFilterChange,
  onResetAccountFilters,
  onSelectProfile,
  salesAccounts,
}: WholesaleSalesAccountPeopleTabProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_people_tabs",
  );
  const t = useTranslations("WholesaleBusiness.directoryUi");
  return (
    <DashboardListSection
      actions={
        <Button
          size="default"
          disabled={!hasAccountFilters}
          onClick={onResetAccountFilters}
          type="button"
          variant="outline"
        >
          <RefreshCcw className="size-4" />
          <UiMessage id="components_dashboard_wholesale_wholesale_people_tabs.text006" />
        </Button>
      }
      ariaLabel={uiText("attribute006")}
      description={t("accountCount", {
        total: salesAccounts.length,
        visible: filteredAccounts.length,
      })}
    >
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <DashboardFilterField label={uiText("attribute007")}>
          <FormControls.Input
            className={dashboardFilterInputClassName}
            onChange={(event) => onAccountSearchChange(event.target.value)}
            placeholder={uiText("attribute008")}
            type="search"
            value={accountSearch}
          />
        </DashboardFilterField>
        <DashboardFilterField label={uiText("attribute009")}>
          <Select
            aria-label={uiText("attribute009")}
            onValueChange={onAccountRoleFilterChange}
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_people_tabs.text007" />
                ),
                value: ALL,
              },
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_people_tabs.text008" />
                ),
                value: "salesman",
              },
            ]}
            value={accountRoleFilter}
          />
        </DashboardFilterField>
        <DashboardFilterField label={uiText("attribute010")}>
          <Select
            aria-label={uiText("attribute010")}
            onValueChange={onAccountStatusFilterChange}
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_people_tabs.text009" />
                ),
                value: ALL,
              },
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_people_tabs.text010" />
                ),
                value: "active",
              },
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_people_tabs.text011" />
                ),
                value: "inactive",
              },
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_people_tabs.text012" />
                ),
                value: "suspended",
              },
            ]}
            value={accountStatusFilter}
          />
        </DashboardFilterField>
      </div>
      <DashboardPagedRecords items={filteredAccounts}
        queryKey={JSON.stringify([accountSearch, accountRoleFilter, accountStatusFilter])}>
        {(pageRows) => (
          <>
          <WholesaleSalesAccountDirectory
            accounts={pageRows}
            onSelect={onSelectProfile}
          />
          </>
        )}
      </DashboardPagedRecords>
    </DashboardListSection>
  );
}
