import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";
import { normalizeOptionalString } from "./value-normalizers";

type SettlementTable = "commission_record" | "task_commission_record";

async function confirmPaidSettlement(
  supabase: SupabaseClient,
  table: SettlementTable,
  expectedId: string,
  expectedNote: string | null,
  receiptId: unknown,
) {
  // 写入回执必须对应本次记录。再从原表读回，确认状态、时间和说明都已落库。
  if (receiptId !== expectedId) {
    throw new Error("commission settlement not confirmed");
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .from(table)
      .select("id, settlement_status, settled_at, settlement_note")
      .eq("id", expectedId)
      .maybeSingle(),
  );

  if (
    error ||
    data?.id !== expectedId ||
    data.settlement_status !== "paid" ||
    typeof data.settled_at !== "string" ||
    !Number.isFinite(Date.parse(data.settled_at)) ||
    data.settlement_note !== expectedNote
  ) {
    throw new Error("commission settlement not confirmed");
  }

  return data.id;
}

export async function markCommissionRecordAsPaid(
  supabase: SupabaseClient,
  options: {
    commissionRecordId: string;
    settlementNote?: string | null;
  },
) {
  const commissionRecordId = normalizeOptionalString(options.commissionRecordId);

  if (!commissionRecordId) {
    throw new Error("Commission record id is required.");
  }

  const settlementNote = normalizeOptionalString(options.settlementNote);
  const { data, error } = await withRequestTimeout(
    supabase.rpc("update_commission_settlement", {
      p_commission_record_id: commissionRecordId,
      p_settlement_status: "paid",
      p_settled_at: null,
      p_settlement_note: settlementNote,
    }),
  );

  if (error) {
    throw error;
  }

  return confirmPaidSettlement(supabase, "commission_record", commissionRecordId, settlementNote, data);
}

export async function markTaskCommissionRecordAsPaid(
  supabase: SupabaseClient,
  options: {
    taskCommissionRecordId: string;
    settlementNote?: string | null;
  },
) {
  const taskCommissionRecordId = normalizeOptionalString(
    options.taskCommissionRecordId,
  );

  if (!taskCommissionRecordId) {
    throw new Error("Task commission record id is required.");
  }

  const settlementNote = normalizeOptionalString(options.settlementNote);
  const { data, error } = await withRequestTimeout(
    supabase.rpc("update_task_commission_settlement", {
      p_task_commission_record_id: taskCommissionRecordId,
      p_settlement_status: "paid",
      p_settled_at: null,
      p_settlement_note: settlementNote,
    }),
  );

  if (error) {
    throw error;
  }

  return confirmPaidSettlement(
    supabase,
    "task_commission_record",
    taskCommissionRecordId,
    settlementNote,
    data,
  );
}
