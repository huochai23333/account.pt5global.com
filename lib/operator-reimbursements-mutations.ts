import type { SupabaseClient } from "@supabase/supabase-js";
import { withRequestTimeout } from "./request-timeout";
import type {
  OperatorReimbursementFormInput,
  OperatorReimbursementBatchResult,
} from "./operator-reimbursements-types";
type OperatorReimbursementDatabaseRow = { id: string };
type OperatorReimbursementBatchDatabaseRow = {
  period_start: string;
  period_end: string;
  reimbursed_total: number | string;
  updated_count: number | string;
};
const OPERATOR_REIMBURSEMENT_SELECT = "id";
// 创建时只发送表单字段；数据库强制将记录归属设置为当前运营。
export async function createOperatorReimbursement(
  supabase: SupabaseClient,
  input: OperatorReimbursementFormInput,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("operator_reimbursements")
      .insert(toOperatorReimbursementPayload(input))
      .select(OPERATOR_REIMBURSEMENT_SELECT)
      .maybeSingle<OperatorReimbursementDatabaseRow>(),
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Operator reimbursement was not created.");
  }

  return data;
}

export async function deleteOperatorReimbursement(
  supabase: SupabaseClient,
  reimbursementId: string,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("operator_reimbursements")
      .delete()
      .eq("id", reimbursementId)
      .eq("status", "unreimbursed")
      .select("id")
      .maybeSingle<{ id: string }>(),
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Operator reimbursement was not found.");
  }

  return data;
}

export async function reimburseOperatorPeriod(
  supabase: SupabaseClient,
  periodStart: string,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .rpc("mark_operator_reimbursements_reimbursed", {
        p_period_start: periodStart,
      })
      .maybeSingle<OperatorReimbursementBatchDatabaseRow>(),
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Operator reimbursement batch was not returned.");
  }

  return {
    periodEnd: data.period_end,
    periodStart: data.period_start,
    reimbursedTotal: Number(data.reimbursed_total),
    updatedCount: Number(data.updated_count),
  } satisfies OperatorReimbursementBatchResult;
}

function toOperatorReimbursementPayload(input: OperatorReimbursementFormInput) {
  return {
    amount: input.amount,
    content: input.content.trim(),
    spent_at: input.spentAt,
  };
}
