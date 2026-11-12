"use client";

import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";

import type { SalesmanTaskRow } from "@/lib/salesman-tasks";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import {
  cancelTaskReviewSubmissionDraft,
  createTaskReviewSubmissionDraft,
} from "@/lib/task-review-draft-mutations";
import {
  uploadTaskReviewSubmissionAssets,
  validateTaskReviewSubmissionFiles,
} from "@/lib/task-review-assets";
import {
  finalizeTaskReviewSubmission,
  TaskReviewAttachmentCleanupError,
  TaskReviewSubmissionUnconfirmedError,
} from "@/lib/task-review-submission-flow";
import { type FeedbackTone } from "@/components/dashboard/dashboard-shared-ui";
import { toSalesmanTaskErrorMessage } from "@/components/dashboard/tasks/tasks-display";

type PageFeedback = { tone: FeedbackTone; message: string } | null;

// 提审弹窗完整管理草稿、文件上传、提交和失败回滚，任务页只需要负责打开弹窗。
export function useSalesmanTaskReviewDialog({
  refreshTaskBoard,
  setPageFeedback,
  viewerId,
}: {
  refreshTaskBoard: () => void;
  setPageFeedback: Dispatch<SetStateAction<PageFeedback>>;
  viewerId: string | null;
}) {
  const supabase = getBrowserSupabaseClient();
  const t = useTranslations("Tasks.salesman");
  const sharedT = useTranslations("Tasks.shared");
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState<SalesmanTaskRow | null>(null);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [feedback, setFeedback] = useState<PageFeedback>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  const reset = useCallback(() => {
    setOpen(false);
    setTask(null);
    setNote("");
    setFiles([]);
    setFeedback(null);
    setPending(false);
  }, []);

  const openForTask = useCallback((nextTask: SalesmanTaskRow) => {
    setTask(nextTask);
    setOpen(true);
    setNote("");
    setFiles([]);
    setFeedback(null);
  }, []);

  const onOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setOpen(true);
        return;
      }
      if (!submitting.current) reset();
    },
    [reset],
  );

  const submit = useCallback(async () => {
    if (!supabase || !task || !viewerId || submitting.current) return;

    try {
      validateTaskReviewSubmissionFiles(files, {
        requireFiles: task.review_requires_attachment,
      });
      if (!task.review_requires_attachment && !note.trim()) {
        throw new Error("task review submission note is required");
      }
    } catch (error) {
      setFeedback({ tone: "error", message: toSalesmanTaskErrorMessage(error, sharedT) });
      return;
    }

    // 即使 React 尚未来得及更新按钮，也只能创建一份提审草稿。
    submitting.current = true;
    setPending(true);
    setFeedback(null);
    setPageFeedback(null);
    try {
      const draft = await createTaskReviewSubmissionDraft(supabase, {
        acceptanceId: task.id,
        submissionNote: note,
      });
      // 校验归属后才可使用返回的编号上传附件或取消草稿。
      if (draft.acceptance_id !== task.id || draft.submitted_by_user_id !== viewerId || draft.status !== "draft") {
        throw new TaskReviewSubmissionUnconfirmedError();
      }
      const assets = await uploadTaskReviewSubmissionAssets(supabase, {
        submissionId: draft.id,
        uploadedByUserId: viewerId,
        files,
        requireFiles: task.review_requires_attachment,
      }).catch(async (error: unknown) => {
        // 上传阶段尚未提交。上传函数处理已登记文件，取消只针对这份草稿。
        await cancelTaskReviewSubmissionDraft(supabase, draft.id).catch(() => {
          throw new TaskReviewSubmissionUnconfirmedError();
        });
        throw error;
      });
      await finalizeTaskReviewSubmission(supabase, {
        acceptanceId: task.id,
        submissionId: draft.id,
        viewerId,
        assets,
      });

      const wasRejected = task.status === "rejected";
      reset();
      setPageFeedback({
        tone: "success",
        message: wasRejected ? t("feedback.reviewResubmitted") : t("feedback.reviewSubmitted"),
      });
      refreshTaskBoard();
    } catch (error) {
      if (error instanceof TaskReviewSubmissionUnconfirmedError || error instanceof TaskReviewAttachmentCleanupError) {
        reset();
        setPageFeedback({
          tone: "error",
          message: t(error instanceof TaskReviewAttachmentCleanupError
            ? "feedback.reviewCleanupIncomplete"
            : "feedback.reviewUnconfirmed"),
        });
        refreshTaskBoard();
      } else {
        setFeedback({ tone: "error", message: toSalesmanTaskErrorMessage(error, sharedT) });
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }, [files, note, refreshTaskBoard, reset, setPageFeedback, sharedT, supabase, t, task, viewerId]);

  return { feedback, files, note, onOpenChange, open, openForTask, pending, setFiles, setNote, submit, task };
}
