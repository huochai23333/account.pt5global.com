import type {
  AdminTaskRow,
  TaskTargetRole,
  TaskTypeOption,
} from "@/lib/admin-tasks";

export type CreateTaskFormState = {
  taskName: string;
  taskIntro: string;
  taskTypeCode: string;
  commissionAmount: string;
  acceptanceLimit: string;
  acceptanceUnlimited: boolean;
  reviewRequiresAttachment: boolean;
  targetRoles: TaskTargetRole[];
  files: File[];
};

export type AssignmentFormState = {
  targetRoles: TaskTargetRole[];
};

export function createEmptyTaskForm(
  taskTypeOptions: TaskTypeOption[] = [],
): CreateTaskFormState {
  const defaultTaskType = taskTypeOptions.find((taskType) => taskType.isActive) ?? null;

  return {
    taskName: "",
    taskIntro: "",
    taskTypeCode: defaultTaskType?.code ?? "",
    commissionAmount:
      defaultTaskType !== null
        ? formatOptionalTaskCommissionInput(defaultTaskType.defaultCommissionAmountRmb)
        : "",
    acceptanceLimit: "1",
    acceptanceUnlimited: false,
    reviewRequiresAttachment: true,
    targetRoles: [],
    files: [],
  };
}

export function createEmptyAssignmentForm(): AssignmentFormState {
  return {
    targetRoles: [],
  };
}

export function createTaskFormFromTask(task: AdminTaskRow): CreateTaskFormState {
  return {
    taskName: task.task_name,
    taskIntro: task.task_intro ?? "",
    taskTypeCode: task.task_type_code,
    commissionAmount: formatOptionalTaskCommissionInput(task.commission_amount_rmb),
    acceptanceLimit: String(Math.max(1, task.acceptance_limit)),
    acceptanceUnlimited: task.acceptance_unlimited,
    reviewRequiresAttachment: task.review_requires_attachment,
    targetRoles: task.target_roles,
    files: [],
  };
}

export function changeTaskFormType(
  form: CreateTaskFormState,
  taskTypeCode: string,
  options: TaskTypeOption[],
): CreateTaskFormState {
  const previousType = options.find((option) => option.code === form.taskTypeCode);
  const nextType = options.find((option) => option.code === taskTypeCode);
  const previousDefault = formatOptionalTaskCommissionInput(previousType?.defaultCommissionAmountRmb ?? 0);
  const nextDefault = formatOptionalTaskCommissionInput(nextType?.defaultCommissionAmountRmb ?? 0);

  // 空白和旧默认值跟随新类型，用户手填的金额继续保留。
  const useDefault = form.commissionAmount.trim().length === 0 || form.commissionAmount === previousDefault;
  return {
    ...form,
    taskTypeCode,
    commissionAmount: useDefault ? nextDefault : form.commissionAmount,
  };
}

export function toggleTaskTargetRole(roles: TaskTargetRole[], role: TaskTargetRole) {
  return roles.includes(role) ? roles.filter((target) => target !== role) : [...roles, role];
}

export function canEditTask(task: AdminTaskRow) {
  void task;
  return true;
}

export function canDeleteTask(task: AdminTaskRow) {
  void task;
  return true;
}

export function canReassignTask(task: AdminTaskRow) {
  return task.status === "to_be_accepted" && task.accepted_count === 0;
}

export function formatTaskCommissionInput(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "";
}

export function formatOptionalTaskCommissionInput(value: number) {
  return Number.isFinite(value) && value > 0 ? value.toFixed(2) : "";
}
