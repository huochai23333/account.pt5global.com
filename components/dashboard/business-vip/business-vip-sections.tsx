"use client";

import { DashboardPagedRecords } from "@/components/dashboard/dashboard-paged-records";

import { Select } from "@/components/ui/select";

import { BadgeCheck, Clock3, Filter, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  DashboardFilterField,
  DashboardListSection,
  DashboardSearchInput,
} from "@/components/dashboard/dashboard-section-panel";
import { DashboardResourceFilterSection } from "@/components/dashboard/dashboard-resource-filter-section";
import { DashboardOperationalSummary } from "@/components/dashboard/dashboard-operational-summary";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { EmptyState } from "@/components/dashboard/dashboard-shared-ui";
import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import type {
  BusinessVipMembershipAction,
  BusinessVipPageData,
  BusinessVipRequest,
  BusinessVipReviewAction,
  BusinessVipRow,
} from "@/lib/business-vip-management";
import type { Locale } from "@/lib/locale";

import {
  BUSINESS_VIP_STATUS_FILTERS,
  type BusinessVipStatusFilter,
} from "./business-vip-display";
import {
  BusinessVipMobileCard,
  BusinessVipTable,
} from "./business-vip-row-list";
import { BusinessVipWholesaleCustomerList } from "./business-vip-wholesale-list";
import { BusinessVipWholesaleRecordTable } from "./business-vip-wholesale-records";

export function BusinessVipHeaderSection({
  data,
  summary,
}: {
  data: BusinessVipPageData;
  summary: { activeCount: number; pendingCount: number; totalCount: number };
}) {
  const t = useTranslations("BusinessVip");
  const summaryItems = [
    {
      icon: <UserRound className="size-4" />,
      id: "total",
      label: t("summary.total"),
      tone: "info" as const,
      value: summary.totalCount,
    },
    {
      icon: <BadgeCheck className="size-4" />,
      id: "active",
      label: t("summary.active"),
      tone: "success" as const,
      value: summary.activeCount,
    },
    ...(data.business === "wholesale"
      ? []
      : [
          {
            icon: <Clock3 className="size-4" />,
            id: "pending",
            label: t("summary.pending"),
            tone: "warning" as const,
            value: summary.pendingCount,
          },
        ]),
  ];

  return (
    <div className="space-y-3">
      <DashboardSectionHeader
        meta={t(`business.${data.business}`)}
        presentation="work"
        title={t("header.title")}
      />
      <DashboardOperationalSummary primaryItems={summaryItems} />
    </div>
  );
}

export function BusinessVipFiltersSection({
  onSearchTextChange,
  onStatusFilterChange,
  searchText,
  statusFilter,
}: {
  onSearchTextChange: (value: string) => void;
  onStatusFilterChange: (value: BusinessVipStatusFilter) => void;
  searchText: string;
  statusFilter: BusinessVipStatusFilter;
}) {
  const t = useTranslations("BusinessVip");

  return (
    <DashboardResourceFilterSection
      activeFilterCount={[
        Boolean(searchText),
        statusFilter !== "all",
      ].filter(Boolean).length}
      onReset={() => {
        onSearchTextChange("");
        onStatusFilterChange("all");
      }}
      primary={
        <DashboardFilterField label={t("filters.search")}>
          <DashboardSearchInput
            onChange={onSearchTextChange}
            placeholder={t("filters.searchPlaceholder")}
            value={searchText}
          />
        </DashboardFilterField>
      }
      resetDisabled={!searchText && statusFilter === "all"}
    >
      <DashboardFilterField label={t("filters.status")}>
        <Select
          onValueChange={onStatusFilterChange}
          options={BUSINESS_VIP_STATUS_FILTERS.map((filter) => ({
            label: t(`filters.statusOptions.${filter}`),
            value: filter,
          }))}
          value={statusFilter}
        />
      </DashboardFilterField>
    </DashboardResourceFilterSection>
  );
}

export function BusinessVipDirectorySection({
  paginationKey,
  business,
  canAdmin,
  canRequest,
  filteredRows,
  locale,
  onOpenAdjust,
  onOpenRequest,
  onOpenReview,
  onOpenWholesaleAction,
  onOpenWholesaleRecords,
  pendingActionKey,
}: {
  paginationKey: string;
  business: BusinessVipPageData["business"];
  canAdmin: boolean;
  canRequest: boolean;
  filteredRows: BusinessVipRow[];
  locale: Locale;
  onOpenAdjust: (row: BusinessVipRow) => void;
  onOpenRequest: (row: BusinessVipRow) => void;
  onOpenReview: (
    row: BusinessVipRow,
    request: BusinessVipRequest,
    action: BusinessVipReviewAction,
  ) => void;
  onOpenWholesaleAction: (
    row: BusinessVipRow,
    action: BusinessVipMembershipAction,
  ) => void;
  onOpenWholesaleRecords: (row: BusinessVipRow) => void;
  pendingActionKey: string | null;
}) {
  const t = useTranslations("BusinessVip");

  if (business === "wholesale") {
    return (
      <>
        <DashboardListSection
          title={t("directory.wholesaleTitle")}
        >
          {filteredRows.length === 0 ? (
            <EmptyState
              description={t("directory.emptyDescription")}
              icon={<Filter className="size-5" />}
              title={t("directory.emptyTitle")}
            />
          ) : (
            <DashboardPagedRecords items={filteredRows}
              queryKey={paginationKey}>
              {(pageRows) => (
                <>
                <BusinessVipWholesaleCustomerList
                  canManage={canAdmin || canRequest}
                  locale={locale}
                  onOpenAction={onOpenWholesaleAction}
                  onOpenRecords={onOpenWholesaleRecords}
                  pendingActionKey={pendingActionKey}
                  rows={pageRows}
                />
                </>
              )}
            </DashboardPagedRecords>
          )}
        </DashboardListSection>
        <DashboardListSection
          title={t("operationRecords.title")}
        >
          <BusinessVipWholesaleRecordTable
            locale={locale}
            rows={filteredRows}
            paginationKey={paginationKey}
          />
        </DashboardListSection>
      </>
    );
  }

  return (
    <DashboardListSection ariaLabel={t("directory.title")}>
      {filteredRows.length === 0 ? (
        <EmptyState
          description={t("directory.emptyDescription")}
          icon={<Filter className="size-5" />}
          title={t("directory.emptyTitle")}
        />
      ) : (
        <DashboardPagedRecords items={filteredRows}
          queryKey={paginationKey}>
          {(pageRows) => (
            <>
            <ResponsiveDataView
              breakpoint="lg"
              desktop={
                <BusinessVipTable
                  canAdmin={canAdmin}
                  canRequest={canRequest}
                  locale={locale}
                  onOpenAdjust={onOpenAdjust}
                  onOpenRequest={onOpenRequest}
                  onOpenReview={onOpenReview}
                  pendingActionKey={pendingActionKey}
                  rows={pageRows}
                />
              }
              mobile={
                <>
                  {pageRows.map((row) => (
                    <BusinessVipMobileCard
                      canAdmin={canAdmin}
                      canRequest={canRequest}
                      key={row.targetId}
                      locale={locale}
                      onOpenAdjust={onOpenAdjust}
                      onOpenRequest={onOpenRequest}
                      onOpenReview={onOpenReview}
                      pendingActionKey={pendingActionKey}
                      row={row}
                    />
                  ))}
                </>
              }
            />
            </>
          )}
        </DashboardPagedRecords>
      )}
    </DashboardListSection>
  );
}
