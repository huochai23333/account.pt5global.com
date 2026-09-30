import { expect, test } from "@playwright/test";

import { getRegressionAccount } from "./helpers/accounts";
import { setTestLocale } from "./helpers/auth";
import { getLocalSupabaseAdminClient, readLocalEnvValue } from "./helpers/local-supabase-admin";

test("密码按钮可用鼠标和键盘切换，保留输入内容", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setTestLocale(page, "zh");
  await page.goto("/login");
  const password = page.locator('input[name="password"]');
  await password.fill("Visibility-test-123!");
  await page.getByRole("button", { name: "显示密码", exact: true }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("Visibility-test-123!");
  await page.getByRole("button", { name: "隐藏密码", exact: true }).press("Enter");
  await expect(password).toHaveAttribute("type", "password");
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("button", { name: "显示密码", exact: true })).toBeVisible();
});

test("登录等待时仍可查看密码，失败后按钮和表单恢复", async ({ page }) => {
  const account = getRegressionAccount("salesman");
  let releaseRequest: (() => void) | undefined;
  const blockedRequest = new Promise<void>((resolve) => { releaseRequest = resolve; });
  await page.route("**/api/supabase/auth/v1/token?*", async (route) => {
    await blockedRequest;
    await route.fulfill({
      status: 408,
      contentType: "application/json",
      body: JSON.stringify({ error_code: "request_timeout", message: "request_timeout" }),
    });
  });
  try {
    await setTestLocale(page, "zh");
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(account.email);
    const password = page.locator('input[name="password"]');
    await password.fill(account.password);
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByRole("button", { name: "登录中..." })).toBeDisabled();
    await expect(password).toHaveAttribute("readonly", "");
    await page.getByRole("button", { name: "显示密码" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "隐藏密码" }).click();
    await expect(password).toHaveAttribute("type", "password");
  } finally {
    releaseRequest?.();
  }
  await expect(page.getByText("登录等待时间过长，请检查网络后再试。")).toBeVisible();
  await expect(page.getByRole("button", { name: "登录", exact: true })).toBeEnabled();
  await expect(page).toHaveURL(/\/login$/);
});

test("浏览器不能直连数据库时仍可登录，刷新保留真实身份", async ({ page }) => {
  const admin = getLocalSupabaseAdminClient();
  test.skip(!admin, "需要本地 Docker 认证服务独立核对身份。");
  if (!admin) return;
  const upstream = readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL")!;
  const directRequests: string[] = [];
  // 只切断浏览器直连；网站服务端仍可访问本地 Docker，模拟员工无法连接境外服务。
  await page.route(`${upstream}/**`, async (route) => {
    directRequests.push(new URL(route.request().url()).pathname);
    await route.abort("connectionfailed");
  });
  const account = getRegressionAccount("salesman");
  await setTestLocale(page, "zh");
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/salesman\/home$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "PT5 系统", exact: true })).toBeVisible();
  // 从浏览器 Cookie 取得当前令牌，仅在测试进程中交给独立认证客户端核对用户。
  // 不输出令牌；同时查询权威资料表，避免把接口成功误当作工作台身份已生效。
  const session = await readBrowserSession(page);
  const { data: authenticated, error: authError } = await admin.auth.getUser(session.access_token);
  if (authError) throw authError;
  const { data: profile, error } = await admin.from("user_profiles")
    .select("user_id,email").eq("email", account.email).single();
  if (error) throw error;
  expect(profile.email).toBe(account.email);
  expect(authenticated.user.id).toBe(profile.user_id);
  await page.reload();
  await page.goto("/salesman/my");
  await expect(page.getByText(account.email, { exact: true }).first()).toBeVisible();
  expect(directRequests).toEqual([]);
});

test("转发入口拒绝无密钥和外站请求", async ({ request }) => {
  const path = "/api/supabase/auth/v1/health";
  expect((await request.get(path)).status()).toBe(401);
  expect((await request.get(path, { headers: { origin: "https://other.example" } })).status()).toBe(403);
  expect((await request.get("/api/supabase/rest/v1/../private", {
    headers: { apikey: readLocalEnvValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? "invalid" },
  })).status()).toBe(404);
});

test("真实密码错误不会生成会话或进入工作台", async ({ page }) => {
  const account = getRegressionAccount("salesman");
  await setTestLocale(page, "zh");
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(`${account.password}wrong`);
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByText("邮箱或密码不正确，请重新输入。")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.context().cookies()).filter(({ name }) => /^sb-.*-auth-token/.test(name))).toEqual([]);
});

async function readBrowserSession(page: import("@playwright/test").Page) {
  const cookies = (await page.context().cookies()).filter(({ name }) => /^sb-.*-auth-token(?:\.\d+)?$/.test(name));
  expect(cookies.length).toBeGreaterThan(0);
  const value = cookies.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
    .map((cookie) => cookie.value).join("");
  return JSON.parse(Buffer.from(value.startsWith("base64-") ? value.slice(7) : value, "base64url").toString("utf8")) as {
    access_token: string;
  };
}
