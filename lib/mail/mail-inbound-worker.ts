import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";
import { getMailEnv } from "./mail-env";
import { UnsupportedInboundMessageError } from "./mail-inbound-errors";
import { getSharedAccessToken, GoogleAuthorizationError } from "./mail-google-credentials";
import { getFullMessage, listHistoryMessageIds, listMessagesSince } from "./mail-google-inbound";
import { createBlindIndex } from "./mail-security";
import { persistInboundMessage } from "./mail-inbound-message";

type EventRow = {
  id: string;
  mailbox_id: string;
  target_history_id: string;
  attempt_count: number;
};

type InboundOutcome = "completed" | "failed" | "superseded";
type InboundSettlement =
  | { p_outcome: "completed"; p_history_id: string; p_recovered_since: string | null; p_candidate_count: number }
  | { p_outcome: "failed"; p_failure_reason: string; p_needs_authorization: boolean };

/** 邮件处理后才向数据库提交短事务。只有同一事件、同一次领取的回执能决定任务结果。 */
async function settleInboundEvent(event: EventRow, settlement: InboundSettlement): Promise<InboundOutcome> {
  const { data, error } = await getSupabaseServiceRoleClient().rpc("settle_mail_inbound_event", {
    p_event_id: event.id,
    p_attempt: event.attempt_count,
    ...settlement,
  }).single();
  const receipt = data as { event_id: string; attempt_count: number; outcome: InboundOutcome; history_id: string | null } | null;
  if (error || receipt?.event_id !== event.id || receipt.attempt_count !== event.attempt_count ||
      !["completed", "failed", "superseded"].includes(receipt.outcome)) {
    throw new Error("收件任务没有确认最终状态。", { cause: error });
  }
  if (receipt.outcome === "completed" && (!receipt.history_id || !/^\d+$/.test(receipt.history_id))) {
    throw new Error("收件任务没有确认最终游标。");
  }
  return receipt.outcome;
}

async function processEvent(event: EventRow) {
  const supabase = getSupabaseServiceRoleClient();
  const [mailbox, watch] = await Promise.all([
    supabase
      .from("mail_shared_mailboxes")
      .select("id,last_synced_at,cutover_started_at,status")
      .eq("id", event.mailbox_id)
      .single(),
    supabase
      .from("mail_shared_mailbox_watches")
      .select("history_id")
      .eq("mailbox_id", event.mailbox_id)
      .single(),
  ]);
  if (mailbox.error || watch.error || mailbox.data?.status !== "active")
    throw new Error("公司邮箱已暂停或缺少同步位置。");
  const accessToken = await getSharedAccessToken(event.mailbox_id);
  let messageIds: string[];
  let nextHistoryId = event.target_history_id;
  let recoveredSince: Date | null = null;
  try {
    const changes = await listHistoryMessageIds(accessToken, watch.data.history_id as string);
    messageIds = changes.ids;
    nextHistoryId = changes.latestHistoryId;
  } catch (error) {
    if (!(error instanceof Error) || (error as Error & { status?: number }).status !== 404)
      throw error;
    const cutover = new Date(mailbox.data.cutover_started_at as string);
    // 第一次回补从启用时间开始。通知可能延迟，不能拿通知时间划掉之前的来信。
    const last = mailbox.data.last_synced_at ? new Date(mailbox.data.last_synced_at as string) : cutover;
    recoveredSince = new Date(Math.max(cutover.getTime(), last.getTime()));
    messageIds = await listMessagesSince(accessToken, recoveredSince);
  }
  for (const messageId of messageIds) {
    const messageHash = createBlindIndex(messageId, getMailEnv().emailHashSecret);
    const rejected = await supabase
      .from("mail_inbound_rejection_receipts")
      .select("id")
      .eq("mailbox_id", event.mailbox_id)
      .eq("provider_message_hash", messageHash)
      .maybeSingle();
    if (rejected.error) throw new Error("来信隔离状态暂时无法确认。", { cause: rejected.error });
    if (rejected.data) continue;
    const message = await getFullMessage(accessToken, messageId);
    try {
      await persistInboundMessage(event.mailbox_id, accessToken, message);
    } catch (error) {
      if (!(error instanceof UnsupportedInboundMessageError)) throw error;
      // 永久输入错误只记录不可逆编号和原因，不阻塞同批后续邮件或游标推进。
      const occurredAt = new Date(Number(message.internalDate ?? Date.now())).toISOString();
      const { data: receipt, error: recordError } = await supabase
        .rpc("record_mail_rejected_inbound", {
          p_mailbox_id: event.mailbox_id,
          p_provider_message_hash: messageHash,
          p_reason: error.reason,
          p_occurred_at: occurredAt,
        })
        .single();
      const recorded = receipt as { receipt_id: number } | null;
      if (recordError || !recorded?.receipt_id)
        throw new Error("不支持来信的处理记录没有确认保存。", { cause: recordError });
    }
  }
  return settleInboundEvent(event, {
    p_outcome: "completed",
    p_history_id: nextHistoryId,
    p_recovered_since: recoveredSince?.toISOString() ?? null,
    p_candidate_count: messageIds.length,
  });
}

export async function processInboundEventBatch() {
  const supabase = getSupabaseServiceRoleClient();
  const { data: claimedData, error: claimedError } = await supabase.rpc(
    "claim_mail_inbound_events",
    { batch_size: 20 },
  );
  if (claimedError) throw new Error("收件任务暂时无法领取。", { cause: claimedError });
  const events = (claimedData ?? []) as EventRow[];
  let succeededCount = 0;
  let failedCount = 0;
  for (const event of events) {
    let outcome: InboundOutcome;
    try {
      outcome = await processEvent(event);
    } catch (error) {
      // 事务提交后即使响应丢失，失败入口也只会读回同一次领取的已完成凭证。
      outcome = await settleInboundEvent(event, {
        p_outcome: "failed",
        p_failure_reason: error instanceof Error ? error.message : "公司邮箱同步失败",
        p_needs_authorization: error instanceof GoogleAuthorizationError,
      });
    }
    if (outcome === "completed") succeededCount += 1;
    else failedCount += 1;
  }
  return { processedCount: events.length, succeededCount, failedCount };
}
