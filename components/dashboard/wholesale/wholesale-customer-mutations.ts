import type { SupabaseClient } from "@supabase/supabase-js";
import { requireMutationRecord } from "@/lib/mutation-receipts";

import {
  optionalString,
  requiredString,
  splitList,
} from "./wholesale-action-utils";

export async function addWholesaleCustomerOtherNames(
  supabase: SupabaseClient,
  formData: FormData,
) {
  const customerId = requiredString(formData.get("customer_id"));
  const nextNames = splitList(formData.get("other_names"));

  if (nextNames.length === 0) {
    throw new Error("wholesale_customer_other_name_required");
  }

  // 数据库在同一事务内锁定客户并合并别名，浏览器不再覆盖之前读取的数组。
  const { data, error } = await supabase.rpc("append_wholesale_customer_other_names", {
    p_customer_id: customerId,
    p_other_names: nextNames,
  });
  if (error) throw error;
  const receipt = requireMutationRecord(data, "wholesale_customer_alias_receipt_missing");
  if (
    receipt.id !== customerId ||
    !Array.isArray(receipt.other_names) ||
    receipt.other_names.length === 0 ||
    typeof receipt.changed !== "boolean"
  ) {
    throw new Error("wholesale_customer_alias_receipt_invalid");
  }
  return receipt.changed;
}

export async function updateWholesaleCustomer(
  supabase: SupabaseClient,
  formData: FormData,
) {
  const customerId = requiredString(formData.get("customer_id"));
  const expectedRevision = Number(requiredString(formData.get("expected_revision")));
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    throw new Error("wholesale_customer_edit_revision_missing");
  }
  const { data, error } = await supabase.rpc("update_wholesale_customer", {
    p_assigned_sales_user_id: optionalString(
      formData.get("assigned_sales_user_id"),
    ),
    p_contact_details: optionalString(formData.get("contact_details")),
    p_customer_id: customerId,
    p_expected_revision: expectedRevision,
    p_notes: optionalString(formData.get("notes")),
    p_other_names: splitList(formData.get("other_names")),
    p_source: optionalString(formData.get("source")),
    p_unique_name: requiredString(formData.get("unique_name")),
  });

  if (error) throw error;
  const receipt = requireMutationRecord(data, "客户资料没有返回保存结果。");
  if (receipt.id !== customerId) throw new Error("保存结果与当前客户不一致。");
  // 只有这个档案实际进入下一个版本，页面才可以关闭表单并刷新。
  if (receipt.edit_revision !== expectedRevision + 1) {
    throw new Error("wholesale_customer_edit_revision_unconfirmed");
  }
}

export async function deleteWholesaleCustomer(
  supabase: SupabaseClient,
  customerId: string,
) {
  // verified-rpc: 删除 RPC 后按同一客户编号查询，确认数据库中已不存在该记录。
  const { error } = await supabase.rpc("delete_wholesale_customer", {
    p_customer_id: customerId,
  });

  if (error) throw error;
  const { data: remaining, error: verificationError } = await supabase
    .from("wholesale_customers")
    .select("id")
    .eq("id", customerId)
    .maybeSingle<{ id: string }>();
  if (verificationError) throw verificationError;
  if (remaining) throw new Error("客户没有删除成功。");
}
