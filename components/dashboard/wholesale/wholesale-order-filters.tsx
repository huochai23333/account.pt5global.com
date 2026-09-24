"use client";

import * as FormControls from "@/components/ui/form-controls";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  DashboardFilterField,
  dashboardFilterInputClassName,
} from "@/components/dashboard/dashboard-section-panel";
import { DashboardOrderFilterSection } from "@/components/dashboard/dashboard-order-filter-section";
import { UiMessage } from "@/components/i18n/ui-message";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { getDefaultOrderDateRange } from "@/lib/order-date-range";
import type { WholesaleCustomer, WholesaleProfile } from "@/lib/wholesale";
import type { WholesaleOrderFilters } from "@/lib/wholesale-order-page";

type WholesaleOrderFiltersProps = {
  customers: WholesaleCustomer[];
  filters: WholesaleOrderFilters;
  hasActiveFilters: boolean;
  hideCustomerFilter: boolean;
  hideOrderMonthFilter: boolean;
  onClear: () => void;
  onExactSearch: () => void;
  onExitExactSearch: () => void;
  onSelectDatePreset: (
    preset:
      "last_30_days" | "current_month" | "previous_month" | "last_3_months",
  ) => void;
  onUpdate: <Key extends keyof WholesaleOrderFilters>(
    key: Key,
    value: WholesaleOrderFilters[Key],
  ) => void;
  salesAccounts: WholesaleProfile[];
};
export function WholesaleOrderFiltersPanel({
  customers,
  filters,
  hasActiveFilters,
  hideCustomerFilter,
  hideOrderMonthFilter,
  onClear,
  onExactSearch,
  onExitExactSearch,
  onSelectDatePreset,
  onUpdate,
  salesAccounts,
}: WholesaleOrderFiltersProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_order_filters",
  );
  const frameworkT = useTranslations("OrderListFramework");
  const defaultRange = getDefaultOrderDateRange();
  return (
    <DashboardOrderFilterSection
      collapseDesktop
      activeFilterCount={[
        Boolean(filters.searchText),
        filters.status !== "all",
        // 客户账号只能看到自己的订单，再展示“客户”条件既没有筛选价值，
        // 也容易让客户误以为可以查询其他客户，因此客户视角不计入这一条件。
        !hideCustomerFilter && Boolean(filters.customerId),
        Boolean(filters.salesUserId),
        // “计入月份”属于内部经营字段，客户页面既不展示字段本身，也不把它计入筛选状态。
        !hideOrderMonthFilter && Boolean(filters.orderMonth),
        filters.orderedFromDate !== defaultRange.fromDate ||
          filters.orderedToDate !== defaultRange.toDate,
        filters.searchMode !== "date_range",
      ].filter(Boolean).length}
      customInputId="wholesale-order-date-from"
      dateRange={{
        fromDate: filters.orderedFromDate,
        toDate: filters.orderedToDate,
      }}
      exactOrderNumber={
        filters.searchMode === "exact_all_time"
          ? filters.searchText.trim()
          : null
      }
      // 内部账号共有六项条件：普通桌面分成两行，超宽屏再并排展示，
      // 避免月份和日期控件在较窄桌面被压缩；客户视角仍维持四项紧凑布局。
      gridClassName={
        hideCustomerFilter
          ? "md:grid-cols-2 xl:grid-cols-4"
          : "md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
      }
      onExitExactSearch={onExitExactSearch}
      onPresetChange={onSelectDatePreset}
      onReset={onClear}
      primary={
        <DashboardFilterField label={uiText("attribute001")}>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <FormControls.Input
              className={`${dashboardFilterInputClassName} min-w-0`}
              onChange={(event) => onUpdate("searchText", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && filters.searchText.trim()) {
                  event.preventDefault();
                  onExactSearch();
                }
              }}
              placeholder={uiText("attribute002")}
              type="search"
              value={filters.searchText}
            />
            <Button
              className="shrink-0"
              disabled={!filters.searchText.trim()}
              onClick={onExactSearch}
              type="button"
              variant="outline"
              size="compact"
            >
              <Search className="size-4" />
              {frameworkT("exactSearch.action")}
            </Button>
          </div>
        </DashboardFilterField>
      }
      resetDisabled={!hasActiveFilters}
    >
      <DashboardFilterField label={uiText("attribute003")}>
        <Select
          aria-label={uiText("attribute003")}
          onValueChange={(value) =>
            onUpdate("status", value as WholesaleOrderFilters["status"])
          }
          options={[
            {
              label: (
                <UiMessage id="components_dashboard_wholesale_wholesale_order_filters.text004" />
              ),
              value: "all",
            },
            {
              label: (
                <UiMessage id="components_dashboard_wholesale_wholesale_order_filters.text005" />
              ),
              value: "unsettled",
            },
            {
              label: (
                <UiMessage id="components_dashboard_wholesale_wholesale_order_filters.text006" />
              ),
              value: "partial_settled",
            },
            {
              label: (
                <UiMessage id="components_dashboard_wholesale_wholesale_order_filters.text007" />
              ),
              value: "settled",
            },
          ]}
          value={filters.status}
        />
      </DashboardFilterField>
      {!hideCustomerFilter ? (
        <DashboardFilterField label={uiText("attribute004")}>
          <Select
            aria-label={uiText("attribute004")}
            onValueChange={(value) => onUpdate("customerId", value)}
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_order_filters.text008" />
                ),
                value: "",
              },
              ...customers.map((customer) => ({
                label: customer.unique_name,
                value: customer.id,
              })),
            ]}
            value={filters.customerId}
          />
        </DashboardFilterField>
      ) : null}
      <DashboardFilterField label={uiText("attribute005")}>
        <Select
          aria-label={uiText("attribute005")}
          onValueChange={(value) => onUpdate("salesUserId", value)}
          options={[
            {
              label: (
                <UiMessage id="components_dashboard_wholesale_wholesale_order_filters.text009" />
              ),
              value: "",
            },
            ...salesAccounts.map((profile) => ({
              label: profile.name || profile.email,
              value: profile.user_id,
            })),
          ]}
          value={filters.salesUserId}
        />
      </DashboardFilterField>
      {!hideOrderMonthFilter ? (
        <DashboardFilterField label={uiText("attribute008")}>
          <DatePicker
            aria-label={uiText("attribute008")}
            mode="month"
            onValueChange={(nextMonth) => onUpdate("orderMonth", nextMonth)}
            value={filters.orderMonth}
          />
        </DashboardFilterField>
      ) : null}
      <DashboardFilterField
        controlId="wholesale-order-date-from"
        label={uiText("attribute006")}
      >
        <DatePicker
          onValueChange={(nextDate) => {
            onUpdate("orderedFromDate", nextDate);
            if (
              filters.orderedToDate &&
              nextDate &&
              filters.orderedToDate < nextDate
            ) {
              onUpdate("orderedToDate", nextDate);
            }
          }}
          required
          value={filters.orderedFromDate}
        />
      </DashboardFilterField>
      <DashboardFilterField label={uiText("attribute007")}>
        <DatePicker
          min={filters.orderedFromDate || undefined}
          onValueChange={(nextDate) => onUpdate("orderedToDate", nextDate)}
          required
          value={filters.orderedToDate}
        />
      </DashboardFilterField>
    </DashboardOrderFilterSection>
  );
}
