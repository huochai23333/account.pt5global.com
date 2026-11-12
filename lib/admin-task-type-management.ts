import type { SupabaseClient } from "@supabase/supabase-js";

import {
  normalizeNullableString,
  normalizeTaskTypeOption,
} from "./admin-task-normalizers";
import type {
  TaskTypeCatalogRecord,
  TaskTypeMutationInput,
  TaskTypeOption,
} from "./admin-tasks-types";
import { withRequestTimeout } from "./request-timeout";
import { normalizeNumericValue } from "./value-normalizers";

const TASK_TYPE_SELECT =
  "code,display_name,description,default_commission_amount_rmb,is_active,sort_order";

type TaskTypeExpectation = {
  code?: string;
  active: boolean;
  fields?: TaskTypeMutationInput;
};

export async function createTaskType(supabase: SupabaseClient, input: TaskTypeMutationInput) {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("create_task_type", {
      p_display_name: input.displayName,
      p_description: normalizeNullableString(input.description),
      p_default_commission_amount_rmb: input.defaultCommissionAmountRmb,
    }).single<TaskTypeCatalogRecord>(),
  );
  if (error) throw error;
  return confirmTaskTypeWrite(supabase, data, { active: true, fields: input });
}

export async function updateTaskType(
  supabase: SupabaseClient,
  input: TaskTypeMutationInput & { code: string },
) {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("update_task_type", {
      p_code: input.code,
      p_display_name: input.displayName,
      p_description: normalizeNullableString(input.description),
      p_default_commission_amount_rmb: input.defaultCommissionAmountRmb,
    }).single<TaskTypeCatalogRecord>(),
  );
  if (error) throw error;
  return confirmTaskTypeWrite(supabase, data, { code: input.code, active: true, fields: input });
}

export async function deactivateTaskType(supabase: SupabaseClient, code: string) {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("deactivate_task_type", { p_code: code }).single<TaskTypeCatalogRecord>(),
  );
  if (error) throw error;
  return confirmTaskTypeWrite(supabase, data, { code, active: false });
}

async function confirmTaskTypeWrite(
  supabase: SupabaseClient,
  receipt: TaskTypeCatalogRecord | null,
  expected: TaskTypeExpectation,
) {
  const confirmed = requireTaskType(receipt, expected);
  // 创建用数据库生成的编码，编辑和停用先校验原编码，再读取同一条记录。
  const { data, error } = await withRequestTimeout(
    supabase.from("task_type_catalog").select(TASK_TYPE_SELECT)
      .eq("code", confirmed.code).maybeSingle<TaskTypeCatalogRecord>(),
  );
  if (error) throw error;
  return requireTaskType(data, { ...expected, code: confirmed.code });
}

function requireTaskType(record: TaskTypeCatalogRecord | null, expected: TaskTypeExpectation) {
  const taskType = normalizeTaskTypeOption(record);
  const fields = expected.fields;
  // 显示层会用默认值补缺失数据，写入凭证必须有真实状态和金额。
  if (
    !taskType || typeof record?.is_active !== "boolean" ||
    (record.description !== null && typeof record.description !== "string") ||
    normalizeNumericValue(record.default_commission_amount_rmb) === null ||
    (typeof record.default_commission_amount_rmb === "string" &&
      record.default_commission_amount_rmb.trim() === "") ||
    (expected.code !== undefined && taskType.code !== expected.code) ||
    taskType.isActive !== expected.active ||
    (fields && (
      taskType.displayName !== fields.displayName.trim() ||
      taskType.description !== normalizeNullableString(fields.description) ||
      taskType.defaultCommissionAmountRmb !== fields.defaultCommissionAmountRmb
    ))
  ) {
    throw new Error("task type write not confirmed");
  }
  return taskType;
}

export async function getTaskTypeOptions(
  supabase: SupabaseClient,
): Promise<TaskTypeOption[]> {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("task_type_catalog")
      .select(TASK_TYPE_SELECT)
      .order("sort_order", { ascending: true })
      .order("display_name", { ascending: true })
      .returns<TaskTypeCatalogRecord[]>(),
  );

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((item) => normalizeTaskTypeOption(item))
    .filter((item): item is TaskTypeOption => item !== null);
}

export async function getTaskTypesByCodes(
  supabase: SupabaseClient,
  codes: string[],
): Promise<TaskTypeOption[]> {
  const normalizedCodes = [...new Set(codes.map(normalizeNullableString))]
    .filter((code): code is string => code !== null);
  if (normalizedCodes.length === 0) {
    return [];
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .from("task_type_catalog")
      .select(TASK_TYPE_SELECT)
      .in("code", normalizedCodes)
      .returns<TaskTypeCatalogRecord[]>(),
  );

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((item) => normalizeTaskTypeOption(item))
    .filter((item): item is TaskTypeOption => item !== null);
}
