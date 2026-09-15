import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeNullableString, normalizeTaskMainRecord } from "./admin-task-normalizers";
import { ADMIN_TASK_SELECT } from "./admin-task-query-fields";
import type {
  AdminTaskMainRow,
  AdminTaskRow,
  CreateAdminTaskInput,
  TaskMainRecord,
  UpdateAdminTaskAssignmentInput,
  UpdateAdminTaskInput,
} from "./admin-tasks-types";
import { withRequestTimeout } from "./request-timeout";
import { prepareDeletedTaskStorageCleanup } from "./task-storage-cleanup";

export async function createAdminTask(
  supabase: SupabaseClient,
  input: CreateAdminTaskInput,
): Promise<AdminTaskMainRow> {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("create_role_targeted_task", {
      p_task_name: input.taskName.trim(),
      p_task_intro: normalizeNullableString(input.taskIntro),
      p_task_type_code: input.taskTypeCode,
      p_commission_amount_rmb: input.commissionAmountRmb,
      p_target_roles: input.targetRoles,
      p_acceptance_limit: input.acceptanceLimit,
      p_acceptance_unlimited: input.acceptanceUnlimited,
      p_review_requires_attachment: input.reviewRequiresAttachment,
    }).returns<TaskMainRecord>(),
  );

  if (error) {
    throw error;
  }

  const task = normalizeTaskMainRecord(data);

  if (!task) {
    throw new Error("任务创建成功，但返回数据不完整。");
  }

  return task;
}

export async function updateAdminTask(
  supabase: SupabaseClient,
  input: UpdateAdminTaskInput,
): Promise<{
  commissionSyncFailed: boolean;
  task: AdminTaskMainRow;
}> {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("update_role_targeted_task", {
      p_task_id: input.taskId,
      p_task_name: input.taskName.trim(),
      p_task_intro: normalizeNullableString(input.taskIntro),
      p_task_type_code: input.taskTypeCode,
      p_commission_amount_rmb: input.commissionAmountRmb,
      p_target_roles: input.targetRoles,
      p_acceptance_limit: input.acceptanceLimit,
      p_acceptance_unlimited: input.acceptanceUnlimited,
      p_review_requires_attachment: input.reviewRequiresAttachment,
    }).returns<TaskMainRecord>(),
  );

  if (error) {
    throw error;
  }

  const task = normalizeTaskMainRecord(data);

  if (!task) {
    throw new Error("任务更新成功，但返回数据不完整。");
  }

  return {
    commissionSyncFailed: false,
    task,
  };
}

export async function updateAdminTaskAssignment(
  supabase: SupabaseClient,
  input: UpdateAdminTaskAssignmentInput,
): Promise<AdminTaskMainRow> {
  // verified-rpc: RPC 返回 void；下方立即重新读取 task_main，确认任务仍存在且版本可用。
  const { error } = await withRequestTimeout(
    supabase.rpc("set_task_target_roles", {
      p_task_id: input.taskId,
      p_target_roles: input.targetRoles,
    }),
  );

  if (error) {
    throw error;
  }

  const { data: taskData, error: taskError } = await withRequestTimeout(
    supabase
      .from("task_main")
      .select(ADMIN_TASK_SELECT)
      .eq("id", input.taskId)
      .single()
      .returns<TaskMainRecord>(),
  );

  if (taskError) {
    throw taskError;
  }

  const task = normalizeTaskMainRecord(taskData);

  if (!task) {
    throw new Error("任务改派成功，但返回数据不完整。");
  }

  return task;
}

export async function deleteAdminTask(
  supabase: SupabaseClient,
  task: Pick<AdminTaskRow, "id" | "attachments">,
) {
  const runDeletedTaskStorageCleanup = await prepareDeletedTaskStorageCleanup(
    supabase,
    {
      taskId: task.id,
      taskAttachments: task.attachments,
    },
  );

  const { data, error } = await withRequestTimeout(
    supabase.from("task_main").delete().eq("id", task.id).select("id").maybeSingle<{ id: string }>(),
  );

  if (error) {
    throw error;
  }
  if (!data || data.id !== task.id) {
    throw new Error("没有找到需要删除的任务。");
  }

  const storageCleanupFailed = await runDeletedTaskStorageCleanup();

  return {
    storageCleanupFailed,
  };
}
