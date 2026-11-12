import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getPendingAuthMetadataUserIds } from "./admin-people-auth-metadata";
import type { AdminPeopleChangeLogRow, AdminPeoplePageData, AdminPersonRow } from "./admin-people-contract";
import { normalizeAdminPeopleChangeLogRows, normalizeAdminPeopleRows } from "./admin-people-rows";
import type { AppRole } from "./auth-routing";
import { queryCompleteDashboardRows } from "./dashboard-complete-query";
import { withRequestTimeout } from "./request-timeout";
import { type UserStatus, getCurrentSessionContext } from "./user-self-service";

const ADMIN_PEOPLE_CHANGE_LOG_LIMIT = 10;

export function canViewAdminPeople(
  role: AppRole | null,
  status: UserStatus | null,
) {
  return role === "administrator" && status === "active";
}

export async function getAdminPeoplePageData(
  supabase: SupabaseClient,
): Promise<AdminPeoplePageData> {
  const sessionContext = await getCurrentSessionContext(supabase);

  if (
    !sessionContext.user ||
    !canViewAdminPeople(sessionContext.role, sessionContext.status)
  ) {
    return createEmptyAdminPeoplePageData(sessionContext.user?.id ?? null);
  }

  // 已验证管理员后，才读取目录、审计与使用服务角色的 Auth 补偿状态。
  const [people, recentChanges, pendingAuthSyncUserIds] = await Promise.all([
    getAdminPeopleDirectory(supabase),
    getAdminPeopleChangeLogs(supabase, ADMIN_PEOPLE_CHANGE_LOG_LIMIT),
    getPendingAuthMetadataUserIds(),
  ]);

  return {
    hasPermission: true,
    currentViewerId: sessionContext.user.id,
    people,
    recentChanges,
    pendingAuthSyncUserIds,
  };
}

export async function getAdminPeopleDirectory(
  supabase: SupabaseClient,
): Promise<AdminPersonRow[]> {
  const { data, error } = await queryCompleteDashboardRows(
    supabase.rpc("get_admin_people_directory").order("created_at", { ascending: false }).order("user_id", { ascending: false }),
  );

  if (error) {
    throw error;
  }

  return normalizeAdminPeopleRows(data);
}

export async function getAdminPersonRowById(
  supabase: SupabaseClient,
  userId: string,
): Promise<AdminPersonRow | null> {
  const rows = await getAdminPeopleDirectory(supabase);

  return rows.find((row) => row.user_id === userId) ?? null;
}

export async function getAdminPeopleChangeLogs(
  supabase: SupabaseClient,
  limit = ADMIN_PEOPLE_CHANGE_LOG_LIMIT,
): Promise<AdminPeopleChangeLogRow[]> {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("get_admin_people_change_logs", {
      _limit: limit,
    }),
  );

  if (error) {
    throw error;
  }

  return normalizeAdminPeopleChangeLogRows(data);
}

/** 完整历史使用独立入口，账号页的最近十条摘要继续保持紧凑。 */
export async function getAdminPeopleChangeLogDirectory(supabase: SupabaseClient) {
  const { data, error } = await queryCompleteDashboardRows(
    supabase.rpc("get_admin_people_change_log_directory").order("created_at", { ascending: false }).order("id", { ascending: false }),
  );
  if (error) throw new Error("账号操作记录暂时无法读取，请稍后重试。", { cause: error });
  return normalizeAdminPeopleChangeLogRows(data);
}

function createEmptyAdminPeoplePageData(
  currentViewerId: string | null,
): AdminPeoplePageData {
  return {
    hasPermission: false,
    currentViewerId,
    people: [],
    recentChanges: [],
    pendingAuthSyncUserIds: [],
  };
}
