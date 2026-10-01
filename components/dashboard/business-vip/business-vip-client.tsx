"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import type { BusinessVipPageData } from "@/lib/business-vip-management";

import { BusinessVipDialogs } from "./business-vip-dialogs";
import {
  BusinessVipDirectorySection,
  BusinessVipFiltersSection,
  BusinessVipHeaderSection,
} from "./business-vip-sections";
import {
  BusinessVipWholesaleActionDialog,
  BusinessVipWholesaleRecordsDialog,
} from "./business-vip-wholesale-dialogs";
import { useBusinessVipViewModel } from "./use-business-vip-view-model";

/**
 * VIP 页面组件只负责把页面区块与 view-model 连接起来。
 * 筛选、网络请求、弹窗状态和成功失败反馈均由独立 hook 管理，避免页面组件同时承担多项职责。
 */
export function BusinessVipClient({
  initialData,
}: {
  initialData: BusinessVipPageData;
}) {
  const { locale } = useLocale();
  const viewModel = useBusinessVipViewModel(initialData);

  return (
    <DashboardPageShell
      feedback={viewModel.pageFeedback}
      header={
        <BusinessVipHeaderSection
          data={initialData}
          summary={viewModel.summary}
        />
      }
    >
      <BusinessVipFiltersSection
        onSearchTextChange={viewModel.setSearchText}
        onStatusFilterChange={viewModel.setStatusFilter}
        searchText={viewModel.searchText}
        statusFilter={viewModel.statusFilter}
      />

      <BusinessVipDirectorySection
          paginationKey={JSON.stringify([viewModel.searchText, viewModel.statusFilter])}
        business={initialData.business}
        canAdmin={initialData.canAdmin}
        canRequest={initialData.canRequest}
        filteredRows={viewModel.filteredRows}
        locale={locale}
        onOpenAdjust={viewModel.openAdjust}
        onOpenRequest={viewModel.openRequest}
        onOpenReview={viewModel.openReview}
        onOpenWholesaleAction={viewModel.openWholesaleAction}
        onOpenWholesaleRecords={viewModel.openWholesaleRecords}
        pendingActionKey={viewModel.pendingActionKey}
      />

      <BusinessVipDialogs
        dialog={viewModel.standardDialog}
        feedback={viewModel.dialogFeedback}
        onAdjust={viewModel.handleAdjust}
        onClose={viewModel.closeDialog}
        onRequest={viewModel.handleRequest}
        onReview={viewModel.handleReview}
        pending={viewModel.mutationPending}
      />
      {viewModel.wholesaleDialog?.kind === "wholesaleAction" ? (
        <BusinessVipWholesaleActionDialog
          dialog={viewModel.wholesaleDialog}
          feedback={viewModel.dialogFeedback}
          onClose={viewModel.closeDialog}
          onConfirm={viewModel.handleWholesaleAction}
          pending={viewModel.mutationPending}
        />
      ) : null}
      {viewModel.wholesaleDialog?.kind === "wholesaleRecords" ? (
        <BusinessVipWholesaleRecordsDialog
          dialog={viewModel.wholesaleDialog}
          locale={locale}
          onClose={viewModel.closeDialog}
        />
      ) : null}
    </DashboardPageShell>
  );
}
