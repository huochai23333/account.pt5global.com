import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import type { MailIdentity } from "./mail-types";

export class MailThreadUnavailableError extends Error {
  constructor() {
    // 不区分不存在、已隔离和已转交，避免向无权查看的人确认邮件存在。
    super("没有找到可访问的邮件会话。");
  }
}

export function databaseError(message: string, error: unknown): never {
  throw new Error(message, { cause: error });
}

/** 服务密钥可跨行读取，先以当前身份约束归属与可见状态，再把编号交给具体操作。 */
export async function assertThreadAccess(identity: MailIdentity, threadId: string, allowQuarantinedForAdmin = false) {
  let query = getSupabaseServiceRoleClient()
    .from("mail_threads")
    .select("id,assigned_user_id,version")
    .eq("id", threadId)
    .is("deleted_at", null);
  if (!allowQuarantinedForAdmin || identity.role !== "administrator") query = query.eq("intake_status", "active");
  if (identity.role !== "administrator") query = query.eq("assigned_user_id", identity.userId);
  const { data, error } = await query.maybeSingle();
  if (error) databaseError("邮件会话权限暂时无法确认。", error);
  if (!data) throw new MailThreadUnavailableError();
  return data as { id: string; assigned_user_id: string | null; version: number };
}
