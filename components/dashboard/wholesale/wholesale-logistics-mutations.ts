import type { SupabaseClient } from "@supabase/supabase-js";
import type { WholesaleLogisticsStoreAssignment } from "@/lib/wholesale-logistics-page";

type AssignmentInterval = Pick<WholesaleLogisticsStoreAssignment,
  "id" | "store_name_normalized" | "sales_user_id" | "customer_id" | "effective_from" | "effective_to">;

export type ChangeWholesaleLogisticsAssignmentInput = {
  assignment: AssignmentInterval;
  customerId: string | null;
  effectiveFrom: string | null;
  salesUserId: string;
};

/** 初次分配可一次选择多个真实店小秘店铺，并默认覆盖这些店铺的全部历史订单。 */
export async function assignWholesaleLogisticsStores(
  supabase: SupabaseClient,
  input: {
    customerId: string | null;
    salesUserId: string;
    storeNames: string[];
  },
) {
  const { data, error } = await supabase.rpc("assign_wholesale_logistics_stores", {
    p_customer_id: input.customerId,
    p_sales_user_id: input.salesUserId,
    p_store_names: input.storeNames,
  });

  if (error) throw error;
  if (!Array.isArray(data) || data.length !== new Set(input.storeNames).size) {
    throw new Error("部分店铺没有完成分配，请刷新后核对。");
  }
}

/** 不传日期时更新整个当前区间；传入日期时由数据库拆分前后历史区间。 */
export async function changeWholesaleLogisticsAssignment(
  supabase: SupabaseClient,
  input: ChangeWholesaleLogisticsAssignmentInput,
) {
  const { assignment, effectiveFrom, salesUserId, customerId } = input;
  const split = effectiveFrom !== null && !sameInstant(effectiveFrom, assignment.effective_from);
  const { data, error } = await supabase.rpc(
    "change_wholesale_logistics_store_assignment",
    {
      p_assignment_id: assignment.id,
      p_customer_id: customerId,
      p_effective_from: effectiveFrom,
      p_sales_user_id: salesUserId,
    },
  );

  if (error) throw error;
  const returnedId = typeof data?.id === "string" ? data.id : null;
  if (!returnedId || (split ? returnedId === assignment.id : returnedId !== assignment.id)) {
    throw new Error("logistics_assignment_unconfirmed");
  }

  // 拆分会返回新区间编号。用原编号和新编号独立核对相邻边界及历史归属。
  const { data: rows, error: readError } = await supabase
    .from("wholesale_logistics_store_assignments")
    .select("id,store_name_normalized,sales_user_id,customer_id,effective_from,effective_to")
    .in("id", split ? [assignment.id, returnedId] : [returnedId]);
  if (readError) throw new Error("logistics_assignment_unconfirmed", { cause: readError });
  const current = rows?.find((row) => row.id === returnedId);
  if (!current
    || current.store_name_normalized !== assignment.store_name_normalized
    || current.sales_user_id !== salesUserId
    || current.customer_id !== customerId
    || !sameInstant(current.effective_from, split ? effectiveFrom : assignment.effective_from)
    || !sameInstant(current.effective_to, assignment.effective_to)) {
    throw new Error("logistics_assignment_unconfirmed");
  }
  if (split) {
    const previous = rows?.find((row) => row.id === assignment.id);
    if (!previous
      || previous.store_name_normalized !== assignment.store_name_normalized
      || previous.sales_user_id !== assignment.sales_user_id
      || previous.customer_id !== assignment.customer_id
      || !sameInstant(previous.effective_from, assignment.effective_from)
      || !sameInstant(previous.effective_to, effectiveFrom)) {
      throw new Error("logistics_assignment_unconfirmed");
    }
  }
}

function sameInstant(left: string | null, right: string | null) {
  return left === right || (left !== null && right !== null && Date.parse(left) === Date.parse(right));
}

export async function endWholesaleLogisticsAssignment(
  supabase: SupabaseClient,
  assignmentId: string,
  effectiveTo: string,
) {
  const { data, error } = await supabase.rpc(
    "end_wholesale_logistics_store_assignment",
    {
      p_assignment_id: assignmentId,
      p_effective_to: effectiveTo,
    },
  );

  if (error) throw error;
  if (!data || typeof data !== "object" || (data as { id?: unknown }).id !== assignmentId) {
    throw new Error("店铺分配没有确认结束。");
  }
}
