"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import type { AdminWorkspaceFeedbackPageData } from "@/lib/workspace-feedback";

import {
  AdminFeedbackFilterSection,
  AdminFeedbackHeaderSection,
  AdminFeedbackListSection,
  AdminFeedbackNoPermissionSection,
} from "./admin-feedback-sections";
import { useAdminFeedbackViewModel } from "./use-admin-feedback-view-model";

export function AdminFeedbackClient({
  initialData,
}: {
  initialData: AdminWorkspaceFeedbackPageData;
}) {
  const { locale } = useLocale();
  const viewModel = useAdminFeedbackViewModel({ initialData });

  return (
    <DashboardPageShell
      feedback={viewModel.pageFeedback}
      header={<AdminFeedbackHeaderSection />}
    >
      {!viewModel.hasPermission ? (
        <AdminFeedbackNoPermissionSection />
      ) : (
        <>
          <AdminFeedbackFilterSection
            onReset={() => {
              viewModel.setSearchText("");
              viewModel.handleStatusFilterChange("all");
              viewModel.handleTypeFilterChange("all");
            }}
            onSearchTextChange={viewModel.setSearchText}
            onStatusFilterChange={viewModel.handleStatusFilterChange}
            onTypeFilterChange={viewModel.handleTypeFilterChange}
            searchText={viewModel.searchText}
            statusFilter={viewModel.statusFilter}
            statusLabels={viewModel.statusLabels}
            statusOptions={viewModel.statusOptions}
            typeFilter={viewModel.typeFilter}
            typeLabels={viewModel.typeLabels}
            typeOptions={viewModel.typeOptions}
          />

          <AdminFeedbackListSection
            paginationKey={JSON.stringify([viewModel.searchText, viewModel.statusFilter, viewModel.typeFilter])}
            feedbackItems={viewModel.filteredFeedback}
            locale={locale}
            onStatusChange={viewModel.handleStatusChange}
            pendingStatusId={viewModel.pendingStatusId}
            roleLabels={viewModel.roleLabels}
            statusLabels={viewModel.statusLabels}
            statusOptions={viewModel.statusOptions}
            typeLabels={viewModel.typeLabels}
          />
        </>
      )}
    </DashboardPageShell>
  );
}
