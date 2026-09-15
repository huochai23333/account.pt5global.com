import type { SupabaseClient } from "@supabase/supabase-js";

export type ApiRequestQuotaKind = "ai" | "wholesale_1688";

export type ApiRequestQuota = {
  allowed: boolean;
  leaseId: string | null;
  reason: string | null;
  retryAfterSeconds: number;
};

/**
 * 额度判断必须由数据库原子完成。前端进程只负责读取结果，不能自己数请求次数。
 */
export async function acquireApiRequestQuota(
  supabase: SupabaseClient,
  kind: ApiRequestQuotaKind,
): Promise<ApiRequestQuota> {
  const { data, error } = await supabase.rpc("acquire_api_request_quota", {
    p_kind: kind,
  });

  if (error) {
    throw error;
  }

  const value = Array.isArray(data) ? data[0] : data;
  const row = readRecord(value);

  if (!row || typeof row.allowed !== "boolean") {
    throw new Error("invalid API quota response");
  }

  return {
    allowed: row.allowed,
    leaseId: typeof row.lease_id === "string" ? row.lease_id : null,
    reason: typeof row.reason === "string" ? row.reason : null,
    retryAfterSeconds: normalizeRetryAfter(row.retry_after_seconds),
  };
}

/**
 * 释放失败不应打断已经返回给用户的流，但要记录到服务端日志便于排查。
 * 数据库租约本身还有过期时间，因此异常退出也不会永久占住并发名额。
 */
export async function releaseApiRequestQuota(
  supabase: SupabaseClient,
  leaseId: string | null,
) {
  if (!leaseId) {
    return;
  }

  const { data, error } = await supabase.rpc("release_api_request_quota", {
    p_lease_id: leaseId,
  });

  if (error) {
    console.error("API quota lease release failed", error);
    return;
  }

  if (data !== true) {
    console.error("API quota lease was not released", { leaseId });
  }
}

function normalizeRetryAfter(value: unknown) {
  const seconds = typeof value === "number" ? value : Number(value);

  return Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : 60;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}
