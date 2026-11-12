import type { SupabaseClient } from "@supabase/supabase-js";

import { parseOperationRequestReceipt } from "./operation-runs";
import type { SalesLead, SalesLeadContactInput } from "./sales-leads-types";

type LeadWriteName =
  | "claim_sales_lead"
  | "add_sales_lead_contact"
  | "return_sales_lead"
  | "assign_sales_lead";

type LeadWriteReceipt = Pick<
  SalesLead,
  "id" | "status" | "current_assignee_user_id" | "current_assignment_id" | "last_contact_at"
> & { updated_at: string };

function isClaimed(lead: LeadWriteReceipt) {
  return lead.status === "claimed" && Boolean(lead.current_assignment_id && lead.current_assignee_user_id);
}

export function claimSalesLead(supabase: SupabaseClient, leadId: string) {
  return runLeadRpc(supabase, "claim_sales_lead", { p_lead_id: leadId }, isClaimed);
}

export function addSalesLeadContact(supabase: SupabaseClient, input: SalesLeadContactInput) {
  return runLeadRpc(supabase, "add_sales_lead_contact", {
    p_lead_id: input.leadId,
    p_contact_channel: input.channel,
    p_contact_outcome: input.outcome,
    p_note: input.note,
    p_next_follow_up_at: input.nextFollowUpAt,
  }, (lead) => isClaimed(lead) && Boolean(lead.last_contact_at));
}

export function returnSalesLead(supabase: SupabaseClient, leadId: string, reason: string) {
  return runLeadRpc(supabase, "return_sales_lead", {
    p_lead_id: leadId,
    p_reason: reason,
  }, (lead) => lead.status === "hall" && lead.current_assignment_id === null && lead.current_assignee_user_id === null);
}

export function assignSalesLead(
  supabase: SupabaseClient,
  leadId: string,
  assigneeUserId: string,
  reason: string,
) {
  return runLeadRpc(supabase, "assign_sales_lead", {
    p_lead_id: leadId,
    p_assignee_user_id: assigneeUserId,
    p_reason: reason,
  }, (lead) => isClaimed(lead) && lead.current_assignee_user_id === assigneeUserId);
}

export async function requestSalesLeadSync(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("request_sales_lead_sync");
  if (error) throw error;
  return parseOperationRequestReceipt(data);
}

async function runLeadRpc(
  supabase: SupabaseClient,
  name: LeadWriteName,
  params: { p_lead_id: string } & Record<string, unknown>,
  matchesOutcome: (lead: LeadWriteReceipt) => boolean,
) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  const receipt = data as LeadWriteReceipt | null;

  // 这些事务返回已更新的线索行。空结果、其他线索或不匹配的终态都应继续核对。
  if (receipt?.id !== params.p_lead_id || !receipt.updated_at || !matchesOutcome(receipt)) {
    throw new Error("sales_lead_save_unconfirmed");
  }
  return receipt;
}
