import { expect, test, type Page } from "@playwright/test";
import type { Server } from "node:http";

import { getRegressionAccount, type RegressionRole } from "./helpers/accounts";
import { setTestLocale } from "./helpers/auth";
import { getMailBoundaryState, resetMailBoundaryState, startMailBoundaryMockServer } from "./helpers/mail-boundary-mock-server";
import { ADMIN_ID, getMailAdmin, MESSAGE_ID, PEER_SALESMAN_ID, resetIntegratedMailFixture, SALESMAN_ID, THREAD_ID } from "./helpers/mail-fixtures";

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
  await expect(page.getByText("Gmail 返回了邮件编号，但在已发送邮件中没有找到它。")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("邮件已在公司邮箱的“已发送”中确认。")).toHaveCount(0);
  const { data: job } = await getMailAdmin().from("mail_outbound_jobs").select("status,provider_message_id,sent_message_id").single();
  expect(job?.status).toBe("partial_failed");
  expect(job?.provider_message_id).toMatch(/^gmail-/);
  expect(job?.sent_message_id).toBeNull();
});

test("1440、390、320px 下左栏与邮件内容没有横向溢出", async ({ page }) => {
  await login(page, "administrator");
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 720 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin/mail");
    await expect(page.getByRole("heading", { name: "邮件工作台" })).toBeVisible();
    const layout = await page.evaluate(() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(layout.scroll).toBeLessThanOrEqual(layout.viewport);
    await page.getByRole("button", { name: "收件规则" }).click();
    const rulesLayout = await page.evaluate(() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(rulesLayout.scroll).toBeLessThanOrEqual(rulesLayout.viewport);
    await page.getByRole("button", { name: /隔离区 0/ }).click();
    const quarantineLayout = await page.evaluate(() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(quarantineLayout.scroll).toBeLessThanOrEqual(quarantineLayout.viewport);
  }
});
