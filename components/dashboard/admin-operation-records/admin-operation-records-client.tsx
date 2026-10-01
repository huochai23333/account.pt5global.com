"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import type { AdminOperationRecordsPageData } from "@/lib/admin-operation-records";

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
            onReset={() => {
              viewModel.setSearchText("");
              viewModel.setCategoryFilter("all");
              viewModel.setActionFilter("all");
            }}
            onSearchTextChange={viewModel.setSearchText}
            searchText={viewModel.searchText}
          />

          <OperationRecordsListSection
          paginationKey={JSON.stringify([viewModel.searchText, viewModel.categoryFilter, viewModel.actionFilter])}
            actionLabels={viewModel.actionLabels}
            categoryLabels={viewModel.categoryLabels}
            feedbackStatusLabels={viewModel.feedbackStatusLabels}
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
