import type { SupabaseClient, User } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";
import { getSupabaseServiceRoleClient } from "./supabase-admin-server";

const ADMIN_PEOPLE_MUTATION_TIMEOUT_MS = 30_000;

type PendingSync = { user_id: string; desired_role: string; desired_status: string; sync_status: string };

/** Auth 不参加数据库事务；pending 行保存期望状态，失败后管理员可从页面重试。 */
export async function getPendingAuthMetadataUserIds(): Promise<string[]> {
  const serviceSupabase = getSupabaseServiceRoleClient();
  const { data, error } = await withRequestTimeout(
    serviceSupabase.from("admin_auth_metadata_sync").select("user_id").eq("sync_status", "pending"),
    { timeoutMs: ADMIN_PEOPLE_MUTATION_TIMEOUT_MS },
  );
  if (error) throw error;
  return (data ?? []).map((row) => row.user_id).filter((id): id is string => typeof id === "string");
}

export async function syncPendingTargetAuthMetadata(targetUserId: string): Promise<boolean> {
  try {
    const serviceSupabase = getSupabaseServiceRoleClient();
    const { data: pending, error: pendingError } = await withRequestTimeout(
      serviceSupabase.from("admin_auth_metadata_sync")
        .select("user_id,desired_role,desired_status,sync_status")
        .eq("user_id", targetUserId).maybeSingle(),
      { timeoutMs: ADMIN_PEOPLE_MUTATION_TIMEOUT_MS },
    );
    if (pendingError || !pending) return false;
    if (pending.sync_status === "synced") return true;
    if (pending.sync_status !== "pending") return false;

    const desired = pending as PendingSync;
    // 在触碰 Auth 前先核对数据库权威角色和状态，避免旧的补偿记录覆盖新调整。
    const [{ data: profile, error: profileError }, { data: roleData, error: roleError }] = await Promise.all([
      withRequestTimeout(serviceSupabase.from("user_profiles").select("status").eq("user_id", targetUserId).single(), { timeoutMs: ADMIN_PEOPLE_MUTATION_TIMEOUT_MS }),
      withRequestTimeout(serviceSupabase.from("user_roles_data").select("user_roles(role)").eq("user_id", targetUserId).single(), { timeoutMs: ADMIN_PEOPLE_MUTATION_TIMEOUT_MS }),
    ]);
    const role = (roleData?.user_roles as { role?: string } | null)?.role;
    if (profileError || roleError || profile?.status !== desired.desired_status || role !== desired.desired_role) return false;

    const authUser = await getTargetAuthUser(serviceSupabase, targetUserId);
    const { error: authError } = await withRequestTimeout(
      serviceSupabase.auth.admin.updateUserById(targetUserId, {
        app_metadata: { ...readAppMetadata(authUser), role: desired.desired_role, status: desired.desired_status },
      }),
      { timeoutMs: ADMIN_PEOPLE_MUTATION_TIMEOUT_MS },
    );
    if (authError) return false;
    const confirmedUser = await getTargetAuthUser(serviceSupabase, targetUserId);
    if (confirmedUser.app_metadata?.role !== desired.desired_role ||
      confirmedUser.app_metadata?.status !== desired.desired_status) return false;

    const { data: receipt, error: receiptError } = await withRequestTimeout(
      serviceSupabase.from("admin_auth_metadata_sync")
        .update({ sync_status: "synced", synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", targetUserId)
        .eq("desired_role", desired.desired_role)
        .eq("desired_status", desired.desired_status)
        .eq("sync_status", "pending")
        .select("user_id,sync_status").maybeSingle(),
      { timeoutMs: ADMIN_PEOPLE_MUTATION_TIMEOUT_MS },
    );
    return !receiptError && receipt?.sync_status === "synced";
  } catch {
    // 错误留在 pending，页面必须显示部分完成；下次重试继续使用同一目标状态。
    return false;
  }
}

async function getTargetAuthUser(serviceSupabase: SupabaseClient, targetUserId: string) {
  const { data, error } = await withRequestTimeout(
    serviceSupabase.auth.admin.getUserById(targetUserId),
    { timeoutMs: ADMIN_PEOPLE_MUTATION_TIMEOUT_MS },
  );
  if (error || !data.user) throw error ?? new Error("auth_user_missing");
  return data.user;
}

function readAppMetadata(user: User): Record<string, unknown> {
  return typeof user.app_metadata === "object" && user.app_metadata !== null ? user.app_metadata : {};
}
