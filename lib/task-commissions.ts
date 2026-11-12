import type { SupabaseClient } from "@supabase/supabase-js";

import { getOrderUserOptions } from "./admin-orders";
import { getDashboardQueryRange, MAX_DASHBOARD_QUERY_ROWS } from "./dashboard-pagination";
import { withRequestTimeout } from "./request-timeout";
import {
  normalizeTaskCommissionRecord,
  normalizeTaskCommissionRow,
} from "./task-commission-normalizers";
import {
  getTaskCommissionTeamRecords,
  getTaskCommissionTypeRecords,
} from "./task-commission-related-data";
import type { TaskCommissionRecord, TaskCommissionRow } from "./task-commission-types";

const TASK_COMMISSION_SELECT =
  "id,task_id,review_submission_id,beneficiary_user_id,approved_by_user_id,task_type_code,task_name_snapshot,task_scope,team_id,commission_amount_rmb,calculation_snapshot,settlement_status,settled_at,settlement_note,created_at,updated_at";

export type {
  TaskCommissionActor,
  TaskCommissionRow,
  TaskCommissionSettlementStatus,
} from "./task-commission-types";

/**
 * 加载器只编排主记录、用户目录与关联字典。
 * 数据解码和关联表查询分别位于 normalizers 与 related-data 模块。
 */
export async function getTaskCommissions(
  supabase: SupabaseClient,
  options?: { beneficiaryUserId?: string | null; limit?: number },
): Promise<TaskCommissionRow[]> {
  const [commissionRows, userOptions] = await Promise.all([
    getTaskCommissionRows(supabase, options),
    getOrderUserOptions(supabase),
  ]);
  if (commissionRows.length === 0) return [];

  const taskTypeCodes = [...new Set(commissionRows.map((row) => row.task_type_code))];
  const teamIds = [
    ...new Set(
      commissionRows.map((row) => row.team_id).filter((value): value is string => Boolean(value)),
    ),
  ];
  const [taskTypes, teams] = await Promise.all([
    getTaskCommissionTypeRecords(supabase, taskTypeCodes),
    getTaskCommissionTeamRecords(supabase, teamIds),
  ]);

  const userById = new Map(userOptions.map((option) => [option.user_id, option]));
  const taskTypeByCode = new Map(taskTypes.map((item) => [item.code, item]));
  const teamById = new Map(teams.map((item) => [item.id, item]));
  return commissionRows.map((row) =>
    normalizeTaskCommissionRow(row, userById, taskTypeByCode, teamById),
  );
}

async function getTaskCommissionRows(
  supabase: SupabaseClient,
  options?: { beneficiaryUserId?: string | null; limit?: number },
): Promise<TaskCommissionRecord[]> {
  const { from, to } = getDashboardQueryRange(options?.limit ?? MAX_DASHBOARD_QUERY_ROWS);
  let query = supabase.from("task_commission_record").select(TASK_COMMISSION_SELECT);
  if (options?.beneficiaryUserId) {
    query = query.eq("beneficiary_user_id", options.beneficiaryUserId);
  }
  const { data, error } = await withRequestTimeout(
    query
      .order("created_at", { ascending: false })
      .range(from, to)
      .returns<TaskCommissionRecord[]>(),
  );
  if (error) throw error;
  return (data ?? [])
    .map(normalizeTaskCommissionRecord)
    .filter((row): row is TaskCommissionRecord => row !== null);
}
