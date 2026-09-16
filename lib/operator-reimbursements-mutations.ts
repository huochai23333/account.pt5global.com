import type { SupabaseClient } from "@supabase/supabase-js";
import { withRequestTimeout } from "./request-timeout";
import type { OperatorReimbursementFormInput } from "./operator-reimbursements-types";
import { requireOperatorReimbursementBatchReceipt } from "./operator-reimbursement-receipts";
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

  if (!data || typeof data.id !== "string" || !data.id) {
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

  if (!data || data.id !== reimbursementId) {
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

  return requireOperatorReimbursementBatchReceipt(data, periodStart);
}

function toOperatorReimbursementPayload(input: OperatorReimbursementFormInput) {
  return {
    amount: input.amount,
    content: input.content.trim(),
    spent_at: input.spentAt,
  };
}
