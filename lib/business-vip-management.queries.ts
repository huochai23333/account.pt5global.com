import { queryCompleteDashboardRows } from "./dashboard-complete-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentSessionContext } from "./current-session-context";
import type { WholesaleVipRpcRow } from "./business-vip-management.normalizers";
import {
  normalizeWholesaleVipRow,
} from "./business-vip-management.normalizers";
import type {
  BusinessVipPageData,
  BusinessVipPageMode,
} from "./business-vip-management.types";
import type { WorkspaceBusinessKey } from "./workspace-business-modules";
import { parseEnabledWorkspaceBusinessKey } from "./workspace-business-availability";

type RpcResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

// UI mode controls which actions are shown; row visibility is still enforced by RPCs.
export async function getBusinessVipPageData(
  supabase: SupabaseClient,
  business: WorkspaceBusinessKey,
  mode: BusinessVipPageMode,
): Promise<BusinessVipPageData> {
  const enabledBusiness = parseEnabledWorkspaceBusinessKey(business);
  const sessionContext = await getCurrentSessionContext(supabase);
  const currentRole = sessionContext.role;
  const currentUserId = sessionContext.user?.id ?? null;
  const canAdmin = currentRole === "administrator" && mode === "admin";

  return {
    business: enabledBusiness,
    canAdmin,
    canRequest: mode === "salesman",
    currentRole,
    currentUserId,
    mode,
    rows: await getWholesaleVipRows(supabase),
  };
}

async function getWholesaleVipRows(supabase: SupabaseClient) {
  const result = (await queryCompleteDashboardRows(
    supabase.rpc("list_wholesale_vip_management").order("customer_id"),
  )) as unknown as RpcResult<WholesaleVipRpcRow>;

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).flatMap((row) => normalizeWholesaleVipRow(row));
}
