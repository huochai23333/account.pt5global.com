import { readDisposablePostgresTarget } from "../test-support/disposable-fixture";
import { closeLoopbackBoundary } from "../test-support/loopback-http-boundary";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { loginAs } from "./helpers/auth";
import { ADMIN_ID, SALESMAN_ID } from "./helpers/mail-fixture-identity";
import { getMailAdmin } from "./helpers/mail-fixture-admin";
import { resetIntegratedMailFixture } from "./helpers/mail-fixtures";
import { startFeishuBoundary } from "./helpers/mail-feishu-boundary";
import { setFeishuSaveFault } from "./helpers/mail-feishu-save-fault";

let boundary: Awaited<ReturnType<typeof startFeishuBoundary>>;
// 在任何准备/清理 hook 前拒绝默认共享环境；专用声明仍需实际夹具隔离。
test.beforeAll(async ({ baseURL }) => {
  readDisposablePostgresTarget({ baseURL, supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    mode: process.env.PT5_E2E_FIXTURE_MODE, project: process.env.PT5_E2E_DATABASE_PROJECT,
    container: process.env.PT5_E2E_DATABASE_CONTAINER },
  (args) => execFileSync("docker", args, { encoding: "utf8", timeout: 12_000, windowsHide: true }).trim());
});

test.beforeAll(async () => { boundary = await startFeishuBoundary(); });
test.beforeEach(async () => {
  setFeishuSaveFault(false); boundary.state.mode = "ok"; boundary.state.tokens = 0; boundary.state.profiles = 0;
  await resetIntegratedMailFixture();
  // 通用邮件种子自带业务员绑定；本套件专门验证首次绑定，先清掉该本地测试凭证。
  const cleared = await getMailAdmin().from("mail_feishu_bindings").delete().in("user_id", [ADMIN_ID, SALESMAN_ID]);
  if (cleared.error) throw new Error(cleared.error.message);
  const remaining = await getMailAdmin().from("mail_feishu_bindings").select("user_id").in("user_id", [ADMIN_ID, SALESMAN_ID]);
  expect(remaining.error).toBeNull();
  expect(remaining.data).toEqual([]);
});
test.afterEach(() => { if (boundary) setFeishuSaveFault(false); });
test.afterAll(async () => {
  // beforeAll可能在绑定服务器前失败；未创建的资源无需回收，真实关闭错误仍应抛出。
  if (boundary) await closeLoopbackBoundary(boundary.server);
});

/** 操作从真实绑定按钮开始，只把第三方同意页换成可点击页面，不拦截站内授权及写入。 */
async function openConsent(page: Page, role: "administrator" | "salesman" = "administrator") {
  const workspace = role === "administrator" ? "admin" : "salesman";
  boundary.state.openId = `local-feishu-${workspace}`;
  await page.route("**/api/mail/oauth/feishu/start?*", async (route) => {
    // 浏览器拦截不再次触发 307 的下游地址；先让真实入口建授权记录，再呈现它返回的同意页。
    const response = await route.fetch({ maxRedirects: 0 });
    const url = new URL(response.headers().location);
    expect(url.origin).toBe("https://accounts.feishu.cn");
    const callback = new URL(url.searchParams.get("redirect_uri")!);
    callback.searchParams.set("code", "local-feishu-code");
    callback.searchParams.set("state", url.searchParams.get("state")!);
    await route.fulfill({ contentType: "text/html; charset=utf-8", body: `<!doctype html><meta charset="utf-8"><h1>本地飞书授权边界</h1><a href="${callback.toString().replaceAll("&", "&amp;")}">允许绑定</a>` });
  });
  await loginAs(page, role);
  await page.goto(`/${workspace}/mail`);
  await page.getByRole("button", { name: "绑定飞书", exact: true }).click();
  await expect(page.getByRole("heading", { name: "本地飞书授权边界" })).toBeVisible();
  const callback = await page.getByRole("link", { name: "允许绑定" }).getAttribute("href") as string;
  const stateHash = createHash("sha256").update(new URL(callback).searchParams.get("state")!).digest("hex");
  return { callback, stateHash, workspace, userId: role === "administrator" ? ADMIN_ID : SALESMAN_ID };
}

async function expectFailure(page: Page, reason: string, workspace = "admin") {
  await expect(page).toHaveURL(new RegExp(`/${workspace}/mail\\?feishuConnection=failed&feishuReason=${reason}`));
  const notice = page.getByTestId("mail-feishu-notice");
  await expect(notice).toHaveAttribute("data-reason", reason);
  await expect(notice).toBeVisible();
  await expect(notice).not.toContainText(/private-provider-error|NEXT_REDIRECT|0\.0\.0\.0/);
  const bindings = await getMailAdmin().from("mail_feishu_bindings").select("user_id").eq("user_id", workspace === "admin" ? ADMIN_ID : SALESMAN_ID);
  expect(bindings.error).toBeNull(); expect(bindings.data).toEqual([]);
  await page.reload(); await expect(notice).toHaveAttribute("data-reason", reason);
}

/** 重复回调的版本比较必须先有真实非空版本；两次读取失败不能互相证明成功。 */
function bindingVersion(result: { error: unknown; data: { updated_at?: unknown } | null }) {
  expect(result.error).toBeNull();
  const value = result.data?.updated_at;
  expect(typeof value).toBe("string");
  expect(value).toBeTruthy();
  return value as string;
}

for (const role of ["administrator", "salesman"] as const) {
  test(`${role} 从页面绑定，独立核对授权及绑定凭证，刷新和重复回调不重复写入`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    const { callback, stateHash, workspace, userId } = await openConsent(page, role);
    // 单独开启此开关可证明成功断言会识别真实保存失败；正常套件不注入故障。
    if (process.env.E2E_FEISHU_SAVE_FAULT === "1") setFeishuSaveFault(true);
    await page.getByRole("link", { name: "允许绑定" }).click();
    const db = getMailAdmin();
    const binding = await db.from("mail_feishu_bindings").select("user_id,open_id,updated_at").eq("user_id", userId).single();
    expect(binding.error).toBeNull();
    expect(binding.data).toMatchObject({ user_id: userId, open_id: `local-feishu-${workspace}` });
    const savedVersion = bindingVersion(binding);
    await expect(page).toHaveURL(new RegExp(`/${workspace}/mail$`));
    const transaction = await db.from("mail_oauth_transactions").select("user_id,return_url,consumed_at").eq("state_hash", stateHash).single();
    expect(transaction.error).toBeNull(); expect(transaction.data?.consumed_at).toBeTruthy();
    expect(transaction.data?.return_url).toBe(`http://localhost:3000/${workspace}/mail`);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 }); await page.reload();
      // 点击设置可等待页面完成水合，再截图；直接截服务器 HTML 会临时改变输入框样式。
      await page.getByRole("button", { name: role === "administrator" ? "邮箱设置" : "我的发件设置", exact: true }).click();
      await expect(page.getByTestId("mail-feishu-bound")).toHaveText("已绑定飞书");
      await expect(page.getByTestId("mail-secondary-status")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "绑定飞书", exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`feishu-${workspace}-${width}.png`), fullPage: true, caret: "initial" });
    }
    await page.goto(callback);
    await expect(page.getByTestId("mail-feishu-notice")).toHaveAttribute("data-reason", "state");
    const repeated = await db.from("mail_feishu_bindings").select("updated_at").eq("user_id", userId).single();
    expect(bindingVersion(repeated)).toBe(savedVersion); expect(boundary.state.tokens).toBe(1);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("button", { name: "邮件", exact: true }).click();
      await expect(page.getByTestId("mail-feishu-notice")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`feishu-${workspace}-failure-${width}.png`), fullPage: true, caret: "initial" });
    }
    expect(errors).toEqual([]);
  });
}

test("取消及缺少回调信息不会产生绑定", async ({ page }) => {
  await openConsent(page, "salesman");
  await page.goto("/api/mail/oauth/feishu/callback?error=access_denied"); await expectFailure(page, "cancelled", "salesman");
  await page.goto("/api/mail/oauth/feishu/callback"); await expectFailure(page, "incomplete", "salesman");
  expect(boundary.state.tokens).toBe(0);
});

test("过期、无效状态及外域返回地址受限制", async ({ page }) => {
  const { callback, stateHash } = await openConsent(page);
  const db = getMailAdmin();
  const expiresAt = new Date(Date.now() - 60_000).toISOString();
  const expired = await db.from("mail_oauth_transactions").update({ expires_at: expiresAt }).eq("state_hash", stateHash).select("state_hash").single();
  expect(expired.error).toBeNull();
  expect(expired.data?.state_hash).toBe(stateHash);
  const expiryReadback = await db.from("mail_oauth_transactions").select("state_hash,expires_at").eq("state_hash", stateHash).single();
  expect(expiryReadback.error).toBeNull();
  expect(expiryReadback.data?.state_hash).toBe(stateHash);
  expect(Date.parse(expiryReadback.data?.expires_at ?? "")).toBe(Date.parse(expiresAt));
  await page.goto(callback); await expectFailure(page, "state");
  await page.goto("/api/mail/oauth/feishu/callback?code=bad&state=bad"); await expectFailure(page, "state");
  await page.goto("/api/mail/oauth/feishu/start?returnUrl=https%3A%2F%2Foutside.example%2Fmail");
  await expect(page.getByRole("link", { name: "允许绑定" })).toBeVisible();
  await page.getByRole("link", { name: "允许绑定" }).click();
  await expect(page).toHaveURL(/\/admin\/mail$/);
  const states = await db.from("mail_oauth_transactions").select("return_url");
  expect(states.error).toBeNull();
  expect(states.data?.length).toBeGreaterThan(0);
  expect(states.data?.every((row) => row.return_url === "http://localhost:3000/admin/mail")).toBe(true);
});

for (const failure of ["tokenFailure", "timeout", "saveFailure"] as const) {
  test(`飞书 ${failure} 失败不能显示绑定成功`, async ({ page }) => {
    test.setTimeout(90_000);
    await openConsent(page);
    if (failure === "saveFailure") setFeishuSaveFault(true); else boundary.state.mode = failure;
    await page.getByRole("link", { name: "允许绑定" }).click();
    await expectFailure(page, "unavailable");
    await expect(page.getByRole("button", { name: "绑定飞书", exact: true })).toBeVisible();
  });
}

test("回程中断后刷新读取已保存绑定，不再次授权", async ({ page }) => {
  const { callback, userId } = await openConsent(page);
  await page.route("**/api/mail/oauth/feishu/callback?*", async (route) => { await route.fetch({ maxRedirects: 0 }); await route.abort(); });
  await page.goto(callback).catch(() => undefined);
  await page.unroute("**/api/mail/oauth/feishu/callback?*");
  const binding = await getMailAdmin().from("mail_feishu_bindings").select("open_id").eq("user_id", userId).single();
  expect(binding.error).toBeNull(); expect(binding.data?.open_id).toBe("local-feishu-admin");
  await page.goto("/admin/mail"); await page.reload();
  await expect(page.getByRole("button", { name: "绑定飞书", exact: true })).toHaveCount(0);
  expect(boundary.state.tokens).toBe(1);
});
