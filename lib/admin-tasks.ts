import type { SupabaseClient } from "@supabase/supabase-js";

import { getTaskAcceptanceAssigneesByRootTaskId } from "./admin-task-assignees";
import { getTaskAttachmentsByTaskIds } from "./admin-task-attachments";
import {
  normalizeTaskMainRecord,
  normalizeTaskProfile,
} from "./admin-task-normalizers";
import { ADMIN_TASK_SELECT } from "./admin-task-query-fields";
import {
  getTaskTypeOptions,
  getTaskTypesByCodes,
} from "./admin-task-type-management";
export {
  createAdminTask,
  updateAdminTask,
  updateAdminTaskAssignment,
} from "./admin-task-mutations";
export { deleteAdminTask } from "./admin-task-deletion";
export {
  ADMIN_TASK_ATTACHMENT_MAX_FILES,
  ADMIN_TASK_ATTACHMENT_MAX_TOTAL_SIZE_BYTES,
  uploadAdminTaskAttachments,
  validateAdminTaskAttachments,
} from "./admin-task-attachments";
export {
  createTaskType,
  deactivateTaskType,
  updateTaskType,
} from "./admin-task-type-management";
export { TASK_TARGET_ROLES } from "./admin-tasks-types";
export type {
  AdminTaskAttachment,
  AdminTaskTargetRoleFilter,
  AdminTaskMainRow,
  AdminTaskRow,
  AdminTasksFilters,
  AdminTasksPageData,
  AdminTasksSearchParams,
  AdminTaskStatusFilter,
  AdminTaskViewerContext,
  CreateAdminTaskInput,
  TaskAcceptanceAssigneeSummary,
  TaskMainRecord,
  TaskProfileSummary,
  TaskScope,
  TaskStatus,
  TaskTargetRole,
  TaskTargetRoleOption,
  TaskTargetRoleRecord,
  TaskTypeMutationInput,
  TaskTypeOption,
  UpdateAdminTaskAssignmentInput,
  UpdateAdminTaskInput,
  UserProfileRecord,
} from "./admin-tasks-types";
import type {
  AdminTaskAttachment,
  AdminTaskMainRow,
  AdminTaskRow,
  AdminTasksPageData,
  AdminTaskViewerContext,
  TaskMainRecord,
  TaskProfileSummary,
  TaskTargetRole,
  TaskTargetRoleOption,
  UserProfileRecord,
} from "./admin-tasks-types";
import { TASK_TARGET_ROLES } from "./admin-tasks-types";
import { withRequestTimeout } from "./request-timeout";
import {
  getCurrentSessionContext,
  type AppRole,
  type UserStatus,
} from "./user-self-service";
import {
  getDashboardQueryRange,
  MAX_DASHBOARD_QUERY_ROWS,
} from "./dashboard-pagination";
import { getTaskAcceptanceSummaryByTaskId } from "./task-acceptance-summary";
import { getTaskTargetRolesByTaskIds } from "./task-target-roles";

export async function getCurrentTaskViewerContext(
  supabase: SupabaseClient,
): Promise<AdminTaskViewerContext | null> {
  const { user, role, status } = await getCurrentSessionContext(supabase);

  if (!user) {
    return null;
  }

  return {
    user,
    role,
    status,
  };
}

export function canViewAdminTaskBoard(role: AppRole | null, status: UserStatus | null) {
  return role === "administrator" && (status === null || status === "active");
}

export async function getAdminTasksPageData(
  supabase: SupabaseClient,
): Promise<AdminTasksPageData> {
  const viewer = await getCurrentTaskViewerContext(supabase);

  if (!viewer) {
    return createEmptyAdminTasksPageData({
      viewerId: null,
      viewerRole: null,
      viewerStatus: null,
    });
  }

  if (!canViewAdminTaskBoard(viewer.role, viewer.status)) {
    return createEmptyAdminTasksPageData({
      viewerId: viewer.user.id,
      viewerRole: viewer.role,
      viewerStatus: viewer.status,
    });
  }

  const [tasks, taskTypeOptions] = await Promise.all([
    getAdminTasks(supabase),
    getTaskTypeOptions(supabase),
  ]);

  return {
    viewerId: viewer.user.id,
    viewerRole: viewer.role,
    viewerStatus: viewer.status,
    canView: true,
    tasks,
    targetRoleOptions: getTaskTargetRoleOptions(),
    taskTypeOptions,
  };
}

export async function getAdminTasks(
  supabase: SupabaseClient,
  limit = MAX_DASHBOARD_QUERY_ROWS,
): Promise<AdminTaskRow[]> {
  const { from, to } = getDashboardQueryRange(limit);
  const { data, error } = await withRequestTimeout(
    supabase
      .from("task_main")
      .select(ADMIN_TASK_SELECT)
      .order("created_at", { ascending: false })
      .range(from, to)
      .returns<TaskMainRecord[]>(),
  );

  if (error) {
    throw error;
  }

  const taskRows = (data ?? [])
    .map((item) => normalizeTaskMainRecord(item))
    .filter((item): item is AdminTaskMainRow => item !== null);

  if (taskRows.length === 0) {
    return [];
  }

  const taskIds = taskRows.map((task) => task.id);
  const rootTaskIds = Array.from(
    new Set(taskRows.map((task) => task.parent_task_id ?? task.id)),
  );
  const attachmentSourceTaskIds = taskIds;
  const userIds = Array.from(
    new Set(
      taskRows.map((task) => task.created_by_user_id),
    ),
  );
  const taskTypeCodes = Array.from(new Set(taskRows.map((task) => task.task_type_code)));

  const [
    attachments,
    profiles,
    taskTypes,
    targetRoles,
    acceptanceSummaryByTaskId,
    acceptanceAssigneesByRootTaskId,
  ] = await Promise.all([
    getTaskAttachmentsByTaskIds(supabase, attachmentSourceTaskIds),
    getTaskProfilesByUserIds(supabase, userIds),
    getTaskTypesByCodes(supabase, taskTypeCodes),
    getTaskTargetRolesByTaskIds(supabase, taskIds),
    getTaskAcceptanceSummaryByTaskId(supabase, taskIds),
    getTaskAcceptanceAssigneesByRootTaskId(supabase, rootTaskIds),
  ]);

  const attachmentsByTaskId = new Map<string, AdminTaskAttachment[]>();
  attachments.forEach((attachment) => {
    const bucket = attachmentsByTaskId.get(attachment.task_id);
    if (bucket) {
      bucket.push(attachment);
      return;
    }

    attachmentsByTaskId.set(attachment.task_id, [attachment]);
  });

  const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const taskTypeByCode = new Map(taskTypes.map((taskType) => [taskType.code, taskType]));
  const targetRolesByTaskId = new Map<string, TaskTargetRole[]>();

  targetRoles.forEach((targetRole) => {
    const bucket = targetRolesByTaskId.get(targetRole.taskId);

    if (bucket) {
      bucket.push(targetRole.role);
      return;
    }

    targetRolesByTaskId.set(targetRole.taskId, [targetRole.role]);
  });

  return taskRows.map((task) => {
    const acceptanceSummary = acceptanceSummaryByTaskId.get(task.id);
    return {
      ...task,
      task_type_label:
        taskTypeByCode.get(task.task_type_code)?.displayName ?? task.task_type_label,
      creator: profileByUserId.get(task.created_by_user_id) ?? null,
      accepted_by: null,
      team: null,
      target_roles: targetRolesByTaskId.get(task.id) ?? [],
      accepted_count: acceptanceSummary?.acceptedCount ?? task.accepted_count,
      completed_count: acceptanceSummary?.completedCount ?? task.completed_count,
      attachments: attachmentsByTaskId.get(task.id) ?? [],
      acceptance_assignees: acceptanceAssigneesByRootTaskId.get(task.id) ?? [],
    };
  });
}

function createEmptyAdminTasksPageData(options: {
  viewerId: string | null;
  viewerRole: AppRole | null;
  viewerStatus: UserStatus | null;
}): AdminTasksPageData {
  return {
    viewerId: options.viewerId,
    viewerRole: options.viewerRole,
    viewerStatus: options.viewerStatus,
    canView: canViewAdminTaskBoard(options.viewerRole, options.viewerStatus),
    tasks: [],
    targetRoleOptions: [],
    taskTypeOptions: [],
  };
}

async function getTaskProfilesByUserIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<TaskProfileSummary[]> {
  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .from("user_profiles")
      .select("user_id,name,email,status")
      .in("user_id", userIds)
      .returns<UserProfileRecord[]>(),
  );

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((item) => normalizeTaskProfile(item))
    .filter((item): item is TaskProfileSummary => item !== null);
}

function getTaskTargetRoleOptions(): TaskTargetRoleOption[] {
  return TASK_TARGET_ROLES.map((role) => ({ role }));
}
