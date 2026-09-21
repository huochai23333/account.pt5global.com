import { expect, test, type Page } from "@playwright/test";
import type { Server } from "node:http";

import { getRegressionAccount, type RegressionRole } from "./helpers/accounts";
import { setTestLocale } from "./helpers/auth";
import { getMailBoundaryState, resetMailBoundaryState, startMailBoundaryMockServer } from "./helpers/mail-boundary-mock-server";
import { getMailAdmin, MESSAGE_ID, PEER_SALESMAN_ID, resetIntegratedMailFixture, THREAD_ID } from "./helpers/mail-fixtures";

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

test("管理员没有业务员发件资料时不会误触发发送", async ({ page }) => {
  await login(page, "administrator");
  await page.goto("/admin/mail");
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  const composer = page.getByTestId("mail-composer");
  await expect(composer.getByTestId("mail-sender-unavailable")).toHaveText("当前账号还没有启用发件资料，请联系管理员配置后再发送。");
  await composer.getByLabel("收件人").fill("buyer@example.com");
  await composer.getByLabel("主题").fill("Admin must not send");
  await composer.getByLabel("正文").fill("The send button must stay disabled.");
  await expect(composer.getByRole("button", { name: "发送邮件" })).toBeDisabled();
});

test("当前负责人转交后版本、审计与刷新结果一致", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByText("New wholesale inquiry").click();
  await page.getByLabel("负责人").click();
  await page.getByRole("option").last().click();
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
  await page.getByRole("button", { name: "生成分析报告" }).click();
  await expect(page.getByText("本期询盘稳定")).toBeVisible({ timeout: 30_000 });
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
  }
});
