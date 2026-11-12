"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTranslations } from "next-intl";

import {
  createTaskType,
  deactivateTaskType,
  updateTaskType,
  type TaskTypeOption,
} from "@/lib/admin-tasks";
import { type getBrowserSupabaseClient } from "@/lib/supabase";

import { toAdminTaskErrorMessage } from "@/components/dashboard/tasks/tasks-display";

import { formatTaskCommissionInput } from "./admin-tasks-utils";
import { type PageFeedbackValue } from "./admin-tasks-view-model-shared";

export type TaskTypeFormState = {
  displayName: string;
  description: string;
  defaultCommissionAmount: string;
};

const emptyTaskTypeForm: TaskTypeFormState = {
  displayName: "",
  description: "",
  defaultCommissionAmount: "0.00",
};

export function useAdminTaskTypeManagementDialog({
  initialTaskTypeOptions,
  refreshTaskBoard,
  supabase,
}: {
  initialTaskTypeOptions: TaskTypeOption[];
  refreshTaskBoard: () => void;
  supabase: ReturnType<typeof getBrowserSupabaseClient>;
}) {
  const t = useTranslations("Tasks.admin");
  const sharedT = useTranslations("Tasks.shared");
  const [taskTypeDialogOpen, setTaskTypeDialogOpen] = useState(false);
  const [taskTypeDialogFeedback, setTaskTypeDialogFeedback] =
    useState<PageFeedbackValue | null>(null);
  const [taskTypePendingCode, setTaskTypePendingCode] = useState<string | null>(null);
  const [taskTypeFormPending, setTaskTypeFormPending] = useState(false);
  const writing = useRef(false);
  const [editingTaskTypeCode, setEditingTaskTypeCode] = useState<string | null>(null);
  const [taskTypeFormState, setTaskTypeFormState] =
    useState<TaskTypeFormState>(emptyTaskTypeForm);
  const [taskTypeOptions, setTaskTypeOptions] = useState<TaskTypeOption[]>(
    () => initialTaskTypeOptions,
  );

  useEffect(() => {
    setTaskTypeOptions(initialTaskTypeOptions);
  }, [initialTaskTypeOptions]);

  const editingTaskType = useMemo(
    () =>
      editingTaskTypeCode
        ? taskTypeOptions.find((taskType) => taskType.code === editingTaskTypeCode) ?? null
        : null,
    [editingTaskTypeCode, taskTypeOptions],
  );

  const handleTaskTypeDialogOpenChange = useCallback((open: boolean) => {
    setTaskTypeDialogOpen(open);

    if (!open) {
      setTaskTypeDialogFeedback(null);
      setEditingTaskTypeCode(null);
      setTaskTypeFormState(emptyTaskTypeForm);
    }
  }, []);

  const openTaskTypeDialog = useCallback(() => {
    setTaskTypeDialogFeedback(null);
    setEditingTaskTypeCode(null);
    setTaskTypeFormState(emptyTaskTypeForm);
    setTaskTypeDialogOpen(true);
  }, []);

  const startCreateTaskType = useCallback(() => {
    setTaskTypeDialogFeedback(null);
    setEditingTaskTypeCode(null);
    setTaskTypeFormState(emptyTaskTypeForm);
  }, []);

  const startEditTaskType = useCallback((taskType: TaskTypeOption) => {
    setTaskTypeDialogFeedback(null);
    setEditingTaskTypeCode(taskType.code);
    setTaskTypeFormState({
      displayName: taskType.displayName,
      description: taskType.description ?? "",
      defaultCommissionAmount: formatTaskCommissionInput(
        taskType.defaultCommissionAmountRmb,
      ),
    });
  }, []);

  const updateTaskTypeFormField = useCallback(
    <Key extends keyof TaskTypeFormState>(
      key: Key,
      value: TaskTypeFormState[Key],
    ) => {
      setTaskTypeFormState((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [],
  );

  const mergeTaskTypeOption = useCallback((taskType: TaskTypeOption) => {
    setTaskTypeOptions((current) =>
      sortTaskTypeOptions([
        ...current.filter((item) => item.code !== taskType.code),
        taskType,
      ]),
    );
  }, []);

  const handleSubmitTaskType = useCallback(async () => {
    if (!supabase || writing.current) {
      return;
    }

    const displayName = taskTypeFormState.displayName.trim();
    const defaultCommissionAmountRmb = Number(taskTypeFormState.defaultCommissionAmount);

    if (!displayName) {
      setTaskTypeDialogFeedback({
        tone: "error",
        message: t("taskTypes.validation.nameRequired"),
      });
      return;
    }

    if (!Number.isFinite(defaultCommissionAmountRmb) || defaultCommissionAmountRmb < 0) {
      setTaskTypeDialogFeedback({
        tone: "error",
        message: t("taskTypes.validation.commissionRequired"),
      });
      return;
    }

    // 保存和停用共用写入占用，避免状态更新前收到第二次点击。
    writing.current = true;
    setTaskTypeFormPending(true);
    setTaskTypeDialogFeedback(null);

    try {
      const savedTaskType = editingTaskType
        ? await updateTaskType(supabase, {
            code: editingTaskType.code,
            displayName,
            description: taskTypeFormState.description,
            defaultCommissionAmountRmb,
          })
        : await createTaskType(supabase, {
            displayName,
            description: taskTypeFormState.description,
            defaultCommissionAmountRmb,
          });

      mergeTaskTypeOption(savedTaskType);
      setTaskTypeFormState(emptyTaskTypeForm);
      setEditingTaskTypeCode(null);
      setTaskTypeDialogFeedback({
        tone: "success",
        message: editingTaskType
          ? t("taskTypes.feedback.updated")
          : t("taskTypes.feedback.created"),
      });
      refreshTaskBoard();
    } catch (error) {
      setTaskTypeDialogFeedback({
        tone: "error",
        message: toAdminTaskErrorMessage(error, sharedT),
      });
    } finally {
      writing.current = false;
      setTaskTypeFormPending(false);
    }
  }, [
    editingTaskType,
    mergeTaskTypeOption,
    refreshTaskBoard,
    sharedT,
    supabase,
    t,
    taskTypeFormState,
  ]);

  const handleDeactivateTaskType = useCallback(
    async (taskType: TaskTypeOption) => {
      if (!supabase || writing.current || !taskType.isActive) {
        return;
      }

      writing.current = true;
      setTaskTypePendingCode(taskType.code);
      setTaskTypeDialogFeedback(null);

      try {
        const deactivatedTaskType = await deactivateTaskType(supabase, taskType.code);
        mergeTaskTypeOption(deactivatedTaskType);
        setTaskTypeDialogFeedback({
          tone: "success",
          message: t("taskTypes.feedback.deactivated"),
        });
        refreshTaskBoard();
      } catch (error) {
        setTaskTypeDialogFeedback({
          tone: "error",
          message: toAdminTaskErrorMessage(error, sharedT),
        });
      } finally {
        writing.current = false;
        setTaskTypePendingCode(null);
      }
    },
    [
      mergeTaskTypeOption,
      refreshTaskBoard,
      sharedT,
      supabase,
      t,
    ],
  );

  return {
    editingTaskType,
    handleDeactivateTaskType,
    handleSubmitTaskType,
    handleTaskTypeDialogOpenChange,
    openTaskTypeDialog,
    startCreateTaskType,
    startEditTaskType,
    taskTypeDialogFeedback,
    taskTypeDialogOpen,
    taskTypeFormPending,
    taskTypeFormState,
    taskTypeOptions,
    taskTypePendingCode,
    updateTaskTypeFormField,
  };
}

function sortTaskTypeOptions(taskTypeOptions: TaskTypeOption[]) {
  return [...taskTypeOptions].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.displayName.localeCompare(right.displayName, "zh-CN");
  });
}
