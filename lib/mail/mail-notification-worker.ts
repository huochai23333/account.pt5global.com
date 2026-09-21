import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { decryptMailValue } from "./mail-security";

type NotificationRow = {
  id: string;
  message_id: string;
  target_user_id: string;
  reason: "assigned_inbound" | "unassigned_inbound" | "reassigned";
  attempt_count: number;
};

async function getFeishuAppToken() {
  const appId = process.env.FEISHU_APP_ID?.trim();
  const appSecret = process.env.FEISHU_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new Error("飞书应用尚未配置。");
  const baseUrl = process.env.MAIL_FEISHU_API_BASE_URL?.replace(/\/$/, "") ?? "https://open.feishu.cn";
  const response = await fetch(`${baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const result = (await response.json()) as { code?: number; msg?: string; tenant_access_token?: string };
  if (!response.ok || result.code !== 0 || !result.tenant_access_token) throw new Error(result.msg ?? "飞书应用令牌获取失败。");
  return result.tenant_access_token;
}

async function sendFeishuMessage(openId: string, text: string) {
  const baseUrl = process.env.MAIL_FEISHU_API_BASE_URL?.replace(/\/$/, "") ?? "https://open.feishu.cn";
  const response = await fetch(`${baseUrl}/open-apis/im/v1/messages?receive_id_type=open_id`, {
    method: "POST",
    headers: { authorization: `Bearer ${await getFeishuAppToken()}`, "content-type": "application/json" },
    body: JSON.stringify({ receive_id: openId, msg_type: "text", content: JSON.stringify({ text }) }),
  });
  const result = (await response.json()) as { code?: number; msg?: string; data?: { message_id?: string } };
  if (!response.ok || result.code !== 0 || !result.data?.message_id) throw new Error(result.msg ?? "飞书消息没有确认送达。");
  return result.data.message_id;
}

async function processNotification(notification: NotificationRow) {
  const supabase = getSupabaseServiceRoleClient();
  const [binding, message] = await Promise.all([
    supabase.from("mail_feishu_bindings").select("open_id").eq("user_id", notification.target_user_id).maybeSingle(),
    supabase.from("mail_messages").select("thread_id,subject_enc").eq("id", notification.message_id).single(),
  ]);
  if (binding.error || message.error || !binding.data || !message.data) throw new Error("飞书接收人或邮件内容暂时无法确认。", { cause: binding.error ?? message.error });
  const thread = await supabase.from("mail_threads").select("ref_code").eq("id", message.data.thread_id).single();
  if (thread.error || !thread.data) throw new Error("邮件会话暂时无法读取。", { cause: thread.error });
  const subject = decryptMailValue(message.data.subject_enc as string, getMailEnv().contentKey);
  const lead = notification.reason === "unassigned_inbound"
    ? "有一封新邮件等待分配"
    : notification.reason === "reassigned"
      ? "有一个邮件会话已转交给你"
      : "你负责的客户发来了新邮件";
  const messageId = await sendFeishuMessage(binding.data.open_id as string, `${lead}\n主题：${subject}\nRef：${thread.data.ref_code}\n请进入 PT5 邮件工作台处理。`);
  const { data: doneData, error: doneError } = await supabase.from("mail_notifications").update({
    status: "delivered",
    feishu_message_id: messageId,
    delivered_at: new Date().toISOString(),
    locked_at: null,
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", notification.id).select("id,status,feishu_message_id").single();
  if (doneError || doneData?.status !== "delivered" || doneData.feishu_message_id !== messageId) {
    throw new Error("飞书送达凭证没有确认保存。", { cause: doneError });
  }
}

export async function processMailNotificationBatch() {
  const supabase = getSupabaseServiceRoleClient();
  const { data: claimedData, error: claimedError } = await supabase.rpc("claim_mail_notifications", { batch_size: 20 });
  if (claimedError) throw new Error("飞书提醒任务暂时无法领取。", { cause: claimedError });
  const notifications = (claimedData ?? []) as NotificationRow[];
  let succeededCount = 0;
  let failedCount = 0;
  for (const notification of notifications) {
    try {
      await processNotification(notification);
      succeededCount += 1;
    } catch (error) {
      failedCount += 1;
      const nextStatus = notification.attempt_count < 4 ? "retrying" : "attention_required";
      const { data: savedData, error: savedError } = await supabase.from("mail_notifications").update({
        status: nextStatus,
        next_attempt_at: new Date(Date.now() + Math.min(60_000 * 2 ** notification.attempt_count, 3_600_000)).toISOString(),
        locked_at: null,
        last_error: error instanceof Error ? error.message : "飞书提醒失败",
        updated_at: new Date().toISOString(),
      }).eq("id", notification.id).select("id,status").single();
      if (savedError || savedData?.status !== nextStatus) throw new Error("飞书失败状态没有确认保存。", { cause: savedError });
    }
  }
  return { processedCount: notifications.length, succeededCount, failedCount };
}
