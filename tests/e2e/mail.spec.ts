import { expect, test, type Page } from "@playwright/test";
import type { Server } from "node:http";

import { getRegressionAccount, type RegressionRole } from "./helpers/accounts";
import { setTestLocale } from "./helpers/auth";
import { getMailBoundaryState, queueMailBoundaryInbound, resetMailBoundaryState, startMailBoundaryMockServer } from "./helpers/mail-boundary-mock-server";
import { ADMIN_ID, getMailAdmin, MAILBOX_ID, MESSAGE_ID, PEER_SALESMAN_ID, resetIntegratedMailFixture, SALESMAN_ID, THREAD_ID } from "./helpers/mail-fixtures";
import { readLocalEnvValue } from "./helpers/local-supabase-admin";

let boundaryServer: Server;

test.beforeAll(async () => { boundaryServer = await startMailBoundaryMockServer(); });
test.beforeEach(async () => { resetMailBoundaryState(); await resetIntegratedMailFixture(); });
test.afterAll(async () => { await new Promise<void>((resolve, reject) => boundaryServer.close((error) => error ? reject(error) : resolve())); });

async function login(page: Page, role: RegressionRole) {
  const account = getRegressionAccount(role);
  await setTestLocale(page, "zh");
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('input[name="email"]')).toHaveCount(0, { timeout: 30_000 });
  const acknowledge = page.getByRole("button", { name: "我知道了" });
  if (await acknowledge.isVisible().catch(() => false)) await acknowledge.click();
}

async function processInboundMessages(page: Page, targetHistoryId: string, eventName: string) {
  const taskSecret = readLocalEnvValue("MAIL_TASK_SECRET");
  if (!taskSecret) throw new Error("本地邮件后台任务密钥未配置。");
  const { data: event, error } = await getMailAdmin().from("mail_inbound_events").insert({
    pubsub_message_id: eventName,
    mailbox_id: MAILBOX_ID,
    notified_email_hash: "local-notification",
    target_history_id: targetHistoryId,
    published_at: new Date().toISOString(),
  }).select("id").single();
  if (error || !event) throw new Error(error?.message ?? "收件事件没有创建。");
  const response = await page.request.post("/api/mail/tasks/process", {
    headers: { authorization: `Bearer ${taskSecret}` },
  });
  expect(response.ok()).toBe(true);
  const { data: finalEvent } = await getMailAdmin().from("mail_inbound_events")
    .select("id,status,completed_at,last_error").eq("id", event.id).single();
  expect(finalEvent).toMatchObject({ id: event.id, status: "completed", last_error: null });
  expect(finalEvent?.completed_at).toBeTruthy();
  return event.id as string;
}

for (const role of ["administrator", "salesman"] as const) {
  test(`${role} 从左侧工作栏进入邮件工作台`, async ({ page }) => {
    await login(page, role);
    const workspace = role === "administrator" ? "admin" : "salesman";
    await page.goto(`/${workspace}/home`);
    const entry = page.getByRole("link", { name: "邮件工作台" });
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(page).toHaveURL(new RegExp(`/${workspace}/mail`));
    await expect(page.getByText("New wholesale inquiry")).toBeVisible();
  });
}

for (const role of ["client", "finance", "manager", "operator", "promoter", "recruiter"] as const) {
  test(`${role} 没有邮件入口且服务端拒绝`, async ({ page }) => {
    await login(page, role);
    await expect(page.getByRole("link", { name: "邮件工作台" })).toHaveCount(0);
    const response = await page.request.get("/api/mail/workspace", { maxRedirects: 0 });
    expect([302, 307, 400, 401, 403]).toContain(response.status());
    const rulesResponse = await page.request.get("/api/mail/intake-rules", { maxRedirects: 0 });
    const quarantineResponse = await page.request.get("/api/mail/quarantine", { maxRedirects: 0 });
    expect([302, 307, 400, 401, 403]).toContain(rulesResponse.status());
    expect([302, 307, 400, 401, 403]).toContain(quarantineResponse.status());
    await page.goto(`/${role}/mail`);
    await expect(page.getByRole("heading", { name: "邮件工作台" })).toHaveCount(0);
  });
}

test("业务员阅读、生成并编辑建议、回复后取得数据库与 Gmail 双重凭证", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByText("New wholesale inquiry").click();
  await expect(page.getByText("Hello, we need a quote for 500 units.")).toBeVisible();
  await page.getByRole("button", { name: "生成回复建议" }).click();
  const body = page.locator("textarea").last();
  await expect(body).toHaveValue(/thank you for your inquiry/i, { timeout: 30_000 });
  await body.fill(`${await body.inputValue()}\nWe will send the price today.`);
  await page.getByRole("button", { name: "发送邮件" }).click();
  await expect(page.getByText("邮件已在公司邮箱的“已发送”中确认。")).toBeVisible({ timeout: 30_000 });
  const { data: job } = await getMailAdmin().from("mail_outbound_jobs").select("status,provider_message_id,sent_message_id").single();
  expect(job?.status).toBe("sent");
  expect(job?.provider_message_id).toMatch(/^gmail-/);
  expect(job?.sent_message_id).toBeTruthy();
  expect(getMailBoundaryState().sent.at(-1)?.verifiedInSent).toBe(true);
  const { data: read } = await getMailAdmin().from("mail_thread_reads").select("last_read_message_id").eq("thread_id", THREAD_ID).single();
  expect(read?.last_read_message_id).toBe(MESSAGE_ID);
  await page.reload();
  await expect(page.getByText("New wholesale inquiry")).toBeVisible();
});

test("业务员修改并恢复自己的别名和 Ref，但不能修改其他人", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByRole("button", { name: "我的发件设置" }).click();
  const card = page.getByTestId(`mail-agent-${SALESMAN_ID}`);
  await card.getByLabel("加号别名").fill("local.sales.updated");
  await card.getByLabel("Ref 前缀").fill("LOCALNEW");
  await card.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("发件人配置已保存。")).toBeVisible();
  let profile = await getMailAdmin().from("mail_agent_profiles").select("alias_local_part,ref_prefix,version").eq("user_id", SALESMAN_ID).single();
  expect(profile.data).toMatchObject({ alias_local_part: "local.sales.updated", ref_prefix: "LOCALNEW", version: 2 });

  const forbidden = await page.request.put("/api/mail/agents", {
    data: {
      memberId: PEER_SALESMAN_ID,
      aliasLocalPart: "stolen-alias",
      refPrefix: "STOLEN",
      senderDisplayName: "No access",
      signatureHtml: "",
      enabled: true,
      version: 1,
    },
  });
  expect(forbidden.ok()).toBe(false);
  const peer = await getMailAdmin().from("mail_agent_profiles").select("alias_local_part,ref_prefix,version").eq("user_id", PEER_SALESMAN_ID).single();
  expect(peer.data).toMatchObject({ alias_local_part: "peer-sales", ref_prefix: "PEER", version: 1 });

  await card.getByRole("button", { name: "恢复系统建议" }).click();
  await expect(page.getByText("发件人配置已保存。")).toBeVisible();
  profile = await getMailAdmin().from("mail_agent_profiles").select("alias_local_part,ref_prefix,version").eq("user_id", SALESMAN_ID).single();
  expect(profile.data).toMatchObject({ alias_local_part: "local.salesman", ref_prefix: "LOCALSALESMAN", version: 3 });
  await page.reload();
  await page.getByRole("button", { name: "我的发件设置" }).click();
  await expect(page.getByTestId(`mail-agent-${SALESMAN_ID}`).getByLabel("加号别名")).toHaveValue("local.salesman");
});

test("管理员可以修改管理员和业务员的发件设置", async ({ page }) => {
  await login(page, "administrator");
  await page.goto("/admin/mail");
  await page.getByRole("button", { name: "邮箱设置" }).click();
  const adminCard = page.getByTestId(`mail-agent-${ADMIN_ID}`);
  await expect(adminCard.getByText("管理员", { exact: true })).toBeVisible();
  await expect(adminCard.getByLabel("加号别名")).toHaveValue("local.admin");
  const peerCard = page.getByTestId(`mail-agent-${PEER_SALESMAN_ID}`);
  await peerCard.getByLabel("加号别名").fill("peer.custom");
  await peerCard.getByLabel("Ref 前缀").fill("PEERCUSTOM");
  await peerCard.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("发件人配置已保存。")).toBeVisible();
  const { data: profile } = await getMailAdmin().from("mail_agent_profiles").select("alias_local_part,ref_prefix,version").eq("user_id", PEER_SALESMAN_ID).single();
  expect(profile).toMatchObject({ alias_local_part: "peer.custom", ref_prefix: "PEERCUSTOM", version: 2 });
  await page.reload();
  await page.getByRole("button", { name: "邮箱设置" }).click();
  await expect(page.getByTestId(`mail-agent-${PEER_SALESMAN_ID}`).getByLabel("加号别名")).toHaveValue("peer.custom");
});

test("业务员隔离自己的会话后列表、数据库和审计一致", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByText("New wholesale inquiry").click();
  await page.getByRole("button", { name: "移入隔离区" }).click();
  await expect(page.getByText("邮件已移入隔离区，Gmail 原件仍然保留。")).toBeVisible();
  await expect(page.getByText("New wholesale inquiry")).toHaveCount(0);
  const { data: thread } = await getMailAdmin().from("mail_threads").select("intake_status,assigned_user_id,ref_code,version").eq("id", THREAD_ID).single();
  expect(thread).toMatchObject({ intake_status: "quarantined", assigned_user_id: SALESMAN_ID, ref_code: "PT5-2026-LOCAL-ABC12345", version: 2 });
  const { data: audit } = await getMailAdmin().from("mail_audit_events").select("event_type,details").eq("entity_id", THREAD_ID).single();
  expect(audit?.event_type).toBe("mail_thread_quarantined");
  expect(JSON.stringify(audit)).not.toContain("Hello, we need");
  const { count: notifications } = await getMailAdmin().from("mail_notifications").select("id", { count: "exact", head: true });
  expect(notifications).toBe(0);
  await page.reload();
  await expect(page.getByText("New wholesale inquiry")).toHaveCount(0);
});

test("管理员创建规则、批量隔离并恢复后取得最终凭证", async ({ page }) => {
  await login(page, "administrator");
  await page.goto("/admin/mail");
  await page.getByRole("button", { name: "收件规则" }).click();
  const rulesPanel = page.getByTestId("mail-intake-rules-panel");
  await rulesPanel.getByLabel("匹配内容").fill("newsletter@example.com");
  await rulesPanel.getByRole("button", { name: "添加规则" }).click();
  await expect(page.getByText("收件规则已创建。")).toBeVisible();
  const { data: createdRule } = await getMailAdmin().from("mail_intake_rules").select("id,pattern_enc,pattern_hash,version").single();
  expect(createdRule?.id).toBeTruthy();
  expect(createdRule?.pattern_hash).toBeTruthy();
  expect(createdRule?.pattern_enc).not.toContain("newsletter@example.com");

  await page.getByRole("button", { name: "邮件", exact: true }).click();
  await page.getByLabel("选择邮件：New wholesale inquiry").check();
  await page.getByLabel("后续来信").click();
  await page.getByRole("option", { name: "屏蔽发件人" }).click();
  await page.getByRole("button", { name: "隔离所选 1 封" }).click();
  await expect(page.getByText("邮件已移入隔离区，Gmail 原件仍然保留。")).toBeVisible();
  const { data: quarantined } = await getMailAdmin().from("mail_threads").select("intake_status,assigned_user_id,ref_code,version").eq("id", THREAD_ID).single();
  expect(quarantined).toMatchObject({ intake_status: "quarantined", assigned_user_id: SALESMAN_ID, ref_code: "PT5-2026-LOCAL-ABC12345", version: 2 });
  const { count: ruleCount } = await getMailAdmin().from("mail_intake_rules").select("id", { count: "exact", head: true });
  expect(ruleCount).toBe(2);

  await page.getByRole("button", { name: /隔离区 1/ }).click();
  await page.getByText("New wholesale inquiry").click();
  await page.getByRole("button", { name: "恢复到工作台" }).click();
  await expect(page.getByText("邮件已恢复到工作台。")).toBeVisible();
  const { data: restored } = await getMailAdmin().from("mail_threads").select("intake_status,assigned_user_id,ref_code,version").eq("id", THREAD_ID).single();
  expect(restored).toMatchObject({ intake_status: "active", assigned_user_id: SALESMAN_ID, ref_code: "PT5-2026-LOCAL-ABC12345", version: 3 });
  const { data: events } = await getMailAdmin().from("mail_audit_events").select("event_type").eq("entity_id", THREAD_ID).order("created_at");
  expect(events?.map((event) => event.event_type)).toEqual(["mail_thread_quarantined", "mail_thread_restored"]);
  const { data: notification } = await getMailAdmin().from("mail_notifications").select("message_id,target_user_id,reason,status").single();
  expect(notification).toMatchObject({ message_id: MESSAGE_ID, target_user_id: SALESMAN_ID, reason: "assigned_inbound", status: "pending" });
  await page.getByRole("button", { name: "邮件", exact: true }).click();
  await expect(page.getByText("New wholesale inquiry")).toBeVisible();
  await page.reload();
  await expect(page.getByText("New wholesale inquiry")).toBeVisible();
});

test("隔离接口 HTTP 200 但没有任何更新时页面不会误报成功", async ({ page }) => {
  await login(page, "salesman");
  await page.route("**/api/mail/quarantine", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "completed", updated: [], failed: [], ruleId: null }) });
      return;
    }
    await route.continue();
  });
  await page.goto("/salesman/mail");
  await page.getByText("New wholesale inquiry").click();
  await page.getByRole("button", { name: "移入隔离区" }).click();
  await expect(page.getByText("部分邮件没有确认移入隔离区。")).toBeVisible();
  await expect(page.getByText("邮件已移入隔离区，Gmail 原件仍然保留。")).toHaveCount(0);
  const { data: thread } = await getMailAdmin().from("mail_threads").select("intake_status,version").eq("id", THREAD_ID).single();
  expect(thread).toMatchObject({ intake_status: "active", version: 1 });
});

test("管理员可删除隔离区系统副本且不留下正文", async ({ page }) => {
  await login(page, "administrator");
  await page.goto("/admin/mail");
  await page.getByLabel("选择邮件：New wholesale inquiry").check();
  await page.getByRole("button", { name: "隔离所选 1 封" }).click();
  await page.getByRole("button", { name: /隔离区 1/ }).click();
  await page.getByText("New wholesale inquiry").click();
  await page.getByRole("button", { name: "删除系统副本" }).click();
  await page.getByRole("button", { name: "确认操作" }).click();
  await expect(page.getByText("系统副本已删除，Gmail 原件仍然保留。")).toBeVisible();
  const { count } = await getMailAdmin().from("mail_threads").select("id", { count: "exact", head: true }).eq("id", THREAD_ID);
  expect(count).toBe(0);
  const { data: audit } = await getMailAdmin().from("mail_audit_events").select("event_type,details").eq("event_type", "mail_thread_deleted").single();
  expect(audit?.event_type).toBe("mail_thread_deleted");
  expect(JSON.stringify(audit)).not.toContain("Hello, we need");
});

test("业务员上传安全附件并新建邮件", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  const composer = page.getByTestId("mail-composer");
  await composer.getByLabel("收件人").fill("newbuyer@example.com");
  await composer.getByLabel("主题").fill("Sample request");
  await composer.getByLabel("正文").fill("Please find the requested information attached.");
  await composer.locator('input[type="file"]').setInputFiles({ name: "quote.txt", mimeType: "text/plain", buffer: Buffer.from("quote") });
  await expect(composer.getByText("quote.txt · 可以发送")).toBeVisible();
  await composer.getByRole("button", { name: "发送邮件" }).click();
  await expect(page.getByText("邮件已在公司邮箱的“已发送”中确认。")).toBeVisible({ timeout: 30_000 });
  const { data: upload } = await getMailAdmin().from("mail_uploads").select("consumed_at,scan_status").single();
  const { count } = await getMailAdmin().from("mail_attachments").select("id", { count: "exact", head: true });
  expect(upload?.scan_status).toBe("clean");
  expect(upload?.consumed_at).toBeTruthy();
  expect(count).toBe(1);
});

test("系统联系过的邮箱回复或直接来信都会进入原负责人工作台", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  const composer = page.getByTestId("mail-composer");
  await composer.getByLabel("收件人").fill("known.customer@example.com");
  await composer.getByLabel("主题").fill("KNOWN-CUSTOMER-START");
  await composer.getByLabel("正文").fill("This message creates the authoritative recipient record.");
  await composer.getByRole("button", { name: "发送邮件" }).click();
  await expect(page.getByText("邮件已在公司邮箱的“已发送”中确认。")).toBeVisible({ timeout: 30_000 });

  const { data: sentJob } = await getMailAdmin().from("mail_outbound_jobs")
    .select("sent_message_id,provider_thread_id,status").eq("status", "sent").single();
  expect(sentJob?.sent_message_id).toBeTruthy();
  const { data: recipientRows } = await getMailAdmin().from("mail_outbound_recipients")
    .select("message_id,thread_id,actor_user_id,recipient_kind").eq("message_id", sentJob?.sent_message_id).eq("actor_user_id", SALESMAN_ID);
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

  const { data: acceptedThreads } = await getMailAdmin().from("mail_threads")
    .select("provider_thread_id,assigned_user_id,routing_source,state")
    .in("provider_thread_id", [String(sentJob?.provider_thread_id), "gmail-known-direct-thread"]);
  expect(acceptedThreads).toHaveLength(2);
  expect(acceptedThreads?.find((thread) => thread.provider_thread_id === sentJob?.provider_thread_id))
    .toMatchObject({ assigned_user_id: SALESMAN_ID, state: "waiting_pt5" });
  expect(acceptedThreads?.find((thread) => thread.provider_thread_id === "gmail-known-direct-thread"))
    .toMatchObject({ assigned_user_id: SALESMAN_ID, routing_source: "recipient_history", state: "waiting_pt5" });
  const { data: inboundMessages } = await getMailAdmin().from("mail_messages")
    .select("provider_message_id,direction").in("provider_message_id", ["known-reply-1", "known-direct-1"]);
  expect(inboundMessages).toHaveLength(2);
  expect(inboundMessages?.every((message) => message.direction === "inbound")).toBe(true);
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
    attachment: { id: "unknown-attachment", filename: "unknown.txt", contentType: "text/plain", content: "must not download" },
  });
  const firstEventId = await processInboundMessages(page, historyId, "unknown-customer-event-1");
  await processInboundMessages(page, historyId, "unknown-customer-event-2");

  const { count: messageCount } = await getMailAdmin().from("mail_messages")
    .select("id", { count: "exact", head: true }).eq("provider_message_id", "unknown-inbound-1");
  const { data: receipts } = await getMailAdmin().from("mail_inbound_ignore_receipts")
    .select("id,audit_event_id,reason").eq("reason", "unknown_sender");
  const { data: auditRows } = await getMailAdmin().from("mail_audit_events")
    .select("id,event_type,details").eq("event_type", "mail_inbound_ignored_unknown_sender");
  const { data: rule } = await getMailAdmin().from("mail_intake_rules").select("hit_count,action").single();
  expect(messageCount).toBe(0);
  expect(receipts).toHaveLength(1);
  expect(auditRows).toHaveLength(1);
  expect(receipts?.[0]?.audit_event_id).toBe(auditRows?.[0]?.id);
  expect(rule).toMatchObject({ action: "allow", hit_count: 0 });
  expect(JSON.stringify(auditRows)).not.toContain("unknown.sender@example.com");
  expect(JSON.stringify(auditRows)).not.toContain("This body must never be stored");
  expect(getMailBoundaryState().attachmentFetches).toBe(0);
  const { data: event } = await getMailAdmin().from("mail_inbound_events").select("status,completed_at").eq("id", firstEventId).single();
  expect(event?.status).toBe("completed");
  expect(event?.completed_at).toBeTruthy();
  await page.goto("/admin/mail");
  await expect(page.getByText("UNKNOWN-MUST-NOT-ENTER")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("UNKNOWN-MUST-NOT-ENTER")).toHaveCount(0);
});

test("新建邮件在桌面和窄屏都直接显示核心输入框", async ({ page }) => {
  await login(page, "administrator");
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin/mail");
    await page.getByRole("button", { name: "新邮件", exact: true }).click();

    const panel = page.getByTestId("mail-new-message-panel");
    const composer = page.getByTestId("mail-composer");
    await expect(panel).toBeVisible();
    await expect(composer.getByLabel("收件人")).toBeInViewport();
    await expect(composer.getByLabel("主题")).toBeInViewport();
    await expect(composer.getByLabel("正文")).toBeInViewport();

    const panelBox = await panel.boundingBox();
    const composerBox = await composer.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(composerBox).not.toBeNull();
    // 紧凑标题区应保持在 120px 内，防止再次出现把表单推到首屏以下的大块空白。
    expect((composerBox?.y ?? 0) - (panelBox?.y ?? 0)).toBeLessThanOrEqual(120);
  }
});

test("管理员首次打开自动生成发件资料并取得 Gmail 最终凭证", async ({ page }) => {
  await login(page, "administrator");
  await page.goto("/admin/mail");
  const { data: profile } = await getMailAdmin().from("mail_agent_profiles")
    .select("alias_local_part,ref_prefix,enabled,version").eq("user_id", ADMIN_ID).single();
  expect(profile).toMatchObject({ alias_local_part: "local.admin", ref_prefix: "LOCALADMIN", enabled: true, version: 1 });
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  const composer = page.getByTestId("mail-composer");
  await expect(composer.getByTestId("mail-sender-unavailable")).toHaveCount(0);
  await composer.getByLabel("收件人").fill("matchstick2333@gmail.com");
  await composer.getByLabel("主题").fill("ADMIN-SENDER-PROFILE-TEST");
  await composer.getByLabel("正文").fill("Administrator sender profile verification.");
  await composer.getByRole("button", { name: "发送邮件" }).click();
  await expect(page.getByText("邮件已在公司邮箱的“已发送”中确认。")).toBeVisible({ timeout: 30_000 });
  const { data: job } = await getMailAdmin().from("mail_outbound_jobs")
    .select("actor_user_id,status,provider_message_id,sent_message_id").eq("actor_user_id", ADMIN_ID).single();
  expect(job?.status).toBe("sent");
  expect(job?.provider_message_id).toMatch(/^gmail-/);
  expect(job?.sent_message_id).toBeTruthy();
  expect(getMailBoundaryState().sent.at(-1)?.verifiedInSent).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  const refreshedComposer = page.getByTestId("mail-composer");
  await expect(refreshedComposer.getByTestId("mail-sender-unavailable")).toHaveCount(0);
  await refreshedComposer.getByLabel("收件人").fill("matchstick2333@gmail.com");
  await refreshedComposer.getByLabel("主题").fill("ADMIN-SENDER-REFRESH-CHECK");
  await refreshedComposer.getByLabel("正文").fill("The sender profile remains available after refresh.");
  await expect(refreshedComposer.getByRole("button", { name: "发送邮件" })).toBeEnabled();
});

test("当前负责人转交后版本、审计与刷新结果一致", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByText("New wholesale inquiry").click();
  await page.getByLabel("负责人").click();
  await expect(page.getByRole("option", { name: "本地管理员" })).toHaveCount(0);
  await page.getByRole("option", { name: "本地协作业务员" }).click();
  await expect(page.getByText("会话已转交。")).toBeVisible();
  const { data: thread } = await getMailAdmin().from("mail_threads").select("assigned_user_id,version").eq("id", THREAD_ID).single();
  const { data: audit } = await getMailAdmin().from("mail_assignment_events").select("assigned_user_id,thread_version").eq("thread_id", THREAD_ID).single();
  expect(thread).toMatchObject({ assigned_user_id: PEER_SALESMAN_ID, version: 2 });
  expect(audit).toMatchObject({ assigned_user_id: PEER_SALESMAN_ID, thread_version: 2 });
  await page.reload();
  await expect(page.getByText("New wholesale inquiry")).toHaveCount(0);
});

test("管理员生成报告并删除系统副本，数据库保留无正文审计", async ({ page }) => {
  await login(page, "administrator");
  await page.goto("/admin/mail");
  await page.getByRole("button", { name: "邮箱设置" }).click();
  await page.getByRole("button", { name: "生成分析报告" }).click();
  await expect(page.getByText("本期询盘稳定")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "邮件", exact: true }).click();
  await page.getByText("New wholesale inquiry").click();
  await page.getByRole("button", { name: "删除系统副本" }).click();
  await page.getByRole("button", { name: "确认操作" }).click();
  await expect(page.getByText("系统副本已删除，Gmail 原件仍然保留。")).toBeVisible();
  const { count } = await getMailAdmin().from("mail_threads").select("id", { count: "exact", head: true }).eq("id", THREAD_ID);
  const { data: audit } = await getMailAdmin().from("mail_audit_events").select("id,event_type,details").eq("entity_id", THREAD_ID).single();
  expect(count).toBe(0);
  expect(audit?.event_type).toBe("mail_thread_deleted");
  expect(JSON.stringify(audit)).not.toContain("Hello, we need");
  await page.reload();
  await expect(page.getByText("New wholesale inquiry")).toHaveCount(0);
});

test("Gmail 返回编号但查不到 SENT 时绝不显示成功", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  const composer = page.getByTestId("mail-composer");
  await composer.getByLabel("收件人").fill("buyer@example.com");
  await composer.getByLabel("主题").fill("BROKEN RECEIPT");
  await composer.getByLabel("正文").fill("This must fail final verification.");
  await composer.getByRole("button", { name: "发送邮件" }).click();
  await expect(page.getByText("公司邮箱的发送结果需要人工核对，请勿再次发送这封邮件。")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("邮件已在公司邮箱的“已发送”中确认。")).toHaveCount(0);
  const { data: job } = await getMailAdmin().from("mail_outbound_jobs").select("status,provider_message_id,sent_message_id").single();
  expect(job?.status).toBe("partial_failed");
  expect(job?.provider_message_id).toMatch(/^gmail-/);
  expect(job?.sent_message_id).toBeNull();
});

test("未发送邮件切换会话时保留当前输入", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  const composer = page.getByTestId("mail-composer");
  await composer.getByLabel("收件人").fill("draft@example.test");
  await composer.getByLabel("主题").fill("待继续的邮件");
  await composer.getByLabel("正文").fill("离开前先确认");
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  await expect(page.getByText("离开后当前输入会丢失。确定要离开吗？").first()).toBeVisible();
  await page.getByRole("button", { name: "暂不操作" }).click();
  await expect(composer.getByLabel("收件人")).toHaveValue("draft@example.test");
  await expect(composer.getByLabel("主题")).toHaveValue("待继续的邮件");
  await expect(composer.getByLabel("正文")).toHaveValue("离开前先确认");
  await page.getByText("New wholesale inquiry").click();
  await expect(page.getByText("离开后当前输入会丢失。确定要离开吗？").first()).toBeVisible();
  await page.getByRole("button", { name: "确认操作" }).click();
  await expect(page.getByText("New wholesale inquiry")).toBeVisible();
});
