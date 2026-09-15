import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentSessionContext } from "./current-session-context";
import { parseOperationRequestReceipt } from "./operation-runs";
import type {
  SalesLead,
  SalesLeadBoard,
  SalesLeadContactInput,
  SalesLeadDetail,
  SalesLeadPageData,
} from "./sales-leads-types";

const EMPTY_COUNTS = { hall: 0, mine: 0, used: 0, allClaimed: 0 };

/** 服务端首次加载只读取当前账号能看到的数据，页面不会先闪出越权内容再隐藏。 */
export async function getSalesLeadPageData(
  supabase: SupabaseClient,
  board: SalesLeadBoard = "hall",
): Promise<SalesLeadPageData> {
  const session = await getCurrentSessionContext(supabase);
  const hasPermission =
    session.status === "active" &&
    (session.role === "administrator" || session.role === "salesman");

  if (!hasPermission) {
    return {
      board,
      boardCounts: EMPTY_COUNTS,
      items: [],
      limit: 20,
      offset: 0,
      totalCount: 0,
      salespeople: [],
      syncState: null,
      recentImportRuns: [],
      canManage: false,
      hasPermission: false,
    };
  }

  return fetchSalesLeadPage(supabase, {
    board,
    canManage: session.role === "administrator",
  });
}

export async function fetchSalesLeadPage(
  supabase: SupabaseClient,
  input: {
    board: SalesLeadBoard;
    canManage: boolean;
    search?: string;
    assigneeUserId?: string | null;
    offset?: number;
  },
): Promise<SalesLeadPageData> {
  const { data, error } = await supabase.rpc("get_sales_lead_page", {
    p_board: input.board,
    p_search: input.search?.trim() || null,
    p_assignee_user_id: input.assigneeUserId || null,
    p_limit: 20,
    p_offset: input.offset ?? 0,
  });

  if (error) throw error;
  const value = (data ?? {}) as Partial<SalesLeadPageData>;

  return {
    board: input.board,
    boardCounts: value.boardCounts ?? EMPTY_COUNTS,
    items: value.items ?? [],
    limit: value.limit ?? 20,
    offset: value.offset ?? 0,
    totalCount: value.totalCount ?? 0,
    salespeople: value.salespeople ?? [],
    syncState: value.syncState ?? null,
    recentImportRuns: value.recentImportRuns ?? [],
    canManage: input.canManage,
    hasPermission: true,
  };
}

export async function fetchSalesLeadDetail(
  supabase: SupabaseClient,
  leadId: string,
): Promise<SalesLeadDetail> {
  const { data, error } = await supabase.rpc("get_sales_lead_detail", {
    p_lead_id: leadId,
  });
  if (error) throw error;
  return data as SalesLeadDetail;
}

export async function claimSalesLead(supabase: SupabaseClient, leadId: string) {
  return runLeadRpc(supabase, "claim_sales_lead", { p_lead_id: leadId });
}

export async function addSalesLeadContact(
  supabase: SupabaseClient,
  input: SalesLeadContactInput,
) {
  return runLeadRpc(supabase, "add_sales_lead_contact", {
    p_lead_id: input.leadId,
    p_contact_channel: input.channel,
    p_contact_outcome: input.outcome,
    p_note: input.note,
    p_next_follow_up_at: input.nextFollowUpAt,
  });
}

export async function returnSalesLead(
  supabase: SupabaseClient,
  leadId: string,
  reason: string,
) {
  return runLeadRpc(supabase, "return_sales_lead", {
    p_lead_id: leadId,
    p_reason: reason,
  });
}

export async function markSalesLeadUsed(
  supabase: SupabaseClient,
  leadId: string,
  summary: string,
) {
  return runLeadRpc(supabase, "mark_sales_lead_used", {
    p_lead_id: leadId,
    p_summary: summary,
  });
}

export async function assignSalesLead(
  supabase: SupabaseClient,
  leadId: string,
  assigneeUserId: string,
  reason: string,
) {
  return runLeadRpc(supabase, "assign_sales_lead", {
    p_lead_id: leadId,
    p_assignee_user_id: assigneeUserId,
    p_reason: reason,
  });
}

export async function reopenSalesLead(
  supabase: SupabaseClient,
  leadId: string,
  reason: string,
) {
  return runLeadRpc(supabase, "reopen_sales_lead", {
    p_lead_id: leadId,
    p_reason: reason,
  });
}

export async function requestSalesLeadSync(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("request_sales_lead_sync");
  if (error) throw error;
  return parseOperationRequestReceipt(data);
}

async function runLeadRpc(
  supabase: SupabaseClient,
  name: string,
  params: Record<string, unknown>,
): Promise<SalesLead> {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data as SalesLead;
}
