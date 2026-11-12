import type { SupabaseClient } from "@supabase/supabase-js";
import { withRequestTimeout } from "./request-timeout";
import type { OperatorReimbursementFormInput } from "./operator-reimbursements-types";
import { requireOperatorReimbursementBatchReceipt } from "./operator-reimbursement-receipts";
type OperatorReimbursementDatabaseRow = { id: string };
type OperatorReimbursementCreationRow = {
  id: string;
  operator_user_id: string;
  amount: number | string;
  content: string;
  spent_at: string;
};
type OperatorReimbursementBatchDatabaseRow = {
  period_start: string;
  period_end: string;
  reimbursed_total: number | string;
  updated_count: number | string;
};
const OPERATOR_REIMBURSEMENT_SELECT = "id";
export const operatorReimbursementCreateUnconfirmed = "operator_reimbursement_create_unconfirmed";
export const operatorReimbursementCreateDifferent = "operator_reimbursement_create_different";
export class OperatorReimbursementCreateRejected extends Error {}

export async function createOperatorReimbursement(
  supabase: SupabaseClient,
  draft: { id: string; actorId: string },
  input: OperatorReimbursementFormInput,
) {
  const payload = toOperatorReimbursementPayload(input);
  // 草稿编号在页面中固定；归属与周期由数据库用登录用户和发生日期决定。
  const { data, error, status } = await withRequestTimeout(
    supabase
      .from("operator_reimbursements")
      .insert({ id: draft.id, ...payload })
      .select(OPERATOR_REIMBURSEMENT_SELECT)
      .maybeSingle<OperatorReimbursementDatabaseRow>(),
  ).catch(() => ({ data: null, error: null, status: 0 }));

  const code = error?.code ?? "";
  if (status >= 400 && status < 500 && code !== "23505" && /^(22\d{3}|23\d{3}|42501|PGRST30[12])$/.test(code)) {
    throw new OperatorReimbursementCreateRejected(code === "42501" ? "permission denied" : "");
  }

  // 即使响应丢失或主键重复，也只核对本人同一条记录，保留原行版本。
  const receipt = await withRequestTimeout(
    supabase.from("operator_reimbursements")
      .select("id,operator_user_id,amount,content,spent_at")
      .eq("id", draft.id)
      .eq("operator_user_id", draft.actorId)
      .maybeSingle<OperatorReimbursementCreationRow>(),
  ).catch(() => null);
  const row = receipt?.data;
  if (receipt?.error || !row || row.id !== draft.id || row.operator_user_id !== draft.actorId || (data && data.id !== row.id)) {
    throw new Error(operatorReimbursementCreateUnconfirmed);
  }
  if (Number(row.amount) !== payload.amount || row.content !== payload.content || row.spent_at !== payload.spent_at) {
    throw new Error(operatorReimbursementCreateDifferent);
  }

  return { id: row.id };
}

export function getOperatorReimbursementDraftKey(input: OperatorReimbursementFormInput) {
  return JSON.stringify(toOperatorReimbursementPayload(input));
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
