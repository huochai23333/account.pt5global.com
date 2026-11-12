import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentSessionContext } from "./current-session-context";
import type {
  SalesLeadBoard,
  SalesLeadDetail,
  SalesLeadPageData,
} from "./sales-leads-types";

const EMPTY_COUNTS = { hall: 0, mine: 0, converted: 0, allClaimed: 0 };

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

// 只允许业务错误键进入界面翻译，数据库的原始消息留在服务边界。
export function getSalesLeadErrorCode(error: unknown) {
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : "";
  return message.match(/sales_lead_[a-z_]+/)?.[0] ?? "unknown";
}
