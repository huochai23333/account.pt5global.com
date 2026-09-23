import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminPersonAccountUpdatePayload } from "./admin-people";
import { withRequestTimeout } from "./request-timeout";
import type { WorkspaceBusinessKey } from "./workspace-business-access";

const ADMIN_PEOPLE_MUTATION_TIMEOUT_MS = 30_000;

export type AdminPersonBundleReceipt = {
  logId: string;
  targetUserId: string;
  role: string;
  status: string;
  city: string | null;
  workspaceBusinessAccess: WorkspaceBusinessKey[];
  salesmanBusinessBoards: string[];
  authSyncRequired: boolean;
};

/** 核心账号、业务范围和审计由单次数据库 RPC 共同提交，返回逐项可核对的回执。 */
export async function applyAdminPersonAccountBundle(
  supabase: SupabaseClient,
  input: AdminPersonAccountUpdatePayload,
  workspaceBusinessAccess: WorkspaceBusinessKey[],
): Promise<AdminPersonBundleReceipt> {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("admin_update_person_account_bundle", {
      p_target_user_id: input.targetUserId,
      p_next_role: input.nextRole,
      p_next_status: input.nextStatus,
      p_next_city: input.nextCity,
      p_note: input.note ?? null,
      p_expected: {
        role: input.expected.role,
        status: input.expected.status,
        city: input.expected.city,
        workspaceBusinessAccess: input.expected.workspace_business_access,
        salesmanBusinessBoards: input.expected.salesman_business_boards,
      },
      p_business_keys: workspaceBusinessAccess,
    }),
    { timeoutMs: ADMIN_PEOPLE_MUTATION_TIMEOUT_MS },
  );
  if (error || !data) throw error ?? new Error("账号修改结果没有确认。");
  return data as AdminPersonBundleReceipt;
}
