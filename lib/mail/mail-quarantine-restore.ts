import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { requireMailAdministrator } from "./mail-identity";
import { databaseError } from "./mail-thread-access";
import { extractEmailAddresses } from "./mail-recipient-addresses";
import { loadInboundRecipientHistory } from "./mail-recipient-service";
import { decideMailRouting } from "./mail-routing";
import { createUniqueMailRef, loadMailRoutingAgents } from "./mail-routing-service";
import { decryptMailValue } from "./mail-security";
import type { MailIdentity } from "./mail-types";

function decryptContent(value: string) {
  return decryptMailValue(value, getMailEnv().contentKey);
}

/** 恢复前重新确认联系记录与负责人。最终会话版本和审计由同一个数据库事务更新。 */
export async function restoreMailThread(identity: MailIdentity, threadId: string, expectedVersion: number) {
  requireMailAdministrator(identity);
  const supabase = getSupabaseServiceRoleClient();
  const [threadResult, messageResult] = await Promise.all([
    supabase.from("mail_threads")
      .select("id,mailbox_id,assigned_user_id,ref_code,provider_thread_id,version")
      .eq("id", threadId).eq("intake_status", "quarantined").is("deleted_at", null).maybeSingle(),
    supabase.from("mail_messages")
      .select("from_enc,to_enc,cc_enc,subject_enc,text_body_enc,html_body_enc,raw_headers_enc")
      .eq("thread_id", threadId).eq("direction", "inbound").order("occurred_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (threadResult.error || messageResult.error) databaseError("隔离邮件暂时无法恢复。", threadResult.error ?? messageResult.error);
  if (!threadResult.data || !messageResult.data) throw new Error("隔离邮件不存在或缺少来信内容。");
  if (Number(threadResult.data.version) !== expectedVersion) throw new Error("会话已被其他人更新，请刷新后重试。");

  const message = messageResult.data;
  const headers = JSON.parse(decryptContent(String(message.raw_headers_enc))) as Record<string, string>;
  const senderEmail = extractEmailAddresses(decryptContent(String(message.from_enc)))[0];
  if (!senderEmail) throw new Error("隔离邮件没有可识别的发件邮箱。");
  const recipientHistory = await loadInboundRecipientHistory(
    String(threadResult.data.mailbox_id),
    senderEmail,
  );
  if (!recipientHistory.known) throw new Error("该发件邮箱不在系统已联系名单中，不能恢复到工作台。");
  const agents = await loadMailRoutingAgents();
  const routing = decideMailRouting({
    knownAssignedMemberId: threadResult.data.assigned_user_id as string | null,
    recipientHistoryMemberIds: recipientHistory.assignedMemberIds,
    deliveredTo: headers["delivered-to"] ? [headers["delivered-to"]] : [],
    to: JSON.parse(decryptContent(String(message.to_enc))) as string[],
    cc: JSON.parse(decryptContent(String(message.cc_enc))) as string[],
    subject: decryptContent(String(message.subject_enc)),
    textBody: decryptContent(String(message.text_body_enc)),
    htmlBody: decryptContent(String(message.html_body_enc)),
  }, agents);
  const assignedAgent = agents.find((agent) => agent.memberId === routing.assignedMemberId);
  const refCode = (threadResult.data.ref_code as string | null) ?? await createUniqueMailRef(assignedAgent?.refPrefix ?? "GENERAL");
  const { data, error } = await supabase.rpc("restore_mail_thread", {
    p_actor_user_id: identity.userId,
    p_thread_id: threadId,
    p_expected_version: expectedVersion,
    p_assigned_user_id: routing.assignedMemberId,
    p_ref_code: refCode,
    p_routing_source: routing.source,
    p_routing_evidence: { ...routing.evidence, conflicting: routing.conflicting },
  });
  const result = Array.isArray(data) ? data[0] : null;
  if (error?.message.includes("MAIL_VERSION_CONFLICT")) throw new Error("会话已被其他人更新，请刷新后重试。");
  if (error || !result || String(result.thread_id) !== threadId) databaseError("隔离邮件没有确认恢复。", error);
  return {
    threadId,
    assignedMemberId: result.assigned_user_id as string | null,
    refCode: String(result.ref_code),
    version: Number(result.version),
    notificationCount: Number(result.notification_count),
  };
}
