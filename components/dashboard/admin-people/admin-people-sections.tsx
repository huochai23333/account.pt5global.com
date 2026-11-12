"use client";

import { DashboardPagedRecords } from "@/components/dashboard/dashboard-paged-records";
import { Select } from "@/components/ui/select";
import {
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
} from "@/components/dashboard/dashboard-section-panel";
import { DashboardResourceFilterSection } from "@/components/dashboard/dashboard-resource-filter-section";
import { DashboardOperationalSummary } from "@/components/dashboard/dashboard-operational-summary";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { EmptyState } from "@/components/dashboard/dashboard-shared-ui";
import type { AdminPersonRow } from "@/lib/admin-people-contract";

import { PeopleTable } from "./admin-people-table";
import type { useAdminPeopleViewModel } from "./use-admin-people-view-model";

type AdminPeopleViewModel = ReturnType<typeof useAdminPeopleViewModel>;

// 这组页面区块只渲染视图模型提供的统计、权限状态和筛选结果。
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
