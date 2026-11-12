import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeTaskTargetRole } from "./admin-task-normalizers";
import type { TaskTargetRole, TaskTargetRoleRecord } from "./admin-tasks-types";
import { withRequestTimeout } from "./request-timeout";
import { normalizeOptionalString } from "./value-normalizers";

export async function getTaskTargetRolesByTaskIds(
  supabase: SupabaseClient,
  taskIds: string[],
): Promise<Array<{ taskId: string; role: TaskTargetRole }>> {
  const ids = [...new Set(taskIds.map(normalizeOptionalString))]
    .filter((id): id is string => id !== null);
  if (ids.length === 0) return [];

  // 看板和写后核对使用同一读取路径，行范围由当前会话的数据库权限决定。
  const { data, error } = await withRequestTimeout(
    supabase
      .from("task_target_roles")
      .select("task_id,target_role")
      .in("task_id", ids)
      .returns<TaskTargetRoleRecord[]>(),
  );
  if (error) throw error;

  return (data ?? []).flatMap((item) => {
    const taskId = normalizeOptionalString(item.task_id);
    const role = normalizeTaskTargetRole(item.target_role);
    return taskId && role ? [{ taskId, role }] : [];
  });
}
