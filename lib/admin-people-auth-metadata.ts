import type { SupabaseClient, User } from "@supabase/supabase-js";

import { REQUEST_TIMEOUT_ERROR_NAME, withRequestTimeout } from "./request-timeout";
import { getSupabaseServiceRoleClient } from "./supabase-admin-server";

const ADMIN_PEOPLE_MUTATION_TIMEOUT_MS = 30_000;
const activeSyncJobs = new Map<string, Promise<boolean>>();

type PendingSync = { user_id: string; desired_role: string; desired_status: string; sync_status: string; updated_at: string };

/** Auth 不参加数据库事务；每次读取待办前把已标记同步但实际不符的账号重新列入待办。 */
export async function getPendingAuthMetadataUserIds(): Promise<string[]> {
  const serviceSupabase = getSupabaseServiceRoleClient();
  const { data, error } = await withRequestTimeout(
    // 数据库直接比较 Auth 实际字段，避免旧写入晚到且本进程失联时遗漏恢复入口。
    serviceSupabase.rpc("reconcile_admin_auth_metadata_sync"),
    { timeoutMs: ADMIN_PEOPLE_MUTATION_TIMEOUT_MS },
  );
  if (error) throw error;
  const rows = (data ?? []) as Array<{ user_id: string }>;
  return rows.map((row) => row.user_id).filter((id): id is string => typeof id === "string");
}

export function syncPendingTargetAuthMetadata(targetUserId: string): Promise<boolean> {
  // 同一服务器进程内，一个账号同时只执行一次外部 Auth 写入；后来的调整由循环读取最新版本。
  const running = activeSyncJobs.get(targetUserId);
  if (running) return running;
  const job = performTargetAuthMetadataSync(targetUserId).finally(() => {
    if (activeSyncJobs.get(targetUserId) === job) activeSyncJobs.delete(targetUserId);
  });
  activeSyncJobs.set(targetUserId, job);
  return job;
}

async function performTargetAuthMetadataSync(targetUserId: string): Promise<boolean> {
  try {
    const serviceSupabase = getSupabaseServiceRoleClient();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const desired = await readSyncTarget(serviceSupabase, targetUserId);
      if (!desired) return false;
      // 每次写 Auth 前后都重新读取期望状态；旧请求晚返回时必须修正到最新版本。
      if (!await matchesDatabaseAccount(serviceSupabase, targetUserId, desired)) return false;
      const authUser = await getTargetAuthUser(serviceSupabase, targetUserId);
      const authMatches = authUser.app_metadata?.role === desired.desired_role &&
        authUser.app_metadata?.status === desired.desired_status;

      if (desired.sync_status === "synced" && !authMatches) {
        // 已同步标志不能替代 Auth 实际内容，偏差需要重新进入待同步。
        const { data: resetReceipt, error: resetError } = await serviceSupabase.from("admin_auth_metadata_sync")
          .update({ sync_status: "pending", synced_at: null })
          .eq("user_id", targetUserId).eq("updated_at", desired.updated_at).eq("sync_status", "synced")
          .select("user_id,sync_status").maybeSingle();
        if (resetError || resetReceipt?.sync_status !== "pending") return false;
        continue;
      }
      if (!authMatches) {
        const update = serviceSupabase.auth.admin.updateUserById(targetUserId, {
          app_metadata: { ...readAppMetadata(authUser), role: desired.desired_role, status: desired.desired_status },
        });
        try {
          const { error } = await withRequestTimeout(update, { timeoutMs: ADMIN_PEOPLE_MUTATION_TIMEOUT_MS });
          if (error) return false;
        } catch (error) {
          if (error instanceof Error && error.name === REQUEST_TIMEOUT_ERROR_NAME) {
            // 超时不代表 Auth 写入停止；晚成功时继续核对最新数据库状态。
            void Promise.resolve(update).then(({ error: lateError }) => {
              if (!lateError) void syncPendingTargetAuthMetadata(targetUserId);
            }).catch(() => undefined);
          }
          return false;
        }
      }

      const latest = await readSyncTarget(serviceSupabase, targetUserId);
      const confirmed = await getTargetAuthUser(serviceSupabase, targetUserId);
      if (!latest || latest.updated_at !== desired.updated_at ||
        confirmed.app_metadata?.role !== latest.desired_role ||
        confirmed.app_metadata?.status !== latest.desired_status) continue;
      if (latest.sync_status === "synced") return true;
      const { data: receipt, error: receiptError } = await withRequestTimeout(
        serviceSupabase.from("admin_auth_metadata_sync")
          .update({ sync_status: "synced", synced_at: new Date().toISOString() })
          .eq("user_id", targetUserId).eq("updated_at", latest.updated_at)
          .eq("desired_role", latest.desired_role).eq("desired_status", latest.desired_status)
          .eq("sync_status", "pending").select("user_id,sync_status").maybeSingle(),
        { timeoutMs: ADMIN_PEOPLE_MUTATION_TIMEOUT_MS },
      );
      if (!receiptError && receipt?.sync_status === "synced") return true;
    }
    return false;
  } catch {
    // 错误留在 pending，页面必须显示部分完成；下次重试继续使用同一目标状态。
    return false;
  }
}

async function readSyncTarget(serviceSupabase: SupabaseClient, targetUserId: string): Promise<PendingSync | null> {
  const { data, error } = await withRequestTimeout(
    serviceSupabase.from("admin_auth_metadata_sync")
      .select("user_id,desired_role,desired_status,sync_status,updated_at")
      .eq("user_id", targetUserId).maybeSingle(),
    { timeoutMs: ADMIN_PEOPLE_MUTATION_TIMEOUT_MS },
  );
  if (error || !data) return null;
  return data as PendingSync;
}

async function matchesDatabaseAccount(serviceSupabase: SupabaseClient, targetUserId: string, desired: PendingSync) {
  const [{ data: profile, error: profileError }, { data: roleData, error: roleError }] = await Promise.all([
    withRequestTimeout(serviceSupabase.from("user_profiles").select("status").eq("user_id", targetUserId).single(), { timeoutMs: ADMIN_PEOPLE_MUTATION_TIMEOUT_MS }),
    withRequestTimeout(serviceSupabase.from("user_roles_data").select("user_roles(role)").eq("user_id", targetUserId).single(), { timeoutMs: ADMIN_PEOPLE_MUTATION_TIMEOUT_MS }),
  ]);
  const role = (roleData?.user_roles as { role?: string } | null)?.role;
  return !profileError && !roleError && profile?.status === desired.desired_status && role === desired.desired_role;
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
