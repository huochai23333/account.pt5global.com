import { expect } from "@playwright/test";
import { test, loginMailAccount as login } from "./helpers/mail-test";
import { getMailAdmin } from "./helpers/mail-fixture-admin";
import { SALESMAN_ID } from "./helpers/mail-fixture-identity";
import {
  queueMailBoundaryInbound,
  getMailBoundaryState,
} from "./helpers/mail-boundary-state";
import { processInboundMessages } from "./helpers/mail-inbound-task";

// 页面关键操作与独立凭证沿用原场景；自动夹具负责本例准备和模拟服务回收。
test("系统联系过的邮箱回复或直接来信都会进入原负责人工作台", async ({
  page,
}) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  const composer = page.getByTestId("mail-composer");
  await composer.getByLabel("收件人").fill("known.customer@example.com");
  await composer.getByLabel("主题").fill("KNOWN-CUSTOMER-START");
  await composer
    .getByLabel("正文")
    .fill("This message creates the authoritative recipient record.");
  await composer.getByRole("button", { name: "发送邮件" }).click();
  await expect(
    page.getByText("邮件已在公司邮箱的“已发送”中确认。"),
  ).toBeVisible({ timeout: 30_000 });

  const { data: sentJob } = await getMailAdmin()
    .from("mail_outbound_jobs")
    .select("sent_message_id,provider_thread_id,status")
    .eq("status", "sent")
    .single();
  expect(sentJob?.sent_message_id).toBeTruthy();
  const { data: recipientRows } = await getMailAdmin()
    .from("mail_outbound_recipients")
    .select("message_id,thread_id,actor_user_id,recipient_kind")
    .eq("message_id", sentJob?.sent_message_id)
    .eq("actor_user_id", SALESMAN_ID);
  expect(recipientRows).toHaveLength(1);
  expect(recipientRows?.[0]?.recipient_kind).toBe("to");

  const replyHistoryId = queueMailBoundaryInbound({
    id: "known-reply-1",
    threadId: String(sentJob?.provider_thread_id),
    from: "Known Customer <known.customer@example.com>",
    to: "chinapt5@gmail.com",
    subject: "Re: KNOWN-CUSTOMER-START",
    text: "This is a reply to the system message.",
  });
  const directHistoryId = queueMailBoundaryInbound({
    id: "known-direct-1",
    threadId: "gmail-known-direct-thread",
    from: "Known Customer <known.customer@example.com>",
    to: "chinapt5@gmail.com",
    subject: "KNOWN-CUSTOMER-DIRECT",
    text: "This is a separate direct message.",
  });
  expect(Number(directHistoryId)).toBeGreaterThan(Number(replyHistoryId));
  await processInboundMessages(page, directHistoryId, "known-customer-event");

  const { data: acceptedThreads } = await getMailAdmin()
    .from("mail_threads")
    .select("provider_thread_id,assigned_user_id,routing_source,state")
    .in("provider_thread_id", [
      String(sentJob?.provider_thread_id),
      "gmail-known-direct-thread",
    ]);
  expect(acceptedThreads).toHaveLength(2);
  expect(
    acceptedThreads?.find(
      (thread) => thread.provider_thread_id === sentJob?.provider_thread_id,
    ),
  ).toMatchObject({ assigned_user_id: SALESMAN_ID, state: "waiting_pt5" });
  expect(
    acceptedThreads?.find(
      (thread) => thread.provider_thread_id === "gmail-known-direct-thread",
    ),
  ).toMatchObject({
    assigned_user_id: SALESMAN_ID,
    routing_source: "recipient_history",
    state: "waiting_pt5",
  });
  const { data: inboundMessages } = await getMailAdmin()
    .from("mail_messages")
    .select("provider_message_id,direction")
    .in("provider_message_id", ["known-reply-1", "known-direct-1"]);
  expect(inboundMessages).toHaveLength(2);
  expect(
    inboundMessages?.every((message) => message.direction === "inbound"),
  ).toBe(true);
  await page.reload();
  await expect(page.getByText("KNOWN-CUSTOMER-DIRECT")).toBeVisible();
  await expect(page.getByText("Re: KNOWN-CUSTOMER-START")).toBeVisible();
});

test("陌生邮箱即使命中放行规则也只留下无正文审计", async ({ page }) => {
  await login(page, "administrator");
  await page.goto("/admin/mail");
  await page.getByRole("button", { name: "收件规则" }).click();
  const rulesPanel = page.getByTestId("mail-intake-rules-panel");
  await rulesPanel.getByLabel("匹配内容").fill("unknown.sender@example.com");
  await rulesPanel.getByLabel("处理方式").click();
  await page.getByRole("option", { name: "放行" }).click();
  await rulesPanel.getByRole("button", { name: "添加规则" }).click();
  await expect(page.getByText("收件规则已创建。")).toBeVisible();

  const historyId = queueMailBoundaryInbound({
    id: "unknown-inbound-1",
    threadId: "gmail-unknown-thread",
    from: "Unknown Sender <unknown.sender@example.com>",
    to: "chinapt5@gmail.com",
    subject: "UNKNOWN-MUST-NOT-ENTER",
    text: "This body must never be stored.",
    attachment: {
      id: "unknown-attachment",
      filename: "unknown.txt",
      contentType: "text/plain",
      content: "must not download",
    },
  });
  const firstEventId = await processInboundMessages(
    page,
    historyId,
    "unknown-customer-event-1",
  );
  await processInboundMessages(page, historyId, "unknown-customer-event-2");

  const { count: messageCount } = await getMailAdmin()
    .from("mail_messages")
    .select("id", { count: "exact", head: true })
    .eq("provider_message_id", "unknown-inbound-1");
  const { data: receipts } = await getMailAdmin()
    .from("mail_inbound_ignore_receipts")
    .select("id,audit_event_id,reason")
    .eq("reason", "unknown_sender");
  const { data: auditRows } = await getMailAdmin()
    .from("mail_audit_events")
    .select("id,event_type,details")
    .eq("event_type", "mail_inbound_ignored_unknown_sender");
  const { data: rule } = await getMailAdmin()
    .from("mail_intake_rules")
    .select("hit_count,action")
    .single();
  expect(messageCount).toBe(0);
  expect(receipts).toHaveLength(1);
  expect(auditRows).toHaveLength(1);
  expect(receipts?.[0]?.audit_event_id).toBe(auditRows?.[0]?.id);
  expect(rule).toMatchObject({ action: "allow", hit_count: 0 });
  expect(JSON.stringify(auditRows)).not.toContain("unknown.sender@example.com");
  expect(JSON.stringify(auditRows)).not.toContain(
    "This body must never be stored",
  );
  expect(getMailBoundaryState().attachmentFetches).toBe(0);
  const { data: event } = await getMailAdmin()
    .from("mail_inbound_events")
    .select("status,completed_at")
    .eq("id", firstEventId)
    .single();
  expect(event?.status).toBe("completed");
  expect(event?.completed_at).toBeTruthy();
  await page.goto("/admin/mail");
  await expect(page.getByText("UNKNOWN-MUST-NOT-ENTER")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("UNKNOWN-MUST-NOT-ENTER")).toHaveCount(0);
});
