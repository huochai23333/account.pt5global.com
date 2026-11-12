import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readDisposablePostgresTarget } from "../test-support/disposable-fixture";
import { closeLoopbackBoundary } from "../test-support/loopback-http-boundary";
import { loginAs } from "./helpers/auth";
import { getMailAdmin } from "./helpers/mail-fixture-admin";
import { MAILBOX_ID } from "./helpers/mail-fixture-identity";
import { resetIntegratedMailFixture } from "./helpers/mail-fixtures";
import { startOAuthBoundary } from "./helpers/mail-oauth-boundary";
import { setOAuthSaveFault } from "./helpers/mail-oauth-save-fault";

let boundary: Awaited<ReturnType<typeof startOAuthBoundary>>;
// 固定邮箱和整表故障仅可进入同一专属项目；声明本地地址不能代替网关/数据库实查。
test.beforeAll(async ({ baseURL }) => {
  readDisposablePostgresTarget({ baseURL, supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    mode: process.env.PT5_E2E_FIXTURE_MODE, project: process.env.PT5_E2E_DATABASE_PROJECT,
    container: process.env.PT5_E2E_DATABASE_CONTAINER },
  (args) => execFileSync("docker", args, { encoding: "utf8", timeout: 12_000, windowsHide: true }).trim());
  boundary = await startOAuthBoundary();
});
test.beforeEach(async () => { setOAuthSaveFault(false); boundary.state.mode = "ok"; boundary.state.tokens = 0; boundary.state.watches = 0; await resetIntegratedMailFixture(); });
test.afterEach(() => { if (boundary) setOAuthSaveFault(false); });
test.afterAll(async () => {
  // 准入或启动失败时没有服务器，不能用第二个异常遮住原始失败。
  if (boundary) await closeLoopbackBoundary(boundary.server);
});

/** 从真实“连接公司邮箱”按钮进入，只把 Google 同意页替换成可点击的本机边界。 */
async function openConsent(page: Page) {
  await loginAs(page, "administrator");
  await page.goto("/admin/mail");
  await page.getByRole("button", { name: "邮箱设置", exact: true }).click();
  await page.getByRole("button", { name: "连接 chinapt5@gmail.com", exact: true }).click();
  await expect(page.getByRole("heading", { name: "本地 Google 授权边界" })).toBeVisible();
  const url = new URL(page.url());
  const state = url.searchParams.get("state")!;
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  const callback = await page.getByRole("link", { name: "允许连接" }).getAttribute("href") as string;
  return { callback, stateHash: createHash("sha256").update(state).digest("hex") };
}

async function expectFailure(page: Page, reason: string, result = "failed") {
  await expect(page).toHaveURL(new RegExp(`/admin/mail\\?mailConnection=${result}&connectionReason=${reason}`));
  const notice = page.getByTestId("mail-connection-notice");
  await expect(notice).toHaveAttribute("data-result", result);
  await expect(notice).toBeVisible();
  await expect(notice).not.toContainText(/invalid_grant|NEXT_REDIRECT|RPC|0\.0\.0\.0/);
  await page.reload();
  await expect(notice).toHaveAttribute("data-result", result);
}

/** 两次查询都失败时，undefined相等不能成为“凭据版本未变”的证据。 */
function credentialVersion(result: { error: unknown; data: { updated_at?: unknown } | null }) {
  expect(result.error).toBeNull();
  const value = result.data?.updated_at;
  expect(typeof value).toBe("string");
  expect(value).toBeTruthy();
  return value as string;
}

/** 故障样例的状态修改也要证明命中一行，并用第二个请求读回，不能只等待页面提示。 */
async function setMailboxStatus(status: "active" | "paused") {
  const db = getMailAdmin();
  const saved = await db.from("mail_shared_mailboxes").update({ status }).eq("id", MAILBOX_ID).select("id,status").single();
  expect(saved.error).toBeNull();
  expect(saved.data).toMatchObject({ id: MAILBOX_ID, status });
  const readback = await db.from("mail_shared_mailboxes").select("id,status").eq("id", MAILBOX_ID).single();
  expect(readback.error).toBeNull();
  expect(readback.data).toMatchObject({ id: MAILBOX_ID, status });
}

test("完整连接：真实落库、刷新、回调重复访问和宽窄屏", async ({ page }, testInfo) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("response", async (response) => {
    if (response.status() >= 400 && new URL(response.url()).pathname.startsWith("/api/mail/")) {
      failedRequests.push(`${new URL(response.url()).pathname}:${response.status()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const { callback, stateHash } = await openConsent(page);
  await page.getByRole("link", { name: "允许连接" }).click();
  await expect(page.getByTestId("mail-connection-notice")).toHaveAttribute("data-result", "success");
  await expect(page.getByText("公司邮箱已连接，授权和新邮件通知已保存。", { exact: true })).toBeVisible();
  const db = getMailAdmin();
  const [mailbox, credentials, watch, transaction] = await Promise.all([
    db.from("mail_shared_mailboxes").select("id,status,provider_subject").eq("id", MAILBOX_ID).single(),
    db.from("mail_shared_mailbox_credentials").select("mailbox_id,updated_at,scopes").eq("mailbox_id", MAILBOX_ID).single(),
    db.from("mail_shared_mailbox_watches").select("mailbox_id,history_id,expiration").eq("mailbox_id", MAILBOX_ID).single(),
    db.from("mail_oauth_transactions").select("consumed_at").eq("state_hash", stateHash).single(),
  ]);
  for (const row of [mailbox, credentials, watch, transaction]) expect(row.error).toBeNull();
  expect(mailbox.data).toMatchObject({ id: MAILBOX_ID, status: "active" });
  expect(credentials.data?.scopes).toContain("https://www.googleapis.com/auth/gmail.modify");
  const savedVersion = credentialVersion(credentials);
  expect(watch.data?.history_id).toBe("901");
  expect(transaction.data?.consumed_at).toBeTruthy();
  // 受控红灯运行故意破坏权威结果，下面同一个成功断言应失败；正常回归不启用。
  if (process.env.MAIL_OAUTH_RED_PROBE === "1") {
    await setMailboxStatus("paused");
  }
  await page.reload();
  await expect(page.getByTestId("mail-connection-notice")).toHaveAttribute("data-result", "success");
  await expect(page.getByTestId("mail-admin-panel")).toBeVisible();
  await page.goto(callback);
  await expect(page.getByTestId("mail-connection-notice")).toHaveAttribute("data-result", "success");
  await expect(page.getByTestId("mail-admin-panel")).toBeVisible();
  expect(boundary.state.tokens).toBe(1);
  expect(boundary.state.watches).toBe(1);
  const reloaded = await db.from("mail_shared_mailbox_credentials").select("updated_at").eq("mailbox_id", MAILBOX_ID).single();
  expect(credentialVersion(reloaded)).toBe(savedVersion);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByTestId("mail-connection-notice")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`success-${width}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
  // 红绿检查：成功凭证还在，但权威邮箱被停用时页面必须撤回成功提示。
  await setMailboxStatus("paused");
  await page.reload();
  await expect(page.getByTestId("mail-connection-notice")).toHaveAttribute("data-result", "failed");
  await setMailboxStatus("active");
  await page.reload();
  await expect(page.getByTestId("mail-connection-notice")).toHaveAttribute("data-result", "success");
});

for (const [mode, reason, result] of [
  ["tokenFailure", "tokens", "failed"], ["scope", "scope", "failed"], ["account", "account", "failed"],
  ["watchFailure", "watch", "failed"], ["saveFailure", "save", "partial_failed"], ["timeout", "tokens", "failed"],
] as const) {
  test(`授权失败可理解且不误报成功：${mode}`, async ({ page }) => {
    boundary.state.mode = mode;
    const { stateHash } = await openConsent(page);
    const before = await getMailAdmin().from("mail_shared_mailbox_credentials").select("updated_at").eq("mailbox_id", MAILBOX_ID).single();
    const beforeVersion = credentialVersion(before);
    if (mode === "saveFailure") setOAuthSaveFault(true);
    await page.getByRole("link", { name: "允许连接" }).click();
    await expectFailure(page, reason, result);
    const after = await getMailAdmin().from("mail_shared_mailbox_credentials").select("updated_at").eq("mailbox_id", MAILBOX_ID).single();
    expect(credentialVersion(after)).toBe(beforeVersion);
    const transaction = await getMailAdmin().from("mail_oauth_transactions").select("consumed_at").eq("state_hash", stateHash).single();
    expect(transaction.error).toBeNull();
    expect(transaction.data?.consumed_at).toBeTruthy();
    if (mode === "account" || mode === "scope") expect(boundary.state.watches).toBe(0);
  });
}

test("过期及已使用授权不会重复交换令牌，错误可刷新并重新发起", async ({ page }, testInfo) => {
  const { stateHash, callback } = await openConsent(page);
  const expiresAt = new Date(Date.now() - 1000).toISOString();
  const expired = await getMailAdmin().from("mail_oauth_transactions").update({ expires_at: expiresAt }).eq("state_hash", stateHash).select("state_hash").single();
  expect(expired.error).toBeNull();
  expect(expired.data?.state_hash).toBe(stateHash);
  const expiryReadback = await getMailAdmin().from("mail_oauth_transactions").select("state_hash,expires_at").eq("state_hash", stateHash).single();
  expect(expiryReadback.error).toBeNull();
  expect(expiryReadback.data?.state_hash).toBe(stateHash);
  // Postgres可能用+00:00返回同一时刻，按时间值核对，不把序列化格式差异误当写入失败。
  expect(Date.parse(expiryReadback.data?.expires_at ?? "")).toBe(Date.parse(expiresAt));
  await page.getByRole("link", { name: "允许连接" }).click();
  await expectFailure(page, "state");
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath("expired-320.png"), fullPage: true });
  expect(boundary.state.tokens).toBe(0);
  await page.getByRole("button", { name: "连接 chinapt5@gmail.com", exact: true }).click();
  await expect(page.getByRole("link", { name: "允许连接" })).toBeVisible();
  await page.getByRole("link", { name: "允许连接" }).click();
  await expect(page.getByTestId("mail-connection-notice")).toHaveAttribute("data-result", "success");
  await page.context().clearCookies({ name: "pt5-mail-connection" });
  await page.goto(callback);
  await expectFailure(page, "state");
  expect(boundary.state.tokens).toBe(1);
});

test("取消、缺少信息、伪造成功参数和丢失浏览器回程均有安全反馈", async ({ page }) => {
  const { callback } = await openConsent(page);
  await page.goto("/api/mail/oauth/google/callback?error=access_denied");
  await expectFailure(page, "cancelled");
  await page.goto("/api/mail/oauth/google/callback");
  await expectFailure(page, "incomplete");
  await page.goto("/admin/mail?mailConnection=success");
  await expect(page.getByTestId("mail-connection-notice")).toHaveAttribute("data-result", "failed");
  // 浏览器未收到最终跳转时，后台仍只保存一次；回到旧链接不会凭空显示成功。
  await page.route("**/api/mail/oauth/google/callback?*", async (route) => {
    // 让请求真正抵达服务器并保存结果，再切断浏览器收到响应的这一步。
    await route.fetch({ maxRedirects: 0 });
    await route.abort();
  });
  await page.goto(callback).catch(() => undefined);
  await page.unroute("**/api/mail/oauth/google/callback?*");
  await page.context().clearCookies({ name: "pt5-mail-connection" });
  const watch = await getMailAdmin().from("mail_shared_mailbox_watches").select("history_id").eq("mailbox_id", MAILBOX_ID).single();
  expect(watch.error).toBeNull();
  expect(watch.data?.history_id).toBe("901");
  await page.goto("/admin/mail");
  await page.getByRole("button", { name: "邮箱设置", exact: true }).click();
  await expect(page.getByTestId("mail-admin-panel").getByText(/@gmail\.com · 运行正常/)).toBeVisible();
  await page.goto(callback);
  await expectFailure(page, "state");
  expect(boundary.state.tokens).toBe(1);
});

test("业务员和未登录访客不能发起公司邮箱授权", async ({ page }) => {
  await loginAs(page, "salesman");
  await page.goto("/salesman/mail");
  await expect(page.getByRole("button", { name: "连接 chinapt5@gmail.com", exact: true })).toHaveCount(0);
  await page.goto("/api/mail/oauth/google/start");
  const states = await getMailAdmin().from("mail_oauth_transactions").select("state_hash");
  expect(states.error).toBeNull();
  expect(states.data).toEqual([]);
  await page.context().clearCookies();
  await page.goto("/api/mail/oauth/google/callback?code=bad&state=bad");
  await expect(page).toHaveURL(/\/login/);
  expect(boundary.state.tokens).toBe(0);
});
