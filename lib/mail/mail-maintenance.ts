import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { renewSharedWatch } from "./mail-google-credentials";
import { deleteEncryptedObjects } from "./mail-storage";

export async function recoverInterruptedMailTasks() {
  const supabase = getSupabaseServiceRoleClient();
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const now = new Date().toISOString();
  const [inbound, outbound, notifications] = await Promise.all([
    // data 回执在本语句结束后逐项计数。
    supabase
      .from("mail_inbound_events")
      .update({
        status: "failed",
        available_at: now,
        locked_at: null,
        last_error: "后台处理中断，已重新排队。",
      })
      .eq("status", "processing")
      .lt("locked_at", cutoff)
      .select("id"),
    supabase
      .from("mail_outbound_jobs")
      .update({
        status: "retrying",
        next_attempt_at: now,
        locked_at: null,
        last_error: "后台处理中断，已重新排队。",
        updated_at: now,
      })
      .eq("status", "processing")
      .lt("locked_at", cutoff)
      .select("id"),
    supabase
      .from("mail_notifications")
      .update({
        status: "retrying",
        next_attempt_at: now,
        locked_at: null,
        last_error: "后台处理中断，已重新排队。",
        updated_at: now,
      })
      .eq("status", "processing")
      .lt("locked_at", cutoff)
      .select("id"),
  ]);
  const error = inbound.error ?? outbound.error ?? notifications.error;
  if (error) throw new Error("中断任务暂时无法恢复。", { cause: error });
  return (
    (inbound.data?.length ?? 0) + (outbound.data?.length ?? 0) + (notifications.data?.length ?? 0)
  );
}

export async function renewMailWatchIfNeeded() {
  const supabase = getSupabaseServiceRoleClient();
  const before = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  const watches = await supabase
    .from("mail_shared_mailbox_watches")
    .select("mailbox_id,expiration")
    .lt("expiration", before);
  if (watches.error) throw new Error("邮箱续订状态暂时无法读取。", { cause: watches.error });
  let renewed = 0;
  for (const watch of watches.data ?? []) {
    try {
      const result = await renewSharedWatch(watch.mailbox_id as string);
      const expiration = new Date(Number(result.expiration));
      if (!/^\d+$/.test(result.historyId) || !(expiration.getTime() > Date.now()))
        throw new Error("邮箱没有返回有效的续订期限。");
      const { data: savedData, error: savedError } = await supabase
        .from("mail_shared_mailbox_watches")
        .update({
          // Gmail 的 Watch 返回当前邮箱位置。收件 worker 尚未处理的历史必须沿旧游标继续读取。
          expiration: expiration.toISOString(),
          last_renewed_at: new Date().toISOString(),
          renewal_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("mailbox_id", watch.mailbox_id)
        .select("mailbox_id,expiration")
        .single();
      if (savedError || savedData?.mailbox_id !== watch.mailbox_id ||
          Date.parse(String(savedData.expiration)) !== expiration.getTime())
        throw new Error("邮箱续订结果没有确认保存。", { cause: savedError });
      renewed += 1;
    } catch (error) {
      const { data: failureData, error: failureError } = await supabase
        .from("mail_shared_mailbox_watches")
        .update({
          renewal_error: error instanceof Error ? error.message : "邮箱续订失败",
          updated_at: new Date().toISOString(),
        })
        .eq("mailbox_id", watch.mailbox_id)
        .select("mailbox_id,renewal_error")
        .single();
      if (failureError || failureData?.mailbox_id !== watch.mailbox_id)
        throw new Error("邮箱续订失败原因没有确认保存。", { cause: failureError });
    }
  }
  return renewed;
}

export async function cleanupExpiredMailUploads() {
  const supabase = getSupabaseServiceRoleClient();
  const expired = await supabase
    .from("mail_uploads")
    .select("id,storage_path")
    .is("consumed_at", null)
    .lt("expires_at", new Date().toISOString())
    .limit(100);
  if (expired.error) throw new Error("过期附件暂时无法读取。", { cause: expired.error });
  const rows = expired.data ?? [];
  if (rows.length === 0) return 0;
  await deleteEncryptedObjects(rows.map((row) => row.storage_path as string));
  const { data: removedData, error: removedError } = await supabase
    .from("mail_uploads")
    .delete()
    .in(
      "id",
      rows.map((row) => row.id),
    )
    .select("id");
  if (removedError || (removedData?.length ?? 0) !== rows.length)
    throw new Error("过期附件没有全部确认清理。", { cause: removedError });
  return rows.length;
}
