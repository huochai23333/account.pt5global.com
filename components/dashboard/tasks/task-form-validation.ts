import type { TaskTargetRole } from "@/lib/admin-tasks";

import type { TranslateFn } from "./tasks-display";

type TaskDraftLike = {
  taskName: string;
  taskTypeCode: string;
  commissionAmount: string;
  acceptanceLimit: string;
  acceptanceUnlimited: boolean;
  targetRoles: TaskTargetRole[];
};

type TaskAssignmentDraftLike = {
  targetRoles: TaskTargetRole[];
};

// 表单使用字符串，提交前保留空值与无效数值的区别。
export function parseTaskCommissionAmountInput(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return 0;
  }

  const parsedValue = Number(trimmedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export function parseTaskAcceptanceLimitInput(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number(trimmedValue);

  return Number.isInteger(parsedValue) ? parsedValue : null;
}

export function validateTaskDraft(
  formState: TaskDraftLike,
  t: TranslateFn,
) {
  if (!formState.taskName.trim()) {
    return t("validation.taskNameRequired");
  }

  if (!formState.taskTypeCode.trim()) {
    return t("validation.taskTypeRequired");
  }

  const commissionAmount = parseTaskCommissionAmountInput(formState.commissionAmount);

  if (commissionAmount === null || commissionAmount < 0) {
    return t("validation.commissionAmountInvalid");
  }

  // 不限人数时不使用表单里保留的旧上限。
  if (!formState.acceptanceUnlimited) {
    const limit = parseTaskAcceptanceLimitInput(formState.acceptanceLimit);
    if (limit === null || limit < 1) {
      return t("validation.acceptanceLimitInvalid");
    }
  }

  if (formState.targetRoles.length === 0) {
    return t("validation.targetRolesRequiredForCreate");
  }

  return null;
}

export function validateTaskAssignmentDraft(
  formState: TaskAssignmentDraftLike,
  t: TranslateFn,
) {
  if (formState.targetRoles.length === 0) {
    return t("validation.targetRolesRequiredForAssignment");
  }

  return null;
}
