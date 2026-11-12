"use client";

import { useCallback, useRef, useState } from "react";

import { useTranslations } from "next-intl";

import {
  createAdminTask,
  deleteAdminTask,
  type TaskTypeOption,
  uploadAdminTaskAttachments,
  validateAdminTaskAttachments,
  type TaskTargetRole,
} from "@/lib/admin-tasks";
import { type getBrowserSupabaseClient } from "@/lib/supabase";

import {
  parseTaskAcceptanceLimitInput,
  parseTaskCommissionAmountInput,
  validateTaskDraft,
} from "@/components/dashboard/tasks/task-form-validation";
import { toAdminTaskErrorMessage } from "@/components/dashboard/tasks/tasks-display";

import {
  createEmptyTaskForm,
  changeTaskFormType,
  toggleTaskTargetRole,
  type CreateTaskFormState,
} from "./admin-tasks-utils";
import { type PageFeedbackValue } from "./admin-tasks-view-model-shared";

export function useAdminTaskCreateDialog({
  canView,
  onPageFeedback,
  refreshTaskBoard,
  supabase,
  taskTypeOptions,
  viewerId,
}: {
  canView: boolean;
  onPageFeedback: (feedback: PageFeedbackValue) => void;
  refreshTaskBoard: () => void;
  supabase: ReturnType<typeof getBrowserSupabaseClient>;
  taskTypeOptions: TaskTypeOption[];
  viewerId: string | null;
}) {
  const t = useTranslations("Tasks.admin");
  const sharedT = useTranslations("Tasks.shared");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogFeedback, setCreateDialogFeedback] = useState<PageFeedbackValue | null>(
    null,
  );
  const [createPending, setCreatePending] = useState(false);
  const creating = useRef(false);
  const [createFormState, setCreateFormState] = useState<CreateTaskFormState>(
    () => createEmptyTaskForm(taskTypeOptions),
  );

  const handleCreateDialogOpenChange = useCallback((open: boolean) => {
    setCreateDialogOpen(open);

    if (!open) {
      setCreateDialogFeedback(null);
    }
  }, []);

  const openCreateDialog = useCallback(() => {
    setCreateDialogFeedback(null);
    setCreateFormState(createEmptyTaskForm(taskTypeOptions));
    setCreateDialogOpen(true);
  }, [taskTypeOptions]);

  const updateCreateField = useCallback(
    <Key extends keyof CreateTaskFormState>(
      key: Key,
      value: CreateTaskFormState[Key],
    ) => {
      setCreateFormState((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [],
  );

  const handleCreateTargetRoleToggle = useCallback((role: TaskTargetRole) => {
    setCreateFormState((current) => ({
      ...current,
      targetRoles: toggleTaskTargetRole(current.targetRoles, role),
    }));
  }, []);

  const handleCreateTaskTypeChange = useCallback(
    (taskTypeCode: string) => {
      setCreateFormState((current) => changeTaskFormType(current, taskTypeCode, taskTypeOptions));
    },
    [taskTypeOptions],
  );

  const handleCreateFilesChange = useCallback((files: File[]) => {
    setCreateFormState((current) => ({
      ...current,
      files,
    }));
  }, []);

  const removeCreateFile = useCallback((index: number) => {
    setCreateFormState((current) => ({
      ...current,
      files: current.files.filter((_, fileIndex) => fileIndex !== index),
    }));
  }, []);

  const handleCreateTask = useCallback(async () => {
    if (!supabase || !viewerId || !canView || creating.current) {
      return;
    }

    const validationMessage = validateTaskDraft(createFormState, t);

    if (validationMessage) {
      setCreateDialogFeedback({
        tone: "error",
        message: validationMessage,
      });
      return;
    }

    try {
      validateAdminTaskAttachments(createFormState.files);
    } catch (error) {
      setCreateDialogFeedback({
        tone: "error",
        message: toAdminTaskErrorMessage(error, sharedT),
      });
      return;
    }

    // 同一次表单保存只创建一条任务，避免同一帧的点击重复发布。
    creating.current = true;
    setCreatePending(true);
    setCreateDialogFeedback(null);

    try {
      const createdTask = await createAdminTask(supabase, {
        taskName: createFormState.taskName,
        taskIntro: createFormState.taskIntro,
        taskTypeCode: createFormState.taskTypeCode,
        commissionAmountRmb:
          parseTaskCommissionAmountInput(createFormState.commissionAmount) ?? 0,
        acceptanceLimit: parseTaskAcceptanceLimitInput(createFormState.acceptanceLimit) ?? 1,
        acceptanceUnlimited: createFormState.acceptanceUnlimited,
        reviewRequiresAttachment: createFormState.reviewRequiresAttachment,
        createdByUserId: viewerId,
        targetRoles: createFormState.targetRoles,
      });

      if (createFormState.files.length > 0) {
        try {
          await uploadAdminTaskAttachments(supabase, {
            taskId: createdTask.id,
            uploadedByUserId: viewerId,
            files: createFormState.files,
          });
        } catch (error) {
          const rollback = await deleteAdminTask(supabase, {
            id: createdTask.id,
            attachments: [],
          }).catch(() => null);
          if (rollback?.status !== "deleted") {
            // 任务可能仍存在，回列表核对后再创建，避免直接再发布一份。
            setCreateDialogOpen(false);
            onPageFeedback({ tone: "error", message: t("feedback.createCleanupUnconfirmed") });
            refreshTaskBoard();
            return;
          }

          throw error;
        }
      }

      setCreateDialogOpen(false);
      setCreateFormState(createEmptyTaskForm(taskTypeOptions));
      onPageFeedback({
        tone: "success",
        message:
          createFormState.files.length > 0
            ? t("feedback.createdWithAttachments")
            : t("feedback.created"),
      });
      refreshTaskBoard();
    } catch (error) {
      setCreateDialogFeedback({
        tone: "error",
        message: toAdminTaskErrorMessage(error, sharedT),
      });
    } finally {
      creating.current = false;
      setCreatePending(false);
    }
  }, [canView, createFormState, onPageFeedback, refreshTaskBoard, sharedT, supabase, t, taskTypeOptions, viewerId]);

  return {
    createDialogFeedback,
    createDialogOpen,
    createFormState,
    createPending,
    handleCreateDialogOpenChange,
    handleCreateFilesChange,
    handleCreateTargetRoleToggle,
    handleCreateTaskTypeChange,
    handleCreateTask,
    openCreateDialog,
    removeCreateFile,
    updateCreateField,
  };
}
