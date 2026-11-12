import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeNullableString, normalizeTaskMainRecord } from "./admin-task-normalizers";
import type {
  AdminTaskMainRow,
  CreateAdminTaskInput,
  TaskMainRecord,
  TaskTargetRole,
  UpdateAdminTaskAssignmentInput,
  UpdateAdminTaskInput,
} from "./admin-tasks-types";
import { withRequestTimeout } from "./request-timeout";
import { getTaskTargetRolesByTaskIds } from "./task-target-roles";

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
) {
  const expectedRoles = new Set(input.targetRoles);
  if (expectedRoles.size === 0) throw new Error("invalid task target roles");
  const currentRoles = await readAssignedRoles(supabase, input.taskId);
  if (matchesAssignedRoles(currentRoles, expectedRoles)) {
    return { status: "unchanged" as const, targetRoles: currentRoles };
  }

  // verified-rpc: RPC 返回 void；必须按任务编号独立读回目标角色集合。
  const { error } = await withRequestTimeout(
    supabase.rpc("set_task_target_roles", {
      p_task_id: input.taskId,
      p_target_roles: input.targetRoles,
    }),
  );

  if (error) {
    throw error;
  }

  const savedRoles = await readAssignedRoles(supabase, input.taskId);
  if (!matchesAssignedRoles(savedRoles, expectedRoles)) {
    throw new Error("task target roles not confirmed");
  }

  return { status: "saved" as const, targetRoles: savedRoles };
}

async function readAssignedRoles(supabase: SupabaseClient, taskId: string) {
  const rows = await getTaskTargetRolesByTaskIds(supabase, [taskId]);
  return rows.filter((row) => row.taskId === taskId).map((row) => row.role);
}

function matchesAssignedRoles(roles: TaskTargetRole[], expected: Set<TaskTargetRole>) {
  return roles.length === expected.size && new Set(roles).size === expected.size
    && roles.every((role) => expected.has(role));
}
