"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import type { AdminOperationRecordsPageData } from "@/lib/admin-operation-records-contract";

import {
  OperationRecordsFilterSection,
  OperationRecordsHeaderSection,
  OperationRecordsListSection,
  OperationRecordsNoPermissionSection,
} from "./admin-operation-records-sections";
import { useAdminOperationRecordsViewModel } from "./use-admin-operation-records-view-model";

export function AdminOperationRecordsClient({
  initialData,
}: {
  initialData: AdminOperationRecordsPageData;
}) {
  const { locale } = useLocale();
  const viewModel = useAdminOperationRecordsViewModel({ initialData });

  return (
    <DashboardPageShell header={<OperationRecordsHeaderSection />}>
      {!viewModel.hasPermission ? (
        <OperationRecordsNoPermissionSection />
      ) : (
        <>
          <OperationRecordsFilterSection
            actionFilter={viewModel.actionFilter}
            actionLabels={viewModel.actionLabels}
            actionOptions={viewModel.actionOptions}
            categoryFilter={viewModel.categoryFilter}
            categoryLabels={viewModel.categoryLabels}
            categoryOptions={viewModel.categoryOptions}
            onActionFilterChange={viewModel.setActionFilter}
            onCategoryFilterChange={viewModel.setCategoryFilter}
            onReset={viewModel.resetFilters}
            onSearchTextChange={viewModel.setSearchText}
            searchText={viewModel.searchText}
          />

          <OperationRecordsListSection
            paginationKey={viewModel.paginationKey}
            actionLabels={viewModel.actionLabels}
            categoryLabels={viewModel.categoryLabels}
            locale={locale}
            records={viewModel.filteredRecords}
            roleLabels={viewModel.roleLabels}
            statusLabels={viewModel.statusLabels}
          />
        </>
      )}
    </DashboardPageShell>
  );
}
