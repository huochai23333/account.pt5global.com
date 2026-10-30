import { expect, test } from "@playwright/test";
import { localeCookieName } from "../../i18n/config";

/**
 * 只验证真实公共登录页的渲染和断线反馈；请求在浏览器边界被中止，不提交真实密码或创建会话。
 * 这些结果不替代受准入限制的真实角色登录、认证记录读回和工作台验收。
 */
for (const [width, locale] of [[1440, "zh"], [390, "zh"], [320, "zh"], [390, "en"]] as const) {
  test(`公共登录页 ${locale}/${width}px：连接中断后可检查状态且无溢出`, async ({ page }) => {
    const errors: string[] = [];
    const diagnostics: string[] = [];
    let passwords = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.text().includes('"event":"pt5.auth"')) diagnostics.push(message.text());
    });
    await page.setViewportSize({ width, height: width > 1000 ? 1000 : 844 });
    await page.context().addCookies([{ name: localeCookieName, value: locale, url: "http://localhost:3000" }]);
    await page.route((url) => url.pathname === "/auth/v1/token", async (route) => {
      // 无论项目地址如何配置，都不能把合成输入送到真实认证服务。
      passwords += 1;
      await route.abort("connectionreset");
    });
    await page.goto("/login");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await page.locator('input[name="email"]').fill("network-check@example.invalid");
    await page.locator('input[name="password"]').fill("Synthetic-Password-Only!");
    await page.locator('form button[type="submit"]').click();
    const recovery = page.getByRole("button", { name: locale === "zh" ? "检查登录状态" : "Check sign-in status", exact: true });
    await expect(recovery).toBeVisible();
    await expect(page.locator('form [role="alert"]')).toContainText(locale === "zh" ? "当前登录结果还未确认" : "not yet confirmed");
    expect(passwords).toBe(1);
    const rect = await recovery.boundingBox();
    expect(rect?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/security-auth-recovery/login-${locale}-${width}.png`, fullPage: true });
    if (width === 1440) {
      await page.locator("form").screenshot({ path: "docs/security-auth-recovery/login-recovery-feedback.png" });
    }
    await recovery.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('form [role="alert"]')).toContainText(locale === "zh" ? "当前登录状态已失效" : "no longer valid");
    expect(passwords).toBe(1);
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.context().cookies()).filter(({ name }) => /^sb-.*-auth-token/.test(name))).toEqual([]);
    await page.reload();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('form button[type="submit"]')).toBeEnabled();
    expect(errors).toEqual([]);
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    for (const line of diagnostics) {
      expect(line).not.toContain("network-check@example.invalid");
      expect(line).not.toContain("Synthetic-Password-Only!");
    }
  });
}

test("密码错误和限流保留各自提示，不当成断线恢复", async ({ page }) => {
  await page.context().addCookies([{ name: localeCookieName, value: "zh", url: "http://localhost:3000" }]);
  let response = { status: 400, code: "invalid_credentials" };
  let passwords = 0;
  await page.route((url) => url.pathname === "/auth/v1/token", async (route) => {
    passwords++;
    await route.fulfill({ status: response.status, contentType: "application/json",
      headers: { "x-supabase-api-version": "2024-01-01", "access-control-expose-headers": "X-Supabase-Api-Version" },
      body: JSON.stringify({ code: response.code, message: response.code }) });
  });
  await page.goto("/login");
  await page.locator('input[name="email"]').fill("network-check@example.invalid");
  await page.locator('input[name="password"]').fill("Synthetic-Password-Only!");
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('form [role="alert"]')).toContainText("邮箱或密码不正确");
  response = { status: 429, code: "over_request_rate_limit" };
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('form [role="alert"]')).toContainText("尝试次数过多");
  expect(passwords).toBe(2);
  await expect(page.getByRole("button", { name: "检查登录状态", exact: true })).toHaveCount(0);
});

test("密码请求持续无响应时实际取消，不自动重发密码", async ({ page }) => {
  let passwords = 0;
  await page.context().addCookies([{ name: localeCookieName, value: "zh", url: "http://localhost:3000" }]);
  // 请求停在浏览器边界；等待页面自己的 AbortController 终止它，不向认证服务发送。
  await page.route((url) => url.pathname === "/auth/v1/token", () => { passwords++; });
  await page.goto("/login");
  await page.locator('input[name="email"]').fill("network-check@example.invalid");
  await page.locator('input[name="password"]').fill("Synthetic-Password-Only!");
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('form button[type="submit"]')).toBeDisabled();
  await expect(page.locator('form [role="alert"]')).toContainText("登录等待时间过长", { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "检查登录状态", exact: true })).toBeVisible();
  expect(passwords).toBe(1);
  expect((await page.context().cookies()).filter(({ name }) => /^sb-.*-auth-token/.test(name))).toEqual([]);
});

// 品牌头属于三个认证页共用的面板，窄屏换行修正也要检查其他两个公开入口。
for (const pathname of ["/register", "/forgot-password"]) {
  for (const width of [320, 1440]) {
    test(`共享认证面板 ${pathname}/${width}px 保持可读且无溢出`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.context().addCookies([{ name: localeCookieName, value: "zh", url: "http://localhost:3000" }]);
      await page.goto(pathname);
      await expect(page.locator('[data-auth-region="form"] h2')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}
