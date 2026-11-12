import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";
import { withRequestTimeout } from "@/lib/request-timeout";

import { assertThreadAccess, databaseError } from "./mail-thread-access";
import type { MailIdentity, MailThreadState } from "./mail-types";

export async function markMailThreadRead(identity: MailIdentity, threadId: string, messageId: string) {
  // 事务锁住当前会话，按实际入站位置推进，并返回是否还有未读来信。
  const { data, error } = await withRequestTimeout(getSupabaseServiceRoleClient().rpc("mark_mail_thread_read", {
    p_thread_id: threadId,
    p_user_id: identity.userId,
    p_message_id: messageId,
    p_is_admin: identity.role === "administrator",
  }));
  if (error?.message.includes("MAIL_READ_FORBIDDEN")) throw new Error("没有找到可访问的邮件会话。");
  if (error?.message.includes("MAIL_READ_MESSAGE_MISSING")) throw new Error("指定来信不存在。");
  const receipt = Array.isArray(data) ? data[0] : null;
  if (error || receipt?.thread_id !== threadId || receipt.message_id !== messageId || typeof receipt.unread !== "boolean") {
    databaseError("邮件没有确认标记为已读。", error);
  }
  return { threadId, messageId, unread: receipt.unread as boolean };
}

export async function assignMailThread(identity: MailIdentity, input: {
  threadId: string;
  assignedMemberId: string;
  expectedVersion: number;
  reason?: string;
}) {
  await requireCurrentThreadVersion(identity, input.threadId, input.expectedVersion);
  const db = getSupabaseServiceRoleClient();
  const { data, error } = await withRequestTimeout(db.rpc("assign_mail_thread", {
    p_thread_id: input.threadId,
    p_actor_user_id: identity.userId,
    p_assigned_user_id: input.assignedMemberId,
    p_expected_version: input.expectedVersion,
    p_reason: input.reason ?? "manual",
  }));
  const result = Array.isArray(data) ? data[0] : null;
  if (error?.message.includes("MAIL_ASSIGNEE_UNAVAILABLE")) throw new Error("目标业务员当前不可用。");
  if (error?.message.includes("MAIL_VERSION_CONFLICT")) throw new Error("会话已被其他人更新，请刷新后重试。");
  const version = input.expectedVersion + 1;
  if (error || result?.thread_id !== input.threadId || result.assigned_user_id !== input.assignedMemberId || result.version !== version) {
    databaseError("会话没有确认转交。", error);
  }
  // 业务员转交后可能失去读权限。这里只用服务端身份核对本次授权写入的目标行和审计行。
  const [thread, event] = await Promise.all([
    withRequestTimeout(db.from("mail_threads").select("id")
      .eq("id", input.threadId).eq("assigned_user_id", input.assignedMemberId).eq("version", version)
      .eq("intake_status", "active").is("deleted_at", null).maybeSingle()),
    withRequestTimeout(db.from("mail_assignment_events").select("id")
      .eq("thread_id", input.threadId).eq("actor_user_id", identity.userId)
      .eq("assigned_user_id", input.assignedMemberId).eq("thread_version", version).maybeSingle()),
  ]);
  if (thread.error || event.error || !thread.data || !event.data) {
    databaseError("会话没有确认转交。", thread.error ?? event.error);
  }
  return {
    threadId: input.threadId,
    assignedMemberId: input.assignedMemberId,
    version,
  };
}

export async function updateMailThreadState(identity: MailIdentity, input: {
  threadId: string;
  state: MailThreadState;
  expectedVersion: number;
}) {
  await requireCurrentThreadVersion(identity, input.threadId, input.expectedVersion);
  const db = getSupabaseServiceRoleClient();
  const { data, error } = await withRequestTimeout(db.rpc("update_mail_thread_state", {
    p_thread_id: input.threadId,
    p_expected_version: input.expectedVersion,
    p_state: input.state,
  }));
  const result = Array.isArray(data) ? data[0] : null;
  if (error?.message.includes("MAIL_VERSION_CONFLICT")) throw new Error("会话已被其他人更新，请刷新后重试。");
  const version = input.expectedVersion + 1;
  if (error || result?.thread_id !== input.threadId || result.state !== input.state || result.version !== version) {
    databaseError("会话状态没有确认更新。", error);
  }
  const { data: confirmed, error: readError } = await withRequestTimeout(db.from("mail_threads").select("id")
    .eq("id", input.threadId).eq("state", input.state).eq("version", version)
    .eq("intake_status", "active").is("deleted_at", null).maybeSingle());
  if (readError || !confirmed) databaseError("会话状态没有确认更新。", readError);
  return { threadId: input.threadId, state: input.state, version };
}

/** 绑定授权检查所读到的版本。若随后转交或隔离，事务的原版本条件会拒绝迟到写入。 */
async function requireCurrentThreadVersion(identity: MailIdentity, threadId: string, expectedVersion: number) {
  const current = await assertThreadAccess(identity, threadId);
  if (current.version !== expectedVersion) throw new Error("会话已被其他人更新，请刷新后重试。");
}
