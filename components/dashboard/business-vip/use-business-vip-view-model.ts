"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type {
  BusinessVipAdjustmentAction,
  BusinessVipMembershipAction,
  BusinessVipPageData,
  BusinessVipRequest,
  BusinessVipReviewAction,
  BusinessVipRow,
} from "@/lib/business-vip-management";
import {
  businessVipRowMatchesFilters,
  getBusinessVipSummary,
  type BusinessVipStatusFilter,
} from "./business-vip-display";
import type { BusinessVipDialogState } from "./business-vip-dialogs";
import type { BusinessVipWholesaleDialogState } from "./business-vip-wholesale-dialogs";

import { useBusinessVipMutation } from "./use-business-vip-mutation";

type BusinessVipActiveDialogState = BusinessVipDialogState | BusinessVipWholesaleDialogState;

// 页面只协调筛选、当前弹窗和操作类型，提交的状态由专用 Hook 管理。
export function useBusinessVipViewModel(initialData: BusinessVipPageData) {
  const t = useTranslations("BusinessVip");
  const [dialog, setDialog] = useState<BusinessVipActiveDialogState>(null);
  const mutation = useBusinessVipMutation(() => setDialog(null));
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<BusinessVipStatusFilter>("all");

  const summary = useMemo(() => getBusinessVipSummary(initialData.rows), [initialData.rows]);
  const filteredRows = useMemo(
    () =>
      initialData.rows.filter((row) =>
        businessVipRowMatchesFilters({ row, searchText, statusFilter }),
      ),
    [initialData.rows, searchText, statusFilter],
  );
  function openDialog(nextDialog: BusinessVipActiveDialogState) {
    mutation.clearDialogFeedback();
    mutation.clearPageFeedback();
    setDialog(nextDialog);
  }

  function closeDialog() {
    if (mutation.mutationPending) return;
    mutation.clearDialogFeedback();
    setDialog(null);
  }

  function handleRequest(row: BusinessVipRow, note: string) {
    void mutation.submitMutation(
      `request:${row.targetId}`,
      { business: initialData.business, note, operation: "request", targetId: row.targetId },
      t("feedback.requested"),
    );
  }

  function handleReview(
    row: BusinessVipRow,
    request: BusinessVipRequest,
    action: BusinessVipReviewAction,
    note: string,
  ) {
    void mutation.submitMutation(
      `review:${request.id}`,
      { action, business: initialData.business, note, operation: "review", requestId: request.id },
      action === "approve" ? t("feedback.approved") : t("feedback.rejected"),
    );
  }

  function handleAdjust(
    row: BusinessVipRow,
    action: BusinessVipAdjustmentAction,
    nextExpiresAt: string | null,
    note: string,
  ) {
    void mutation.submitMutation(
      `adjust:${row.targetId}`,
      {
        action,
        business: initialData.business,
        nextExpiresAt,
        note,
        operation: "adjust",
        targetId: row.targetId,
      },
      t("feedback.adjusted"),
    );
  }

  function handleWholesaleAction(row: BusinessVipRow, action: BusinessVipMembershipAction) {
    void mutation.submitMutation(
      `wholesale:${action}:${row.targetId}`,
      {
        action,
        business: "wholesale",
        note: "",
        operation: "manageWholesale",
        targetId: row.targetId,
      },
      action === "open" ? t("feedback.wholesaleOpened") : t("feedback.wholesaleRenewed"),
    );
  }

  const wholesaleDialog = isBusinessVipWholesaleDialog(dialog) ? dialog : null;
  const standardDialog: BusinessVipDialogState = wholesaleDialog
    ? null
    : (dialog as BusinessVipDialogState);

  const confirmationRequired = wholesaleDialog?.kind === "wholesaleAction" &&
    mutation.isCustomerUnconfirmed(wholesaleDialog.row.targetId);

  return {
    closeDialog,
    confirmationRequired,
    dialogFeedback: mutation.dialogFeedback ?? (confirmationRequired ? mutation.unconfirmedFeedback : null),
    filteredRows,
    handleAdjust,
    handleRequest,
    handleReview,
    handleWholesaleAction,
    mutationPending: mutation.mutationPending,
    openAdjust: (row: BusinessVipRow) => openDialog({ kind: "adjust", row }),
    openRequest: (row: BusinessVipRow) => openDialog({ kind: "request", row }),
    openReview: (
      row: BusinessVipRow,
      request: BusinessVipRequest,
      action: BusinessVipReviewAction,
    ) => openDialog({ action, kind: "review", request, row }),
    openWholesaleAction: (row: BusinessVipRow, action: BusinessVipMembershipAction) =>
      openDialog({ action, kind: "wholesaleAction", row }),
    openWholesaleRecords: (row: BusinessVipRow) => openDialog({ kind: "wholesaleRecords", row }),
    pageFeedback: mutation.pageFeedback,
    pendingActionKey: mutation.pendingActionKey,
    searchText,
    setSearchText,
    setStatusFilter,
    standardDialog,
    statusFilter,
    summary,
    wholesaleDialog,
  };
}

function isBusinessVipWholesaleDialog(
  dialog: BusinessVipActiveDialogState,
): dialog is NonNullable<BusinessVipWholesaleDialogState> {
  return dialog?.kind === "wholesaleAction" || dialog?.kind === "wholesaleRecords";
}
