import type { SupabaseClient } from "@supabase/supabase-js";
import { withRequestTimeout } from "./request-timeout";
import { fetchSalesLeadDetail } from "./sales-leads";
import type { SalesLeadCustomerInput, SalesLeadConversionResult } from "./sales-leads-types";

/** 独立读取真实客户和认领历史；接口返回成功本身不能证明转换已经完成。 */
export async function verifySalesLeadConversion(
  supabase: SupabaseClient,
  input: Pick<SalesLeadCustomerInput, "leadId" | "assignmentId">,
  expectedCustomerId?: string,
): Promise<SalesLeadConversionResult> {
  const detail = await fetchSalesLeadDetail(supabase, input.leadId);
  const { lead } = detail;
  const assignment = detail.assignments.find((item) => item.id === input.assignmentId);
  if (lead.status !== "converted" || !lead.customer_id || !lead.converted_at || !lead.converted_by_user_id
    || lead.current_assignment_id !== input.assignmentId || assignment?.ended_reason !== "converted"
    || !assignment.ended_at || (expectedCustomerId && lead.customer_id !== expectedCustomerId)) {
    throw new Error("sales_lead_save_unconfirmed");
  }
  const { data: customer, error } = await supabase.from("wholesale_customers")
    .select("id,unique_name,contact_details,assigned_sales_user_id,created_by_user_id,updated_at")
    .eq("id", lead.customer_id).maybeSingle<SalesLeadConversionResult["customer"]>();
  if (error || !customer?.id || !customer.unique_name || !customer.contact_details || !customer.updated_at
    || customer.assigned_sales_user_id !== lead.current_assignee_user_id
    || customer.created_by_user_id !== lead.converted_by_user_id) {
    throw new Error("sales_lead_save_unconfirmed");
  }
  return { lead, customer };
}

/** 请求失败后只核对已有结果；不在后台悄悄重发建档请求。用户重试也由认领周期保证幂等。 */
export async function convertSalesLeadToCustomer(supabase: SupabaseClient, input: SalesLeadCustomerInput) {
  let expectedCustomerId: string | undefined;
  try {
    const { data, error } = await withRequestTimeout(supabase.rpc("convert_sales_lead_to_customer", {
      p_lead_id: input.leadId, p_assignment_id: input.assignmentId,
      p_unique_name: input.uniqueName, p_contact_details: input.contactDetails,
      p_other_names: input.otherNames, p_source: input.source, p_notes: input.notes,
    }), { timeoutMs: 15_000, message: "sales_lead_save_unconfirmed" });
    // 数据库明确拒绝时返回日常语言提示；连接中断时结果可能已提交，需要继续独立核对。
    if (error && /sales_lead_[a-z_]+/.test(error.message)) throw error;
    const receipt = data as Partial<SalesLeadConversionResult> | null;
    if (receipt?.lead?.id === input.leadId && receipt.lead.status === "converted"
      && receipt.customer?.id === receipt.lead.customer_id) expectedCustomerId = receipt.customer.id;
  } catch (error) {
    const code = getSalesLeadCustomerErrorCode(error);
    if (code !== "sales_lead_save_unconfirmed" && code !== "unknown") throw error;
  }
  try {
    return await withRequestTimeout(verifySalesLeadConversion(supabase, input, expectedCustomerId),
      { timeoutMs: 10_000, message: "sales_lead_save_unconfirmed" });
  } catch {
    throw new Error("sales_lead_save_unconfirmed");
  }
}

export function getSalesLeadCustomerErrorCode(error: unknown) {
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : "";
  return message.match(/sales_lead_[a-z_]+/)?.[0] ?? "unknown";
}
