"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTranslations } from "next-intl";

import {
  getAdminTaskMediaLibraryKind,
} from "@/lib/admin-task-media-library";
import {
  getAdminTaskReviewBoardData,
  type AdminTaskReviewBoardData,
} from "@/lib/admin-task-reviews";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import {
  decideTaskReview,
  TaskReviewDecisionUnconfirmedError,
} from "@/lib/task-review-decisions";
import {
  downloadTaskReviewSubmissionAssetBlob,
  getTaskReviewSubmissionAssetSignedUrl,
  type TaskReviewSubmissionAsset,
} from "@/lib/task-review-assets";
import type { PendingTaskReviewWithAssets } from "@/lib/task-reviews";

import {
  createDashboardSharedCopy,
  getRawErrorMessage,
  toErrorMessage,
} from "../dashboard-shared-ui";
import { useWorkspaceSyncEffect } from "../workspace-session-provider";
import { useDashboardConfirm } from "../dashboard-confirm-provider";
import type {
  AdminTaskFilePreviewItem,
} from "./admin-task-file-preview-dialog";
import type { PageFeedback } from "./admin-tasks-view-model-shared";
import type { AdminTaskReviewAction } from "./admin-task-review-types";
import { downloadTaskFileBlob, useAdminTaskFilePreview } from "./use-admin-task-file-preview";

type PreviewTaskReviewAsset = AdminTaskFilePreviewItem & {
  asset: TaskReviewSubmissionAsset;
  submissionId: string;
};

export function useAdminTaskReviewBoard(initialData: AdminTaskReviewBoardData) {
  const confirm = useDashboardConfirm();
  const confirmT = useTranslations("DashboardFramework.confirm");
  const t = useTranslations("Tasks.admin");
  const reviewsT = useTranslations("ReviewsUI");
  const sharedT = useTranslations("DashboardShared");
  const sharedCopy = useMemo(() => createDashboardSharedCopy(sharedT), [sharedT]);
  const supabase = getBrowserSupabaseClient();

  const [canView, setCanView] = useState(initialData.canView);
  const [rows, setRows] = useState<PendingTaskReviewWithAssets[]>(initialData.rows);
  const [pageFeedback, setPageFeedback] = useState<PageFeedback>(null);
  const [busyRows, setBusyRows] = useState<Record<string, AdminTaskReviewAction>>({});
  const reviewingRows = useRef(new Set<string>());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const {
    closePreview: clearPreview,
    openPreview,
    previewBusyKey: assetBusyKey,
    previewItem: previewAsset,
  } = useAdminTaskFilePreview<PreviewTaskReviewAsset>();
  const [previewDownloadBusy, setPreviewDownloadBusy] = useState(false);

  const applyPageData = useCallback((pageData: AdminTaskReviewBoardData) => {
    setCanView(pageData.canView);
    setRows(pageData.rows);
  }, []);

  useEffect(() => {
    applyPageData(initialData);
  }, [applyPageData, initialData]);

  const refreshReviewBoard = useCallback(
    async ({ isMounted }: { isMounted: () => boolean }) => {
      if (!supabase) {
        return;
      }

      try {
        const nextPageData = await getAdminTaskReviewBoardData(supabase);

        if (!isMounted()) {
          return;
        }

        applyPageData(nextPageData);
        setPageFeedback(null);
      } catch (error) {
        if (!isMounted()) {
          return;
        }

        setPageFeedback({
          tone: "error",
          message: toErrorMessage(error, sharedCopy),
        });
      }
    },
    [applyPageData, sharedCopy, supabase],
  );

  useWorkspaceSyncEffect(refreshReviewBoard);

  const handleRefresh = useCallback(() => {
    if (!supabase || isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    void refreshReviewBoard({ isMounted: () => true }).finally(() => {
      setIsRefreshing(false);
    });
  }, [isRefreshing, refreshReviewBoard, supabase]);

  const setRowBusyState = useCallback(
    (rowKey: string, action: AdminTaskReviewAction | null) => {
      setBusyRows((current) => {
        if (!action) {
          const next = { ...current };
          delete next[rowKey];
          return next;
        }

        return {
          ...current,
          [rowKey]: action,
        };
      });
    },
    [],
  );

  const handleTaskReview = useCallback(
    async (row: PendingTaskReviewWithAssets, action: AdminTaskReviewAction) => {
      if (!supabase) {
        return;
      }

      const rowKey = `task:${row.acceptance_id}`;
      const actionLabel =
        action === "approve" ? reviewsT("actions.approve") : reviewsT("actions.reject");

      if (reviewingRows.current.has(rowKey)) {
        return;
      }

      // 确认弹窗出现前先占用领取编号，防止同一帧提交两个审核意图。
      reviewingRows.current.add(rowKey);
      try {
        if (!(await confirm({
          description: t("reviewBoard.confirm", { action: actionLabel }),
          title: confirmT("title"),
          tone: action === "reject" ? "warning" : "normal",
        }))) {
          return;
        }

        let rejectReason: string | null = null;
        if (action === "reject" && typeof window !== "undefined") {
          rejectReason = window.prompt(t("reviewBoard.rejectReasonPrompt"), "");
          if (rejectReason === null) return;
        }

        setRowBusyState(rowKey, action);
        setPageFeedback(null);
        await decideTaskReview(supabase, {
          action,
          acceptanceId: row.acceptance_id,
          submissionId: row.submission_id,
          reason: rejectReason,
        });

        // 刷新可能已经载入后续轮次，只移除已确认处理的那张卡片。
        setRows((current) =>
          current.filter((item) => item.submission_id !== row.submission_id),
        );
        setPageFeedback({
          tone: "success",
          message:
            action === "approve"
              ? t("reviewBoard.feedback.approved")
              : t("reviewBoard.feedback.rejected"),
        });
      } catch (error) {
        setPageFeedback({
          tone: "error",
          message: toAdminTaskReviewErrorMessage(error, t, sharedCopy),
        });
      } finally {
        reviewingRows.current.delete(rowKey);
        setRowBusyState(rowKey, null);
      }
    },
    [confirm, confirmT, reviewsT, setRowBusyState, sharedCopy, supabase, t],
  );

  const handleOpenAsset = useCallback(
    async (row: PendingTaskReviewWithAssets, asset: TaskReviewSubmissionAsset) => {
      if (!supabase) {
        return;
      }

      setPageFeedback(null);
      await openPreview(`${row.submission_id}:${asset.id}`, async () => ({
        asset,
        file_size_bytes: asset.file_size_bytes,
        id: asset.id,
        kind: getAdminTaskMediaLibraryKind(asset.mime_type, asset.original_name),
        mime_type: asset.mime_type,
        original_name: asset.original_name,
        signedUrl: await getTaskReviewSubmissionAssetSignedUrl(supabase, asset),
        submitted_at: row.submitted_at,
        submitted_by_name: row.accepted_by_name ?? row.accepted_by_email,
        submission_round: row.submission_round,
        submissionId: row.submission_id,
        task_name: row.task_name,
      }), (error) => setPageFeedback({ tone: "error", message: toErrorMessage(error, sharedCopy) }));
    },
    [openPreview, sharedCopy, supabase],
  );

  const handlePreviewDownload = useCallback(
    async (file: AdminTaskFilePreviewItem) => {
      const currentAsset = previewAsset && previewAsset.id === file.id ? previewAsset : null;

      if (!supabase || !currentAsset || previewDownloadBusy) {
        return;
      }

      setPreviewDownloadBusy(true);
      setPageFeedback(null);

      try {
        const blob = await downloadTaskReviewSubmissionAssetBlob(
          supabase,
          currentAsset.asset,
        );
        downloadTaskFileBlob(blob, currentAsset.original_name);
      } catch (error) {
        setPageFeedback({
          tone: "error",
          message: toErrorMessage(error, sharedCopy),
        });
      } finally {
        setPreviewDownloadBusy(false);
      }
    },
    [previewAsset, previewDownloadBusy, sharedCopy, supabase],
  );

  const closePreview = useCallback((open: boolean) => {
    if (!open) {
      clearPreview();
      setPreviewDownloadBusy(false);
    }
  }, [clearPreview]);

  return {
    assetBusyKey,
    busyRows,
    canView,
    closePreview,
    handleOpenAsset,
    handlePreviewDownload,
    handleRefresh,
    handleTaskReview,
    isRefreshing,
    pageFeedback,
    previewAsset,
    previewDownloadBusy,
    rows,
  };
}

function toAdminTaskReviewErrorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslations>,
  sharedCopy: ReturnType<typeof createDashboardSharedCopy>,
) {
  if (error instanceof TaskReviewDecisionUnconfirmedError) {
    return t("reviewBoard.errors.unconfirmed");
  }
  const rawMessage = getRawErrorMessage(error);
  const baseMessage = toErrorMessage(error, sharedCopy);

  if (rawMessage.includes("only administrator can approve task review")) {
    return t("reviewBoard.errors.noPermission");
  }

  if (rawMessage.includes("only administrator can reject task review")) {
    return t("reviewBoard.errors.noPermission");
  }

  if (rawMessage.includes("task is not in reviewing status")) {
    return t("reviewBoard.errors.notReviewing");
  }

  if (rawMessage.includes("task review submission changed")) {
    return t("reviewBoard.errors.submissionChanged");
  }

  if (rawMessage.includes("task review submission not found")) {
    return t("reviewBoard.errors.submissionMissing");
  }

  if (rawMessage.includes("task current submission is missing")) {
    return t("reviewBoard.errors.submissionMissing");
  }

  if (rawMessage.includes("task review submission is not pending")) {
    return t("reviewBoard.errors.submissionMissing");
  }

  if (rawMessage.includes("task not found")) {
    return t("reviewBoard.errors.taskMissing");
  }

  return baseMessage;
}
