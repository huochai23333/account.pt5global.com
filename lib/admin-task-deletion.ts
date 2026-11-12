import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminTaskRow } from "./admin-tasks-types";
import { withRequestTimeout } from "./request-timeout";
import { prepareDeletedTaskStorageCleanup } from "./task-storage-cleanup";

export async function deleteAdminTask(
  supabase: SupabaseClient,
  task: Pick<AdminTaskRow, "id" | "attachments">,
) {
  // 附件登记会随任务级联删除，先读取清理清单，但要等删除确认后才执行。
  const cleanup = await prepareDeletedTaskStorageCleanup(supabase, {
    taskId: task.id,
    taskAttachments: task.attachments,
  });
  const { data, error } = await withRequestTimeout(
    supabase.from("task_main").delete().eq("id", task.id).select("id").maybeSingle<{ id: string }>(),
  );

  if (error) throw error;
  if (data?.id !== task.id) throw new Error("task delete did not confirm the requested row");

  const confirmation = await withRequestTimeout(
    supabase.from("task_main").select("id").eq("id", task.id).maybeSingle<{ id: string }>(),
  ).catch(() => null);
  if (!confirmation || confirmation.error || confirmation.data !== null) {
    // 回执与读回不一致时保留文件，避免给仍存在的任务删除附件。
    return { status: "partial_failed", stage: "task_confirmation" } as const;
  }

  const unconfirmedGroups = await cleanup();
  if (unconfirmedGroups.length > 0) {
    return { status: "partial_failed", stage: "attachments", unconfirmedGroups } as const;
  }
  return { status: "deleted" } as const;
}
