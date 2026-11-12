import type { AdminTaskRow, AdminTasksFilters, AdminTaskStatusFilter } from "@/lib/admin-tasks-types";
import { normalizeSearchText } from "@/lib/value-normalizers";

import { resolveTaskActorLabel, type TranslateFn } from "../tasks/tasks-display";

export function filterAdminTaskList(
  tasks: AdminTaskRow[],
  filters: AdminTasksFilters,
  t: TranslateFn,
) {
  const query = normalizeSearchText(filters.searchText);
  return tasks.filter((task) => {
    if (!matchesTaskStatus(task, filters.status)) return false;
    if (filters.targetRole !== "all" && !task.target_roles.includes(filters.targetRole)) return false;
    if (!query) return true;

    const searchableText = [
      task.task_name,
      task.task_intro,
      task.task_type_label,
      task.review_reject_reason,
      resolveTaskActorLabel(task.creator, task.created_by_user_id, t),
      task.creator?.email,
      resolveTaskActorLabel(task.accepted_by, task.accepted_by_user_id, t),
      task.accepted_by?.email,
      task.target_roles.map((role) => t(`targetRoles.${role}`)).join(" "),
    ]
      .map(normalizeSearchText)
      .filter(Boolean)
      .join(" ");
    return searchableText.includes(query);
  });
}

function matchesTaskStatus(task: AdminTaskRow, status: AdminTaskStatusFilter) {
  if (status === "all") return true;
  // 一项任务可有多人领取，审核中与退回按领取记录判断。
  if (status === "to_be_accepted") return task.accepted_count === 0;
  if (status === "accepted") return task.accepted_count > 0;
  if (status === "completed") return task.completed_count > 0;
  return task.acceptance_assignees.some((assignee) => assignee.task_status === status);
}
