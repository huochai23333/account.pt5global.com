import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";
import { getMailEnv } from "./mail-env";
import { getSharedAccessToken } from "./mail-google-credentials";
import { findSentMessageByRfcId, sendRawMessage, verifySentMessage } from "./mail-google-outbound";
import { decryptMailValue } from "./mail-security";
import type { OutboundMessageInput } from "./mail-types";
import type { JobRow } from "./mail-outbound-types";
import { buildMime, loadContext } from "./mail-outbound-content";
import { finalizeSentJob } from "./mail-outbound-persistence";

async function processJob(job: JobRow) {
  const payload = JSON.parse(
    decryptMailValue(job.payload_enc, getMailEnv().contentKey),
  ) as OutboundMessageInput;
  const context = await loadContext(job);
  const mime = await buildMime(job, payload, context);
  const accessToken = await getSharedAccessToken(job.mailbox_id);
  let providerMessageId = job.provider_message_id;
  let providerThreadId = job.provider_thread_id;
  if (!providerMessageId || !providerThreadId) {
    let sent: { id: string; threadId: string };
    if (job.dispatch_started_at) {
      // 只要已经开始对外发送，结果不明时只查询供应商；重试发送会造成重复邮件。
      const found = await findSentMessageByRfcId(
        accessToken,
        job.rfc_message_id ?? mime.rfcMessageId,
      );
      if (!found) throw new Error("已开始发送，正在等待公司邮箱确认结果。");
      sent = found;
    } else {
      const dispatchStartedAt = new Date().toISOString();
      // 先持久化发送标识。即使后面的 Gmail 响应或数据库回执丢失，下一次也只能查询。
      job.dispatch_started_at = dispatchStartedAt;
      job.rfc_message_id = mime.rfcMessageId;
      const { data: preparedData, error: preparedError } = await getSupabaseServiceRoleClient()
        .from("mail_outbound_jobs")
        .update({
          dispatch_started_at: dispatchStartedAt,
          rfc_message_id: mime.rfcMessageId,
          updated_at: dispatchStartedAt,
        })
        .eq("id", job.id)
        .is("dispatch_started_at", null)
        .select("id")
        .single();
      if (preparedError || preparedData?.id !== job.id)
        throw new Error("发送标识没有确认保存。", { cause: preparedError });
      sent = await sendRawMessage(accessToken, mime.raw, context.providerThreadId ?? undefined);
    }
    // 编号写库失败时只按已持久化的 Message-ID 查 Gmail，不能因为内存里有编号就结束对账。
    const { data: recordedData, error: recordedError } = await getSupabaseServiceRoleClient()
      .from("mail_outbound_jobs")
      .update({
        provider_message_id: sent.id,
        provider_thread_id: sent.threadId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .select("provider_message_id,provider_thread_id")
      .single();
    if (recordedError || recordedData?.provider_message_id !== sent.id)
      throw new Error("Gmail 返回编号没有确认保存。", { cause: recordedError });
    job.provider_message_id = sent.id;
    job.provider_thread_id = sent.threadId;
    providerMessageId = sent.id;
    providerThreadId = sent.threadId;
    // 核验 SENT 失败时已有可靠编号，可以立即标记为部分失败等待人工核对。
  }
  await verifySentMessage(accessToken, providerMessageId);
  await finalizeSentJob(job, payload, context, mime, providerMessageId, providerThreadId);
}

export async function processOutboundJobBatch() {
  const supabase = getSupabaseServiceRoleClient();
  const { data: claimedData, error: claimedError } = await supabase.rpc(
    "claim_mail_outbound_jobs",
    { batch_size: 20 },
  );
  if (claimedError) throw new Error("发信任务暂时无法领取。", { cause: claimedError });
  const jobs = (claimedData ?? []) as JobRow[];
  let succeededCount = 0;
  let failedCount = 0;
  for (const job of jobs) {
    try {
      await processJob(job);
      succeededCount += 1;
    } catch (error) {
      failedCount += 1;
      // Gmail 已给出邮件编号却没有最终凭证时立即标记需人工核对；继续自动重试会长时间误导页面。
      // 只有已经发起请求但尚无编号的情况才按同一 Message-ID 查询，绝不重新投递。
      const terminal =
        job.dispatch_started_at || job.provider_message_id ? "partial_failed" : "failed";
      const nextStatus = job.provider_message_id
        ? "partial_failed"
        : job.attempt_count < 4
          ? "retrying"
          : terminal;
      const { data: savedData, error: savedError } = await supabase
        .from("mail_outbound_jobs")
        .update({
          status: nextStatus,
          next_attempt_at: new Date(
            Date.now() + Math.min(60_000 * 2 ** job.attempt_count, 3_600_000),
          ).toISOString(),
          locked_at: null,
          last_error: error instanceof Error ? error.message : "邮件发送失败",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .select("id,status")
        .single();
      if (savedError || savedData?.status !== nextStatus)
        throw new Error("发信失败状态没有确认保存。", { cause: savedError });
    }
  }
  return { processedCount: jobs.length, succeededCount, failedCount };
}
