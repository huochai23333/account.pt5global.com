import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { assertThreadAccess, databaseError } from "./mail-thread-access";
import { createBlindIndex, decryptMailValue } from "./mail-security";
import type {
  MailIdentity,
  MailThreadDetail,
  MailThreadListItem,
  MailThreadQuery,
  MailThreadState,
  MailWorkspaceSummary,
} from "./mail-types";


type ThreadRow = {
  id: string;
  subject_enc: string;
  customer_email_enc: string;
  assigned_user_id: string | null;
  state: MailThreadState;
  ref_code: string | null;
  routing_source: MailThreadDetail["routingSource"];
  name_hint_user_ids: string[];
  last_message_at: string;
  version: number;
};

async function getDisplayNames(userIds: Array<string | null>) {
  const ids = [...new Set(userIds.filter((value): value is string => Boolean(value)))];
  if (ids.length === 0) return new Map<string, string>();
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("user_profiles")
    .select("user_id,name,email")
    .in("user_id", ids);
  if (error) databaseError("人员姓名暂时无法读取。", error);
  return new Map((data ?? []).map((row) => [
    row.user_id as string,
    String(row.name ?? "").trim() || String(row.email ?? "").trim() || "内部员工",
  ]));
}

async function getUnreadThreadIds(identity: MailIdentity, threads: ThreadRow[]) {
  if (threads.length === 0) return new Set<string>();
  // 详情、列表标记和列表筛选使用同一入站位置规则，避免刷新后出现不同结果。
  const { data, error } = await getSupabaseServiceRoleClient().rpc("get_mail_unread_thread_ids", {
    p_user_id: identity.userId,
    p_thread_ids: threads.map((thread) => thread.id),
  });
  if (error || !Array.isArray(data)) databaseError("邮件已读状态暂时无法读取。", error);
  return new Set<string>(data);
}

function decryptContent(value: string) {
  return decryptMailValue(value, getMailEnv().contentKey);
}

async function toThreadItems(identity: MailIdentity, rows: ThreadRow[]): Promise<MailThreadListItem[]> {
  const [names, unread] = await Promise.all([
    getDisplayNames(rows.map((row) => row.assigned_user_id)),
    getUnreadThreadIds(identity, rows),
  ]);
  return rows.map((row) => ({
    id: row.id,
    subject: decryptContent(row.subject_enc),
    customerEmail: decryptContent(row.customer_email_enc),
    assignedMemberId: row.assigned_user_id,
    assignedDisplayName: row.assigned_user_id ? names.get(row.assigned_user_id) ?? "内部员工" : null,
    state: row.state,
    refCode: row.ref_code ?? "",
    lastMessageAt: row.last_message_at,
    unread: unread.has(row.id),
    version: row.version,
  }));
}

/** 首屏摘要只包含邮箱健康和计数，邮件正文留给详情请求。 */
export async function getMailWorkspace(identity: MailIdentity): Promise<MailWorkspaceSummary> {
  const supabase = getSupabaseServiceRoleClient();
  let threadQuery = supabase
    .from("mail_threads")
    .select("id,subject_enc,customer_email_enc,assigned_user_id,state,ref_code,routing_source,name_hint_user_ids,last_message_at,version")
    .eq("intake_status", "active")
    .is("deleted_at", null);
  if (identity.role !== "administrator") threadQuery = threadQuery.eq("assigned_user_id", identity.userId);

  const [mailboxResult, threadsResult, profileResult, feishuResult, quarantineResult] = await Promise.all([
    supabase.from("mail_shared_mailboxes").select("email_masked,status,last_healthy_at,last_error").maybeSingle(),
    threadQuery,
    supabase.from("mail_agent_profiles").select("user_id").eq("user_id", identity.userId).eq("enabled", true).maybeSingle(),
    supabase.from("mail_feishu_bindings").select("user_id").eq("user_id", identity.userId).maybeSingle(),
    identity.role === "administrator"
      ? supabase.from("mail_threads").select("id", { count: "exact", head: true }).eq("intake_status", "quarantined").is("deleted_at", null)
      : Promise.resolve({ count: 0, error: null }),
  ]);
  for (const result of [mailboxResult, threadsResult, profileResult, feishuResult, quarantineResult]) {
    if (result.error) databaseError("邮件工作台状态暂时无法读取。", result.error);
  }
  const rows = (threadsResult.data ?? []) as ThreadRow[];
  const unread = await getUnreadThreadIds(identity, rows);
  const mailbox = mailboxResult.data as {
    email_masked: string;
    status: "active" | "paused" | "reauthorization_required";
    last_healthy_at: string | null;
    last_error: string | null;
  } | null;

  return {
    mailbox: {
      maskedEmail: mailbox?.email_masked ?? null,
      health: mailbox?.status === "reauthorization_required" ? "needs_reauthorization" : mailbox?.status ?? "not_connected",
      lastHealthyAt: mailbox?.last_healthy_at ?? null,
      lastError: mailbox?.last_error ?? null,
    },
    counts: {
      waitingPt5: rows.filter((row) => row.state === "waiting_pt5").length,
      waitingCustomer: rows.filter((row) => row.state === "waiting_customer").length,
      unread: unread.size,
      closed: rows.filter((row) => row.state === "closed").length,
      unassigned: rows.filter((row) => !row.assigned_user_id).length,
      quarantined: quarantineResult.count ?? 0,
    },
    canAdminister: identity.role === "administrator",
    feishuBound: Boolean(feishuResult.data),
    senderProfileReady: Boolean(profileResult.data),
  };
}

export async function queryMailThreads(identity: MailIdentity, filters: MailThreadQuery) {
  if (filters.scope !== "mine" && identity.role !== "administrator") {
    throw new Error("只有管理员可以查看这个邮件范围。");
  }
  const page = filters.page ?? 1;
  if (!Number.isSafeInteger(page) || page < 1) throw new Error("邮件页码无效。");
  // 当前页和完整筛选总数由同一次数据库读取返回，未读与范围条件不会漏掉后续会话。
  const { data, error } = await getSupabaseServiceRoleClient().rpc("query_mail_thread_page", {
    p_user_id: identity.userId,
    p_scope: filters.scope,
    p_state: filters.state ?? null,
    p_assignee_id: filters.assigneeId ?? null,
    p_customer_hash: filters.customer ? createBlindIndex(filters.customer, getMailEnv().emailHashSecret) : null,
    p_ref_code: filters.refCode?.trim().toUpperCase() || null,
    p_unread: filters.unread === true,
    p_page: page,
  });
  if (error) databaseError("邮件列表暂时无法读取。", error);
  const result = data as { threads?: ThreadRow[]; totalCount?: number } | null;
  if (!result || !Array.isArray(result.threads) || typeof result.totalCount !== "number") {
    throw new Error("邮件列表暂时无法读取。");
  }
  const items = await toThreadItems(identity, result.threads);
  return { threads: items, totalCount: result.totalCount, page, pageSize: 20 };
}

/** 确认当前会话可读后才读取密文，解密后的结果只返回给本次授权请求。 */
export async function getMailThread(identity: MailIdentity, threadId: string, options?: { includeQuarantined?: boolean }): Promise<MailThreadDetail> {
  await assertThreadAccess(identity, threadId, options?.includeQuarantined === true);
  const supabase = getSupabaseServiceRoleClient();
  const [threadResult, messagesResult] = await Promise.all([
    supabase.from("mail_threads")
      .select("id,subject_enc,customer_email_enc,assigned_user_id,state,ref_code,routing_source,name_hint_user_ids,last_message_at,version")
      .eq("id", threadId).is("deleted_at", null).single(),
    supabase.from("mail_messages")
      .select("id,direction,from_enc,to_enc,cc_enc,bcc_enc,subject_enc,text_body_enc,html_body_enc,occurred_at,arrival_order")
      .eq("thread_id", threadId).order("occurred_at", { ascending: true }).order("arrival_order", { ascending: true }),
  ]);
  if (threadResult.error || !threadResult.data) databaseError("邮件会话暂时无法读取。", threadResult.error);
  if (messagesResult.error) databaseError("邮件内容暂时无法读取。", messagesResult.error);
  const thread = threadResult.data as ThreadRow;
  const messages = messagesResult.data ?? [];
  // 只从实际返回的正文挑选入库位置最大的来信。详情加载中后来入库的邮件不会被顺带标已读。
  let latestInbound: typeof messages[number] | null = null;
  for (const message of messages) {
    if (message.direction === "inbound" && (!latestInbound || Number(message.arrival_order) > Number(latestInbound.arrival_order))) {
      latestInbound = message;
    }
  }
  const { data: attachmentRows, error: attachmentError } = messages.length
    ? await supabase.from("mail_attachments")
      .select("id,message_id,filename_enc,content_type_enc,byte_size,scan_status")
      .in("message_id", messages.map((message) => message.id))
    : { data: [], error: null };
  if (attachmentError) databaseError("邮件附件暂时无法读取。", attachmentError);
  const attachments = new Map<string, typeof attachmentRows>();
  for (const attachment of attachmentRows ?? []) {
    const group = attachments.get(attachment.message_id as string) ?? [];
    group.push(attachment);
    attachments.set(attachment.message_id as string, group);
  }
  const [item] = await toThreadItems(identity, [thread]);
  if (!item) throw new Error("邮件会话暂时无法读取。");
  return {
    ...item,
    readMessageId: latestInbound ? String(latestInbound.id) : null,
    routingSource: thread.routing_source,
    nameHintMemberIds: thread.name_hint_user_ids,
    messages: messages.map((message) => ({
      id: message.id as string,
      direction: message.direction as "inbound" | "outbound",
      from: decryptContent(String(message.from_enc)),
      to: JSON.parse(decryptContent(String(message.to_enc))) as string[],
      cc: JSON.parse(decryptContent(String(message.cc_enc))) as string[],
      bcc: JSON.parse(decryptContent(String(message.bcc_enc))) as string[],
      subject: decryptContent(String(message.subject_enc)),
      textBody: decryptContent(String(message.text_body_enc)),
      htmlBody: decryptContent(String(message.html_body_enc)),
      occurredAt: String(message.occurred_at),
      attachments: (attachments.get(message.id as string) ?? []).map((attachment) => ({
        id: attachment.id as string,
        filename: decryptContent(String(attachment.filename_enc)),
        contentType: decryptContent(String(attachment.content_type_enc)),
        byteSize: Number(attachment.byte_size),
        available: attachment.scan_status === "clean",
      })),
    })),
  };
}
