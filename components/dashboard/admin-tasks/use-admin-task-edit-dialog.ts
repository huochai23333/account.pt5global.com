"use client";

import { useCallback, useMemo, useState } from "react";

import { useTranslations } from "next-intl";

import {
  updateAdminTask,
  type AdminTaskRow,
  type TaskTargetRole,
  type TaskTypeOption,
} from "@/lib/admin-tasks";
import { type getBrowserSupabaseClient } from "@/lib/supabase";

import {
  parseTaskAcceptanceLimitInput,
  parseTaskCommissionAmountInput,
  validateTaskDraft,
} from "@/components/dashboard/tasks/task-form-validation";
import { toAdminTaskErrorMessage } from "@/components/dashboard/tasks/tasks-display";

import {
  canEditTask,
  createTaskFormFromTask,
  changeTaskFormType,
  toggleTaskTargetRole,
  type CreateTaskFormState,
} from "./admin-tasks-utils";
import { type PageFeedbackValue } from "./admin-tasks-view-model-shared";

export function useAdminTaskEditDialog({
  onPageFeedback,
  refreshTaskBoard,
  supabase,
  taskTypeOptions,
  tasks,
}: {
  onPageFeedback: (feedback: PageFeedbackValue) => void;
  refreshTaskBoard: () => void;
  supabase: ReturnType<typeof getBrowserSupabaseClient>;
  taskTypeOptions: TaskTypeOption[];
  tasks: AdminTaskRow[];
}) {
  const t = useTranslations("Tasks.admin");
  const sharedT = useTranslations("Tasks.shared");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogFeedback, setEditDialogFeedback] = useState<PageFeedbackValue | null>(null);
  const [editPending, setEditPending] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editFormState, setEditFormState] = useState<CreateTaskFormState>({
    taskName: "",
    taskIntro: "",
    taskTypeCode: "",
    commissionAmount: "",
    acceptanceLimit: "1",
    acceptanceUnlimited: false,
    reviewRequiresAttachment: true,
    targetRoles: [],
    files: [],
  });

  const editingTask = useMemo(
    () => tasks.find((task) => task.id === editingTaskId) ?? null,
    [editingTaskId, tasks],
  );

  const handleEditDialogOpenChange = useCallback((open: boolean) => {
    setEditDialogOpen(open);

    if (!open) {
      setEditDialogFeedback(null);
      setEditingTaskId(null);
    }
  }, []);

  const openEditDialog = useCallback((task: AdminTaskRow) => {
    if (!canEditTask(task)) {
      return;
    }

    setEditingTaskId(task.id);
    setEditDialogFeedback(null);
    setEditFormState(createTaskFormFromTask(task));
    setEditDialogOpen(true);
  }, []);

  const updateEditField = useCallback(
    <Key extends keyof CreateTaskFormState>(
      key: Key,
      value: CreateTaskFormState[Key],
    ) => {
      setEditFormState((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [],
  );

  const handleEditTargetRoleToggle = useCallback((role: TaskTargetRole) => {
    setEditFormState((current) => ({
      ...current,
      targetRoles: toggleTaskTargetRole(current.targetRoles, role),
    }));
  }, []);

  const handleEditTaskTypeChange = useCallback(
    (taskTypeCode: string) => {
      setEditFormState((current) => changeTaskFormType(current, taskTypeCode, taskTypeOptions));
    },
    [taskTypeOptions],
  );

  const handleEditTask = useCallback(async () => {
    if (!supabase || !editingTask || !canEditTask(editingTask) || editPending) {
      return;
    }

    const validationMessage = validateTaskDraft(editFormState, t);

    if (validationMessage) {
      setEditDialogFeedback({
        tone: "error",
        message: validationMessage,
      });
      return;
    }

    setEditPending(true);
    setEditDialogFeedback(null);

    try {
      const result = await updateAdminTask(supabase, {
        taskId: editingTask.id,
        taskName: editFormState.taskName,
        taskIntro: editFormState.taskIntro,
        taskTypeCode: editFormState.taskTypeCode,
        commissionAmountRmb:
          parseTaskCommissionAmountInput(editFormState.commissionAmount) ?? 0,
        acceptanceLimit: parseTaskAcceptanceLimitInput(editFormState.acceptanceLimit) ?? 1,
        acceptanceUnlimited: editFormState.acceptanceUnlimited,
        reviewRequiresAttachment: editFormState.reviewRequiresAttachment,
        targetRoles: editFormState.targetRoles,
      });

      setEditDialogOpen(false);
      setEditingTaskId(null);
      onPageFeedback({
        tone: result.commissionSyncFailed ? "info" : "success",
        message: result.commissionSyncFailed
          ? t("feedback.updatedWithCommissionSyncWarning")
          : t("feedback.updated"),
      });
      refreshTaskBoard();
    } catch (error) {
      setEditDialogFeedback({
        tone: "error",
        message: toAdminTaskErrorMessage(error, sharedT),
      });
    } finally {
      setEditPending(false);
    }
  }, [editFormState, editPending, editingTask, onPageFeedback, refreshTaskBoard, sharedT, supabase, t]);

  return {
    editDialogFeedback,
    editDialogOpen: editDialogOpen && editingTask !== null,
    editFormState,
    editPending,
    editingTask,
    handleEditDialogOpenChange,
    handleEditTargetRoleToggle,
    handleEditTask,
    handleEditTaskTypeChange,
    openEditDialog,
    updateEditField,
  };
}
