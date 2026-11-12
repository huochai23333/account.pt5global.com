import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { parseEnvironment } from "../../scripts/learning/doctor-checks.mjs";
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const origin = "http://localhost:3000";
const provider = "http://127.0.0.1:4110";
// 复用原套件的供应商模拟。它使用 CommonJS，本学习测试使用 ESM。
const { startOAuthBoundary } = createRequire(import.meta.url)("../e2e/helpers/mail-oauth-boundary.ts") as
  typeof import("../e2e/helpers/mail-oauth-boundary");

function mailboxSnapshot() {
  // 比较权威行的摘要，确认失败没有修改共享邮箱、密文凭证或游标。
  return executeLearningSql(`select md5(coalesce(
    (select jsonb_agg(to_jsonb(m) order by id)::text from public.mail_shared_mailboxes m), '[]') ||
    coalesce((select jsonb_agg(to_jsonb(c) order by mailbox_id)::text from public.mail_shared_mailbox_credentials c), '[]') ||
    coalesce((select jsonb_agg(to_jsonb(w) order by mailbox_id)::text from public.mail_shared_mailbox_watches w), '[]'));`);
}

test("Google 授权交换失败后一次性状态不可重放", async ({ page, learningUser }, testInfo) => {
  test.setTimeout(90_000);
  const local = parseEnvironment(await readFile(".env.local", "utf8")) as Record<string, string | undefined>;
  expect(local.MAIL_GOOGLE_OAUTH_BASE_URL).toBe(`${provider}/google-oauth`);
  // 首次打开邮件会给活动员工补默认发件资料。共享账号缺资料时中止，避免触及已有数据。
  expect(executeLearningSql(`select count(*) from public.user_profiles p
    where p.status='active' and p.user_id <> '${learningUser.id}'
    and exists(select 1 from public.user_roles_data d join public.user_roles r on r.id=d.role_id
      where d.user_id=p.user_id and r.role in ('administrator','salesman'))
    and not exists(select 1 from public.mail_agent_profiles m where m.user_id=p.user_id);`)).toBe("0");

  const boundary = await startOAuthBoundary();
  boundary.state.mode = "tokenFailure";
  const userScope = `user_id='${learningUser.id}' and provider='google'`;
  const before = mailboxSnapshot();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    // 浏览器只允许访问本机 Web、Auth 和模拟服务。只有当前进程确实跳到本地同意页才继续回调。
    await page.route("**/*", (route) => {
      const host = new URL(route.request().url()).hostname;
      return host === "localhost" || host === "127.0.0.1" ? route.continue() : route.abort();
    });
    await loginLearningUser(page, learningUser);
    await page.context().addCookies([{ name: "bs-locale", value: "zh", url: origin }]);
    const announcement = page.getByRole("dialog", { name: zh.DashboardShell.announcements.newTitle, exact: true });
    await page.addLocatorHandler(announcement, () =>
      announcement.getByRole("button", { name: zh.DashboardShell.announcements.acknowledge, exact: true }).click(),
    );
    // 人员请求由浏览器挂载后发出。等它响应再点设置，避免静态 HTML 的点击被丢弃。
    await Promise.all([
      page.waitForResponse((response) => response.url() === `${origin}/api/mail/agents` && response.ok(), { timeout: 20_000 }),
      page.goto("/admin/mail", { waitUntil: "domcontentloaded" }),
    ]);
    await page.getByRole("button", { name: zh.MailWorkspace.mailSettings, exact: true }).click({ timeout: 15_000 });
    await page.getByRole("button", { name: zh.MailWorkspace.connectShared, exact: true }).click({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "本地 Google 授权边界" })).toBeVisible();

    const authorize = new URL(page.url());
    expect(authorize.origin + authorize.pathname).toBe(`${provider}/google-oauth/authorize`);
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
    const state = authorize.searchParams.get("state");
    expect(state).toMatch(/^[\w-]{30,}$/);
    const digest = createHash("sha256").update(state!).digest("hex");
    const consent = page.getByRole("link", { name: "允许连接", exact: true });
    const callback = new URL((await consent.getAttribute("href"))!);
    expect(callback.origin + callback.pathname).toBe(`${origin}/api/mail/oauth/google/callback`);
    const readState = () => JSON.parse(executeLearningSql(`select coalesce(jsonb_agg(jsonb_build_object(
      'purpose', purpose, 'consumed', consumed_at, 'verifierStored', pkce_verifier_enc is not null
    )), '[]') from public.mail_oauth_transactions where ${userScope} and state_hash='${digest}';`));
    expect(readState()).toEqual([{ purpose: "shared_mailbox", consumed: null, verifierStored: true }]);

    await consent.click();
    await expect(page).toHaveURL(/mailConnection=failed&connectionReason=tokens$/);
    const notice = page.getByTestId("mail-connection-notice");
    await expect(notice).toHaveAttribute("data-result", "failed");
    await expect(notice).toBeVisible();
    const consumed = readState();
    expect(consumed).toEqual([{ purpose: "shared_mailbox", consumed: expect.any(String), verifierStored: true }]);
    expect(boundary.state.tokens).toBe(1);
    expect(boundary.state.watches).toBe(0);
    expect(mailboxSnapshot()).toBe(before);
    await page.screenshot({ path: testInfo.outputPath("oauth-failure-zh-1440.png"), animations: "disabled" });

    await page.context().addCookies([{ name: "bs-locale", value: "en", url: origin }]);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.reload();
    await expect(page.getByRole("heading", { name: en.MailWorkspace.title, exact: true })).toBeVisible();
    await expect(notice).toHaveAttribute("data-result", "failed");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("oauth-failure-en-390.png"), animations: "disabled" });
    if (process.env.PT5_LEARNING_OAUTH_RED === "1") {
      // 只撤销本次夹具的已领取标记，让同一授权错误地再次交换，确认下面的断言会失败。
      executeLearningSql(`update public.mail_oauth_transactions set consumed_at=null where ${userScope} and state_hash='${digest}';`);
    }
    await page.goto(callback.toString());
    await expect(page).toHaveURL(/mailConnection=failed&connectionReason=state$/);
    await expect(notice).toHaveAttribute("data-result", "failed");
    expect(readState()).toEqual(consumed);
    expect(boundary.state.tokens).toBe(1);
    expect(mailboxSnapshot()).toBe(before);

    // 外部推送入口独立核对：未验证身份的合成消息不应写入通知表。
    const pushId = `learning-${randomUUID()}`;
    const denied = await page.request.post("/api/mail/webhooks/gmail", {
      data: { message: { messageId: pushId, data: "e30=" } },
    });
    expect(denied.status()).toBe(400);
    expect(executeLearningSql(`select count(*) from public.mail_inbound_events where pubsub_message_id='${pushId}';`)).toBe("0");
    expect(pageErrors).toEqual([]);
    const receipt = testInfo.outputPath("oauth-receipt.json");
    await writeFile(receipt, JSON.stringify({
      stateHash: digest, consumedAt: consumed[0].consumed, tokenCalls: boundary.state.tokens,
      watchCalls: boundary.state.watches, mailboxUnchanged: true, deniedPushId: pushId,
    }, null, 2));
    await testInfo.attach("oauth-receipt", { contentType: "application/json", path: receipt });
  } finally {
    boundary.server.closeAllConnections();
    await new Promise<void>((resolve, reject) => boundary.server.close((error) => error ? reject(error) : resolve()));
    executeLearningSql(`delete from public.mail_oauth_transactions where ${userScope};`);
    expect(executeLearningSql(`select count(*) from public.mail_oauth_transactions where ${userScope};`)).toBe("0");
  }
});
