import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getTaskTypesByCodes } from "./admin-task-type-management";
import { TASK_TARGET_ROLES } from "./admin-tasks";
import type {
  AdminTaskAttachment,
  AdminTaskMainRow,
  TaskTargetRole,
  TaskTypeOption,
} from "./admin-tasks";
import { getCurrentSessionContext, type AppRole, type UserStatus } from "./user-self-service";
import {
  getTaskAcceptanceSummaryByTaskId,
  type TaskAcceptanceSummary,
} from "./task-acceptance-summary";
import { getTaskAcceptancesByViewer, type TaskAcceptanceRow } from "./task-acceptances";
import {
  getSalesmanTaskMainRows,
  getSalesmanTaskMainRowsByIds,
  getVisibleTaskAttachments,
} from "./salesman-task-data";
import { getTaskTargetRolesByTaskIds } from "./task-target-roles";

export type SalesmanTaskViewerContext = {
  user: User;
  role: AppRole | null;
  status: UserStatus | null;
};

export type SalesmanTaskRow = AdminTaskMainRow & {
  target_roles: TaskTargetRole[];
  attachments: AdminTaskAttachment[];
};

export type SalesmanTasksPageData = {
  viewerId: string | null;
  viewerRole: AppRole | null;
  viewerStatus: UserStatus | null;
  canView: boolean;
  tasks: SalesmanTaskRow[];
};

export async function getCurrentSalesmanTaskViewerContext(
  supabase: SupabaseClient,
): Promise<SalesmanTaskViewerContext | null> {
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

export function canViewSalesmanTaskBoard(role: AppRole | null, status: UserStatus | null) {
  return status === "active" && TASK_TARGET_ROLES.some((targetRole) => targetRole === role);
}

export async function getSalesmanTasksPageData(
  supabase: SupabaseClient,
): Promise<SalesmanTasksPageData> {
  const viewer = await getCurrentSalesmanTaskViewerContext(supabase);

  if (!viewer) {
    return createEmptySalesmanTasksPageData({
      viewerId: null,
      viewerRole: null,
      viewerStatus: null,
    });
  }

  if (!canViewSalesmanTaskBoard(viewer.role, viewer.status)) {
    return createEmptySalesmanTasksPageData({
      viewerId: viewer.user.id,
      viewerRole: viewer.role,
      viewerStatus: viewer.status,
    });
  }

  const tasks = await getVisibleSalesmanTasks(supabase, viewer.user.id);

  return {
    viewerId: viewer.user.id,
    viewerRole: viewer.role,
    viewerStatus: viewer.status,
    canView: true,
    tasks,
  };
}

export async function getVisibleSalesmanTasks(
  supabase: SupabaseClient,
  viewerId: string | null,
  limit?: number,
): Promise<SalesmanTaskRow[]> {
  // 保留当前账号已领取但落在基础任务页之外的记录，再合并附件与计数。
  const baseTasks = await getSalesmanTaskMainRows(supabase, limit);

  const viewerAcceptances = await getTaskAcceptancesByViewer(supabase, viewerId);
  const baseTaskIds = new Set(baseTasks.map((task) => task.id));
  const acceptedTaskIdsMissingFromPage = Array.from(
    new Set(
      viewerAcceptances
        .map((acceptance) => acceptance.task_id)
        .filter((taskId) => !baseTaskIds.has(taskId)),
    ),
  );
  const acceptedTasksMissingFromPage = await getSalesmanTaskMainRowsByIds(
    supabase,
    acceptedTaskIdsMissingFromPage,
  );
  const tasks = [...baseTasks, ...acceptedTasksMissingFromPage];

  if (tasks.length === 0) {
    return [];
  }

  const taskIds = tasks.map((task) => task.id);
  const taskTypeCodes = Array.from(new Set(tasks.map((task) => task.task_type_code)));
  const [
    attachments,
    taskTypes,
    targetRoles,
    acceptanceSummaryByTaskId,
  ] = await Promise.all([
    getVisibleTaskAttachments(supabase, taskIds),
    getTaskTypesByCodes(supabase, taskTypeCodes),
    getTaskTargetRolesByTaskIds(supabase, taskIds),
    getTaskAcceptanceSummaryByTaskId(supabase, taskIds),
  ]);
  const attachmentByTaskId = new Map<string, AdminTaskAttachment[]>();
  const taskTypeByCode = new Map(taskTypes.map((taskType) => [taskType.code, taskType]));
  const targetRolesByTaskId = new Map<string, TaskTargetRole[]>();
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const viewerAcceptanceByTaskId = new Map(
    viewerAcceptances.map((acceptance) => [acceptance.task_id, acceptance]),
  );

  attachments.forEach((attachment) => {
    const bucket = attachmentByTaskId.get(attachment.task_id);

    if (bucket) {
      bucket.push(attachment);
      return;
    }

    attachmentByTaskId.set(attachment.task_id, [attachment]);
  });

  targetRoles.forEach((targetRole) => {
    const bucket = targetRolesByTaskId.get(targetRole.taskId);

    if (bucket) {
      bucket.push(targetRole.role);
      return;
    }

    targetRolesByTaskId.set(targetRole.taskId, [targetRole.role]);
  });

  const acceptedRows = viewerAcceptances
    .map((acceptance) => {
      const task = taskById.get(acceptance.task_id);

      return task ? buildSalesmanTaskRow({
        task,
        acceptance,
        taskTypeByCode,
        targetRolesByTaskId,
        attachmentByTaskId,
        acceptanceSummaryByTaskId,
      }) : null;
    })
    .filter((task): task is SalesmanTaskRow => task !== null);

  const availableRows = tasks
    .filter((task) => !viewerAcceptanceByTaskId.has(task.id))
    .map((task) => buildSalesmanTaskRow({
      task,
      taskTypeByCode,
      targetRolesByTaskId,
      attachmentByTaskId,
      acceptanceSummaryByTaskId,
    }))
    .filter(
      (task) =>
        task.status === "to_be_accepted"
        && (task.acceptance_unlimited || task.accepted_count < task.acceptance_limit),
    );

  return [...acceptedRows, ...availableRows].sort((first, second) =>
    (second.accepted_at ?? second.created_at ?? "").localeCompare(
      first.accepted_at ?? first.created_at ?? "",
    ),
  );
}

function buildSalesmanTaskRow(options: {
  task: AdminTaskMainRow;
  acceptance?: TaskAcceptanceRow;
  taskTypeByCode: Map<string, TaskTypeOption>;
  targetRolesByTaskId: Map<string, TaskTargetRole[]>;
  attachmentByTaskId: Map<string, AdminTaskAttachment[]>;
  acceptanceSummaryByTaskId: Map<string, TaskAcceptanceSummary>;
}): SalesmanTaskRow {
  const { task, acceptance } = options;
  const acceptanceSummary = options.acceptanceSummaryByTaskId.get(task.id);

  return {
    ...task,
    id: acceptance?.id ?? task.id,
    parent_task_id: acceptance ? task.id : null,
    task_type_label:
      options.taskTypeByCode.get(task.task_type_code)?.displayName ?? task.task_type_label,
    target_roles: options.targetRolesByTaskId.get(task.id) ?? [],
    accepted_count: acceptanceSummary?.acceptedCount ?? task.accepted_count,
    completed_count: acceptanceSummary?.completedCount ?? task.completed_count,
    attachments: options.attachmentByTaskId.get(task.id) ?? [],
    accepted_by_user_id: acceptance?.accepted_by_user_id ?? null,
    status: acceptance?.status ?? task.status,
    accepted_at: acceptance?.accepted_at ?? null,
    submitted_at: acceptance?.submitted_at ?? null,
    reviewed_at: acceptance?.reviewed_at ?? null,
    reviewed_by_user_id: acceptance?.reviewed_by_user_id ?? null,
    review_reject_reason: acceptance?.review_reject_reason ?? null,
    completed_at: acceptance?.completed_at ?? null,
  };
}

function createEmptySalesmanTasksPageData(options: {
  viewerId: string | null;
  viewerRole: AppRole | null;
  viewerStatus: UserStatus | null;
}): SalesmanTasksPageData {
  return {
    viewerId: options.viewerId,
    viewerRole: options.viewerRole,
    viewerStatus: options.viewerStatus,
    canView: canViewSalesmanTaskBoard(options.viewerRole, options.viewerStatus),
    tasks: [],
  };
}
