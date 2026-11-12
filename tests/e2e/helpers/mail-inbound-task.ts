import { expect, type Page } from "@playwright/test";
import { getMailAdmin } from "./mail-fixture-admin";
import { MAILBOX_ID } from "./mail-fixture-identity";
import { readLocalEnvValue } from "./local-supabase-admin";

/** 专属事件的后台触发与终态核对；不是用户发信步骤，仍要求可重建的隔离实例。 */
export async function processInboundMessages(
  page: Page,
  targetHistoryId: string,
  eventName: string,
) {
  const taskSecret = readLocalEnvValue("MAIL_TASK_SECRET");
  if (!taskSecret) throw new Error("本地邮件后台任务密钥未配置。");
  const { data: event, error } = await getMailAdmin()
    .from("mail_inbound_events")
    .insert({
      pubsub_message_id: eventName,
      mailbox_id: MAILBOX_ID,
      notified_email_hash: "local-notification",
      target_history_id: targetHistoryId,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !event) throw new Error(error?.message ?? "收件事件没有创建。");
  const response = await page.request.post("/api/mail/tasks/process", {
    headers: { authorization: `Bearer ${taskSecret}` },
  });
  expect(response.ok()).toBe(true);
  const { data: finalEvent } = await getMailAdmin()
    .from("mail_inbound_events")
    .select("id,status,completed_at,last_error")
    .eq("id", event.id)
    .single();
  expect(finalEvent).toMatchObject({
    id: event.id,
    status: "completed",
    last_error: null,
  });
  expect(finalEvent?.completed_at).toBeTruthy();
  return event.id as string;
}
