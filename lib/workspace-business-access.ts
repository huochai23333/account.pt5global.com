import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentSessionContext } from "./current-session-context";
import {
  enabledWorkspaceBusinessKeys,
  isEnabledWorkspaceBusinessKey,
  type EnabledWorkspaceBusinessKey,
  type WorkspaceBusinessKey,
} from "./workspace-config";
import { withRequestTimeout } from "./request-timeout";

export type { WorkspaceBusinessKey } from "./workspace-config";

export const WORKSPACE_BUSINESS_ACCESS_OPTIONS = enabledWorkspaceBusinessKeys;

export type WorkspaceBusinessAccessLabels = Record<WorkspaceBusinessKey, string>;

export function isWorkspaceBusinessAccessKey(
  value: unknown,
): value is EnabledWorkspaceBusinessKey {
  return typeof value === "string" && isEnabledWorkspaceBusinessKey(value);
}

export function normalizeWorkspaceBusinessAccess(
  value: unknown,
): EnabledWorkspaceBusinessKey[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueWorkspaceBusinessAccess(
    value.filter(isWorkspaceBusinessAccessKey),
  );
}

export function uniqueWorkspaceBusinessAccess(
  businesses: readonly WorkspaceBusinessKey[],
): EnabledWorkspaceBusinessKey[] {
  return enabledWorkspaceBusinessKeys.filter((business) =>
    businesses.includes(business),
  );
}

export function areWorkspaceBusinessAccessListsEqual(
  left: readonly WorkspaceBusinessKey[],
  right: readonly WorkspaceBusinessKey[],
) {
  const normalizedLeft = uniqueWorkspaceBusinessAccess(left);
  const normalizedRight = uniqueWorkspaceBusinessAccess(right);

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((business, index) => business === normalizedRight[index])
  );
}

export function workspaceBusinessAccessIncludes(
  businesses: readonly WorkspaceBusinessKey[],
  business: WorkspaceBusinessKey,
) {
  return businesses.includes(business);
}

export function getDefaultWorkspaceBusinessAccessForRole(
  role: string | null | undefined,
): EnabledWorkspaceBusinessKey[] {
  const registeredDefaults: WorkspaceBusinessKey[] = (() => {
    switch (role) {
    case "administrator":
      return ["tourism", "wholesale"];
    case "finance":
      // 财务按业务员同类权限进入批发业务，不再展示旅游业务。
      return ["wholesale"];
    case "salesman":
      return ["wholesale"];
    case "promoter":
      return ["tourism"];
    default:
      return ["tourism"];
    }
  })();

  // 本地回退和数据库结果使用同一套交集规则，停用业务不会因角色默认值重新出现。
  return uniqueWorkspaceBusinessAccess(registeredDefaults);
}

export async function getCurrentWorkspaceBusinessAccess(
  supabase: SupabaseClient,
): Promise<EnabledWorkspaceBusinessKey[]> {
  try {
    const { data, error } = await withRequestTimeout(
      supabase.rpc("get_current_workspace_business_access"),
    );

    if (error || !Array.isArray(data)) {
      // 正常结果不需要读取备用会话；只有业务权限查询失败时才承担这段额外等待。
      return getFallbackWorkspaceBusinessAccess(supabase);
    }

    const normalizedAccess = normalizeWorkspaceBusinessAccess(
      data.map((item) =>
        typeof item === "object" && item !== null && "business_key" in item
          ? item.business_key
          : null,
      ),
    );

    // RPC 成功返回空数组是“账号没有已启用业务”的有效结果，不能再使用角色默认值覆盖。
    return normalizedAccess;
  } catch {
    return getFallbackWorkspaceBusinessAccess(supabase);
  }
}

async function getFallbackWorkspaceBusinessAccess(
  supabase: SupabaseClient,
): Promise<EnabledWorkspaceBusinessKey[]> {
  try {
    const { user, role, status } = await getCurrentSessionContext(supabase);

    if (!user || status !== "active") {
      return [];
    }

    return getDefaultWorkspaceBusinessAccessForRole(role);
  } catch {
    return [];
  }
}
