"use client";

import { DashboardPagedRecords } from "@/components/dashboard/dashboard-paged-records";

import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import { RecordCard } from "@/components/ui/data-display";

import { Select } from "@/components/ui/select";
import { UiMessage } from "@/components/i18n/ui-message";
import {
  Clock3,
  Filter,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DashboardFilterField,
  DashboardListSection,
  DashboardSearchInput,
  DashboardTableFrame,
} from "@/components/dashboard/dashboard-section-panel";
import { DashboardResourceFilterSection } from "@/components/dashboard/dashboard-resource-filter-section";
import { DashboardOperationalSummary } from "@/components/dashboard/dashboard-operational-summary";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { EmptyState } from "@/components/dashboard/dashboard-shared-ui";
import type {
  AdminPeopleChangeLogRow,
  AdminPersonRow,
} from "@/lib/admin-people";
import type { Locale } from "@/lib/locale";
import {
  formatPeopleDate,
  getRoleLabel,
  getStatusLabel,
} from "./admin-people-display";
import { PeopleTable } from "./admin-people-table";
import type { useAdminPeopleViewModel } from "./use-admin-people-view-model";
type AdminPeopleViewModel = ReturnType<typeof useAdminPeopleViewModel>;
export function AdminPeopleHeaderSection({
  summary,
}: {
  summary: AdminPeopleViewModel["summary"];
}) {
  const t = useTranslations("AdminPeople");
  return (
    <div className="space-y-3">
      <DashboardSectionHeader presentation="work" title={t("header.title")} />
      <DashboardOperationalSummary
        primaryItems={[
        {
          icon: <UsersRound className="size-4" />,
          id: "total",
          label: t("summary.total"),
          tone: "info",
          value: summary.totalCount,
        },
        {
          icon: <UserCheck className="size-4" />,
          id: "active",
          label: t("summary.active"),
          tone: "success",
          value: summary.activeCount,
        },
        {
          icon: <ShieldCheck className="size-4" />,
          id: "administrators",
          label: t("summary.administrators"),
          tone: "info",
          value: summary.administratorCount,
        },
        {
          icon: <ShieldAlert className="size-4" />,
          id: "suspended",
          label: t("summary.suspended"),
          tone: "warning",
          value: summary.suspendedCount,
        },
      ]}
      />
    </div>
  );
}
export function AdminPeopleNoPermissionSection() {
  const t = useTranslations("AdminPeople");
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
export function AdminPeopleDirectorySection({
  currentViewerId,
  filteredPeople,
  onAdjustPerson,
  onEditPersonNote,
  onReset,
  onRoleFilterChange,
  onSearchTextChange,
  onStatusFilterChange,
  roleFilter,
  roleLabels,
  roleOptions,
  searchText,
  statusFilter,
  statusLabels,
  statusOptions,
}: {
  currentViewerId: string | null;
  filteredPeople: AdminPersonRow[];
  onAdjustPerson: (person: AdminPersonRow) => void;
  onEditPersonNote: (person: AdminPersonRow) => void;
  onReset: () => void;
  onRoleFilterChange: (value: string) => void;
  onSearchTextChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  roleFilter: string;
  roleLabels: AdminPeopleViewModel["roleLabels"];
  roleOptions: AdminPeopleViewModel["roleOptions"];
  searchText: string;
  statusFilter: string;
  statusLabels: AdminPeopleViewModel["statusLabels"];
  statusOptions: AdminPeopleViewModel["statusOptions"];
}) {
  const t = useTranslations("AdminPeople");
  return (
    <DashboardListSection
      title={t("directory.title")}
    >
      <DashboardResourceFilterSection
        activeFilterCount={[
          Boolean(searchText),
          roleFilter !== "all",
          statusFilter !== "all",
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
          !searchText && roleFilter === "all" && statusFilter === "all"
        }
      >
        <DashboardFilterField label={t("filters.role")}>
          <Select
            onValueChange={onRoleFilterChange}
            options={[
              { label: t("filters.allRoles"), value: "all" },
              ...roleOptions.map((role) => ({
                label: roleLabels[role],
                value: role,
              })),
            ]}
            value={roleFilter}
          />
        </DashboardFilterField>

        <DashboardFilterField label={t("filters.status")}>
          <Select
            onValueChange={onStatusFilterChange}
            options={[
              { label: t("filters.allStatuses"), value: "all" },
              ...statusOptions.map((status) => ({
                label: statusLabels[status],
                value: status,
              })),
            ]}
            value={statusFilter}
          />
        </DashboardFilterField>
      </DashboardResourceFilterSection>

      <div className="mt-5">
        {filteredPeople.length === 0 ? (
          <EmptyState
            description={t("directory.emptyDescription")}
            icon={<Filter className="size-5" />}
            title={t("directory.emptyTitle")}
          />
        ) : (
          <DashboardPagedRecords items={filteredPeople}
            queryKey={JSON.stringify([searchText, roleFilter, statusFilter])}>
            {(pageRows) => (
              <>
              <PeopleTable
                currentViewerId={currentViewerId}
                onAdjustPerson={onAdjustPerson}
                onEditPersonNote={onEditPersonNote}
                people={pageRows}
                roleLabels={roleLabels}
                statusLabels={statusLabels}
              />
              </>
            )}
          </DashboardPagedRecords>
        )}
      </div>
    </DashboardListSection>
  );
}
export function AdminPeopleRecentChangesSection({
  changes,
  locale,
  roleLabels,
  statusLabels,
}: {
  changes: AdminPeopleChangeLogRow[];
  locale: Locale;
  roleLabels: AdminPeopleViewModel["roleLabels"];
  statusLabels: AdminPeopleViewModel["statusLabels"];
}) {
  const t = useTranslations("AdminPeople");
  const fallback = t("fallback.notProvided");
  return (
    <DashboardListSection
      title={t("logs.title")}
    >
      {changes.length === 0 ? (
        <EmptyState
          description={t("logs.emptyDescription")}
          icon={<Clock3 className="size-5" />}
          title={t("logs.emptyTitle")}
        />
      ) : (
        <>
          <ResponsiveDataView
            desktop={
              <>
                <DashboardTableFrame>
                  <table className="min-w-[900px] w-full text-left text-sm">
                    <thead className="bg-surface-inset text-xs font-semibold text-content-muted">
                      <tr>
                        <th className="px-4 py-3">
                          {t("logs.columns.target")}
                        </th>
                        <th className="px-4 py-3">
                          {t("logs.columns.change")}
                        </th>
                        <th className="px-4 py-3">{t("logs.columns.actor")}</th>
                        <th className="px-4 py-3">{t("logs.columns.note")}</th>
                        <th className="px-4 py-3">{t("logs.columns.time")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {changes.map((change) => (
                        <tr key={change.id} className="align-top">
                          <td className="px-4 py-4">
                            <p className="font-semibold text-content-strong">
                              {change.target_name ??
                                change.target_email ??
                                fallback}
                            </p>
                            <p className="mt-1 text-xs text-content-muted">
                              {change.target_email ?? fallback}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-content-muted">
                            <ChangeSummary
                              change={change}
                              fallback={fallback}
                              roleLabels={roleLabels}
                              statusLabels={statusLabels}
                            />
                          </td>
                          <td className="px-4 py-4 text-content-muted">
                            {change.actor_name ??
                              change.actor_email ??
                              fallback}
                          </td>
                          <td className="max-w-[260px] px-4 py-4 text-content-muted">
                            {change.note ?? t("logs.noNote")}
                          </td>
                          <td className="px-4 py-4 text-content-muted">
                            {formatPeopleDate(
                              change.created_at,
                              locale,
                              fallback,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DashboardTableFrame>
              </>
            }
            mobile={
              <>
                {changes.map((change) => (
                  <RecordCard key={change.id}>
                    <p className="font-semibold text-content-strong">
                      {change.target_name ?? change.target_email ?? fallback}
                    </p>
                    <p className="mt-1 break-all text-xs text-content-muted">
                      {change.target_email ?? fallback}
                    </p>
                    <div className="mt-3 text-sm leading-6 text-content-muted">
                      <ChangeSummary
                        change={change}
                        fallback={fallback}
                        roleLabels={roleLabels}
                        statusLabels={statusLabels}
                      />
                    </div>
                    <p className="mt-3 text-sm text-content-muted">
                      <UiMessage id="components_dashboard_admin_people_admin_people_sections.text001" />
                      {change.actor_name ?? change.actor_email ?? fallback}
                    </p>
                    <p className="mt-1 break-words text-sm text-content-muted">
                      <UiMessage id="components_dashboard_admin_people_admin_people_sections.text002" />
                      {change.note ?? t("logs.noNote")}
                    </p>
                    <p className="mt-1 text-xs text-content-muted">
                      {formatPeopleDate(change.created_at, locale, fallback)}
                    </p>
                  </RecordCard>
                ))}
              </>
            }
          />
        </>
      )}
    </DashboardListSection>
  );
}
function ChangeSummary({
  change,
  fallback,
  roleLabels,
  statusLabels,
}: {
  change: AdminPeopleChangeLogRow;
  fallback: string;
  roleLabels: AdminPeopleViewModel["roleLabels"];
  statusLabels: AdminPeopleViewModel["statusLabels"];
}) {
  const t = useTranslations("AdminPeople");
  return (
    <>
      <p>
        {getRoleLabel(change.previous_role, roleLabels, fallback)}
        {" -> "}
        {getRoleLabel(change.next_role, roleLabels, fallback)}
      </p>
      <p className="mt-1">
        {getStatusLabel(change.previous_status, statusLabels, fallback)}
        {" -> "}
        {getStatusLabel(change.next_status, statusLabels, fallback)}
      </p>
      {change.previous_city !== change.next_city ? (
        <p className="mt-1">
          {t("logs.cityChange", {
            from: change.previous_city ?? fallback,
            to: change.next_city ?? fallback,
          })}
        </p>
      ) : null}
    </>
  );
}
