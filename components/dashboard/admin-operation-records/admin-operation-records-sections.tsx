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
import type { AdminOperationRecord } from "@/lib/admin-operation-records";
import type { Locale } from "@/lib/locale";

import {
  formatOperationDate,
  getOperationUserContact,
  getOperationUserLabel,
  getRoleChangeLabel,
  getStatusChangeLabel,
} from "./admin-operation-records-display";
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
  feedbackStatusLabels,
  locale,
  records,
  roleLabels,
  statusLabels,
}: {
  paginationKey: string;
  actionLabels: OperationRecordsViewModel["actionLabels"];
  categoryLabels: OperationRecordsViewModel["categoryLabels"];
  feedbackStatusLabels: OperationRecordsViewModel["feedbackStatusLabels"];
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
                      feedbackStatusLabels={feedbackStatusLabels}
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

function OperationRecordRow({
  actionLabels,
  categoryLabels,
  feedbackStatusLabels,
  locale,
  record,
  roleLabels,
  statusLabels,
}: {
  actionLabels: OperationRecordsViewModel["actionLabels"];
  categoryLabels: OperationRecordsViewModel["categoryLabels"];
  feedbackStatusLabels: OperationRecordsViewModel["feedbackStatusLabels"];
  locale: Locale;
  record: AdminOperationRecord;
  roleLabels: OperationRecordsViewModel["roleLabels"];
  statusLabels: OperationRecordsViewModel["statusLabels"];
}) {
  const t = useTranslations("OperationRecords");
  const fallback = t("fallback.notProvided");

  return (
    <tr className="align-top text-content-muted">
      <td className="px-4 py-4 text-xs leading-6 text-content-muted">
        {formatOperationDate(record.occurredAt, locale, fallback)}
      </td>
      <td className="px-4 py-4">
        <span className="inline-flex rounded-full bg-status-info-soft px-3 py-1 text-xs font-semibold text-primary">
          {categoryLabels[record.category]}
        </span>
      </td>
      <td className="px-4 py-4 font-semibold text-content-strong">
        {actionLabels[record.action]}
      </td>
      <td className="px-4 py-4">
        <p className="font-semibold text-content-strong">
          {getOperationUserLabel(record.subject, fallback)}
        </p>
        <p className="mt-1 text-xs text-content-muted">
          {getOperationUserContact(record.subject, fallback)}
        </p>
      </td>
      <td className="px-4 py-4">
        <p className="font-semibold text-content-strong">
          {getOperationUserLabel(record.actor, fallback)}
        </p>
        <p className="mt-1 text-xs text-content-muted">
          {getOperationUserContact(record.actor, fallback)}
        </p>
      </td>
      <td className="max-w-[340px] px-4 py-4 text-content-muted">
        <OperationRecordDetail
          feedbackStatusLabels={feedbackStatusLabels}
          record={record}
          roleLabels={roleLabels}
          statusLabels={statusLabels}
        />
      </td>
    </tr>
  );
}

function OperationRecordDetail({
  feedbackStatusLabels,
  record,
  roleLabels,
  statusLabels,
}: {
  feedbackStatusLabels: OperationRecordsViewModel["feedbackStatusLabels"];
  record: AdminOperationRecord;
  roleLabels: OperationRecordsViewModel["roleLabels"];
  statusLabels: OperationRecordsViewModel["statusLabels"];
}) {
  const t = useTranslations("OperationRecords");
  const fallback = t("fallback.notProvided");

  return (
    <div className="space-y-1.5 text-sm leading-6">
      {record.roleChange ? (
        <p>
          {t("detail.roleChange", {
            from: getRoleChangeLabel(
              record.roleChange.from,
              roleLabels,
              fallback,
            ),
            to: getRoleChangeLabel(record.roleChange.to, roleLabels, fallback),
          })}
        </p>
      ) : null}
      {record.statusChange && record.category !== "feedback" ? (
        <p>
          {t("detail.statusChange", {
            from: getStatusChangeLabel(
              record.statusChange.from,
              statusLabels,
              feedbackStatusLabels,
              fallback,
            ),
            to: getStatusChangeLabel(
              record.statusChange.to,
              statusLabels,
              feedbackStatusLabels,
              fallback,
            ),
          })}
        </p>
      ) : null}
      {record.nameChange ? (
        <p>
          {t("detail.nameChange", {
            from: record.nameChange.from ?? fallback,
            to: record.nameChange.to ?? fallback,
          })}
        </p>
      ) : null}
      {record.cityChange ? (
        <p>
          {t("detail.cityChange", {
            from: record.cityChange.from ?? fallback,
            to: record.cityChange.to ?? fallback,
          })}
        </p>
      ) : null}
      {record.feedback ? (
        <>
          <p>{t("detail.feedbackTitle", { title: record.feedback.title })}</p>
          {record.statusChange ? (
            <p>
              {t("detail.feedbackStatus", {
                status: getStatusChangeLabel(
                  record.statusChange.to,
                  statusLabels,
                  feedbackStatusLabels,
                  fallback,
                ),
              })}
            </p>
          ) : null}
          <p className="break-all">
            {t("detail.feedbackSource", { path: record.feedback.sourcePath })}
          </p>
        </>
      ) : null}
      {record.note ? (
        <p>{t("detail.note", { note: record.note })}</p>
      ) : record.category === "account" ? (
        <p>{t("detail.noNote")}</p>
      ) : null}
    </div>
  );
}
