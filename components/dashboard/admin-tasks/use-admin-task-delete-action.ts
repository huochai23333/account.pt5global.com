"use client";

import { useCallback, useRef, useState } from "react";

import { useTranslations } from "next-intl";

import {
  deleteAdminTask,
  type AdminTaskRow,
} from "@/lib/admin-tasks";
import { type getBrowserSupabaseClient } from "@/lib/supabase";

import { toAdminTaskErrorMessage } from "@/components/dashboard/tasks/tasks-display";

import { type PageFeedbackValue } from "./admin-tasks-view-model-shared";
import { useDashboardConfirm } from "../dashboard-confirm-provider";

export function useAdminTaskDeleteAction({
  onPageFeedback,
  refreshTaskBoard,
  supabase,
}: {
  onPageFeedback: (feedback: PageFeedbackValue) => void;
  refreshTaskBoard: () => void;
  supabase: ReturnType<typeof getBrowserSupabaseClient>;
}) {
  const confirm = useDashboardConfirm();
  const confirmT = useTranslations("DashboardFramework.confirm");
  const t = useTranslations("Tasks.admin");
  const sharedT = useTranslations("Tasks.shared");
  const [deletePendingTaskId, setDeletePendingTaskId] = useState<string | null>(null);
  const deleting = useRef(false);

  const handleDeleteTask = useCallback(
    async (task: AdminTaskRow) => {
      if (!supabase || deleting.current) {
        return;
      }

      const confirmMessage =
        task.status === "to_be_accepted" && task.accepted_count === 0
          ? t("confirmDelete", { taskName: task.task_name })
          : t("confirmDeleteWithHistory", { taskName: task.task_name });
      // 用户尚在确认时也要拦住连击，避免并发删除及清理同一份文件。
      deleting.current = true;
      try {
        if (!(await confirm({
          description: confirmMessage,
          title: confirmT("title"),
          tone: "danger",
        }))) return;

        setDeletePendingTaskId(task.id);
        const result = await deleteAdminTask(supabase, task);
        if (result.status === "deleted") {
          onPageFeedback({ tone: "success", message: t("feedback.deleted") });
        } else {
          const messageKey = result.stage === "attachments"
            ? "feedback.deletedWithAttachmentCleanupWarning"
            : "feedback.deleteUnconfirmed";
          onPageFeedback({ tone: "error", message: t(messageKey) });
        }
        refreshTaskBoard();
      } catch (error) {
        onPageFeedback({
          tone: "error",
          message: toAdminTaskErrorMessage(error, sharedT),
        });
      } finally {
        deleting.current = false;
        setDeletePendingTaskId(null);
      }
    },
    [confirm, confirmT, onPageFeedback, refreshTaskBoard, sharedT, supabase, t],
  );

  return {
    deletePendingTaskId,
    handleDeleteTask,
  };
}
