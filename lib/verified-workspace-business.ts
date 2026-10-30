import type { SupabaseClient } from "@supabase/supabase-js";

import { AuthFlowError } from "./auth-failure";
import { isEnabledWorkspaceBusinessKey, type EnabledWorkspaceBusinessKey } from "./workspace-config";

/** 登录和入口守卫严格读取实际权限；空数组有效，读取失败不能换成角色默认业务。 */
export async function getVerifiedWorkspaceBusinesses(supabase: SupabaseClient): Promise<EnabledWorkspaceBusinessKey[]> {
  const { data, error } = await supabase.rpc("get_current_workspace_business_access");
  if (error) throw error;
  if (!Array.isArray(data)) throw new AuthFlowError("accessUnavailable");
  const businesses: EnabledWorkspaceBusinessKey[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object" || typeof row.business_key !== "string") {
      throw new AuthFlowError("accessUnavailable");
    }
    if (isEnabledWorkspaceBusinessKey(row.business_key) && !businesses.includes(row.business_key)) {
      businesses.push(row.business_key);
    }
  }
  return businesses;
}
