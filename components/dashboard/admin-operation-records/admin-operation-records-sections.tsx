"use client";

import { DashboardPagedRecords } from "@/components/dashboard/dashboard-paged-records";

import { Select } from "@/components/ui/select";

import { Filter, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  DashboardFilterField,
  DashboardListSection,
  DashboardSearchInput,
  DashboardTableFrame,
} from "@/components/dashboard/dashboard-section-panel";
import { DashboardResourceFilterSection } from "@/components/dashboard/dashboard-resource-filter-section";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { EmptyState } from "@/components/dashboard/dashboard-shared-ui";
import type { AdminOperationRecord } from "@/lib/admin-operation-records-contract";
import type { Locale } from "@/lib/locale";

import { OperationRecordRow } from "./admin-operation-records-row";
import type { useAdminOperationRecordsViewModel } from "./use-admin-operation-records-view-model";

type OperationRecordsViewModel = ReturnType<
  typeof useAdminOperationRecordsViewModel
>;

export function OperationRecordsHeaderSection() {
  const t = useTranslations("OperationRecords");

  return (
    <DashboardSectionHeader
      presentation="work"
      title={t("header.title")}
    />
  );
}

export function OperationRecordsNoPermissionSection() {
  const t = useTranslations("OperationRecords");

  return (
    <DashboardListSection>
      <EmptyState
        description={t("states.noPermissionDescription")}
        icon={<ShieldAlert className="size-5" />}
        title={t("states.noPermissionTitle")}
      />
    </DashboardListSection>
  );
}

export function OperationRecordsFilterSection({
  actionFilter,
  actionLabels,
  actionOptions,
  categoryFilter,
  categoryLabels,
  categoryOptions,
  onActionFilterChange,
  onCategoryFilterChange,
  onReset,
  onSearchTextChange,
  searchText,
}: {
  actionFilter: string;
  actionLabels: OperationRecordsViewModel["actionLabels"];
  actionOptions: OperationRecordsViewModel["actionOptions"];
  categoryFilter: string;
  categoryLabels: OperationRecordsViewModel["categoryLabels"];
  categoryOptions: OperationRecordsViewModel["categoryOptions"];
  onActionFilterChange: (value: string) => void;
  onCategoryFilterChange: (value: string) => void;
  onReset: () => void;
  onSearchTextChange: (value: string) => void;
  searchText: string;
}) {
  const t = useTranslations("OperationRecords");

  return (
    <DashboardResourceFilterSection
      activeFilterCount={[
        Boolean(searchText),
        categoryFilter !== "all",
        actionFilter !== "all",
      ].filter(Boolean).length}
      gridClassName="sm:grid-cols-2"
      onReset={onReset}
      primary={
        <DashboardFilterField label={t("filters.search")}>
          <DashboardSearchInput
            onChange={onSearchTextChange}
            placeholder={t("filters.searchPlaceholder")}
            value={searchText}
          />
        </DashboardFilterField>
      }
      resetDisabled={
        !searchText && categoryFilter === "all" && actionFilter === "all"
      }
    >
      <DashboardFilterField label={t("filters.category")}>
        <Select
          onValueChange={onCategoryFilterChange}
          options={[
            { label: t("filters.allCategories"), value: "all" },
            ...categoryOptions.map((category) => ({
              label: categoryLabels[category],
              value: category,
            })),
          ]}
          value={categoryFilter}
        />
      </DashboardFilterField>

      <DashboardFilterField label={t("filters.action")}>
        <Select
          onValueChange={onActionFilterChange}
          options={[
            { label: t("filters.allActions"), value: "all" },
            ...actionOptions.map((action) => ({
              label: actionLabels[action],
              value: action,
            })),
          ]}
          value={actionFilter}
        />
      </DashboardFilterField>
    </DashboardResourceFilterSection>
  );
}

export function OperationRecordsListSection({
  paginationKey,
  actionLabels,
  categoryLabels,
  locale,
  records,
  roleLabels,
  statusLabels,
}: {
  paginationKey: string;
  actionLabels: OperationRecordsViewModel["actionLabels"];
  categoryLabels: OperationRecordsViewModel["categoryLabels"];
  locale: Locale;
  records: AdminOperationRecord[];
  roleLabels: OperationRecordsViewModel["roleLabels"];
  statusLabels: OperationRecordsViewModel["statusLabels"];
}) {
  const t = useTranslations("OperationRecords");

  return (
    <DashboardListSection ariaLabel={t("list.title")}>
      <DashboardPagedRecords items={records}
        queryKey={paginationKey}>
        {(pageRows) => (
          <>
          {records.length === 0 ? (
            <EmptyState
              description={t("list.emptyDescription")}
              icon={<Filter className="size-5" />}
              title={t("list.emptyTitle")}
            />
          ) : (
            <DashboardTableFrame>
              <table className="min-w-[1080px] w-full text-left text-sm">
                <thead className="bg-surface-inset text-xs font-semibold text-content-muted">
                  <tr>
                    <th className="px-4 py-3">{t("list.columns.time")}</th>
                    <th className="px-4 py-3">{t("list.columns.category")}</th>
                    <th className="px-4 py-3">{t("list.columns.action")}</th>
                    <th className="px-4 py-3">{t("list.columns.subject")}</th>
                    <th className="px-4 py-3">{t("list.columns.actor")}</th>
                    <th className="px-4 py-3">{t("list.columns.detail")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {pageRows.map((record) => (
                    <OperationRecordRow
                      actionLabels={actionLabels}
                      categoryLabels={categoryLabels}
                      key={record.id}
                      locale={locale}
                      record={record}
                      roleLabels={roleLabels}
                      statusLabels={statusLabels}
                    />
                  ))}
                </tbody>
              </table>
            </DashboardTableFrame>
          )}
          </>
        )}
      </DashboardPagedRecords>
    </DashboardListSection>
  );
}
