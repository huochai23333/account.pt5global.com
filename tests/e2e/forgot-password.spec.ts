import { expect, test, type Page } from "@playwright/test";

import { getRegressionAccount } from "./helpers/accounts";
import { loginAs, setTestLocale } from "./helpers/auth";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";

test.describe("forgot password page", () => {
  test.beforeEach(async ({ page }) => {
    // 浏览器会保留上一个用例切换的语言，因此每个中文文案用例都显式固定语言。
    await setTestLocale(page, "zh");
  });

  test("shows pending, accepted, and cooldown states without sending a real email", async ({
    page,
  }) => {
    let releaseRequest: (() => void) | undefined;
    const requestGate = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    let requestedEmail: string | null = null;
    let requestedRedirect: string | null = null;

    // 拦截本地 Auth 请求，既能验证真实浏览器交互，又不会真的发送重置邮件。
    await page.route("**/auth/v1/recover**", async (route) => {
      const payload = readResetRequestPayload(route.request().postData());
      requestedEmail = payload.email;
      requestedRedirect =
        new URL(route.request().url()).searchParams.get("redirect_to") ??
        payload.redirectTo;

      await requestGate;
      await route.fulfill({
        body: "{}",
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto("/forgot-password");
    await page.getByLabel("电子邮箱").fill("member@example.com");
    await page.getByRole("button", { name: "发送重置邮件" }).click();

    try {
      await expect(page.getByRole("button", { name: "发送中..." })).toBeDisabled();
      expect(requestedEmail).toBe("member@example.com");
      expect(requestedRedirect).toBe("http://localhost:3000/forgot-password");
    } finally {
      // 即使前面的断言失败，也要释放请求，避免浏览器一直等待未完成的网络调用。
      releaseRequest?.();
    }

    const acceptedNotice = page.locator(
      '[data-slot="feedback-notice"][data-tone="info"]',
    );
    // Auth 服务只确认发信请求已接受，页面使用提示色，不能伪装成邮件已经投递成功。
    await expect(acceptedNotice).toHaveRole("status");
    await expect(acceptedNotice).toHaveAttribute("aria-live", "polite");
    await expect(acceptedNotice).toContainText("重置密码邮件已开始发送");
    await expect(
      page.getByRole("button", { name: /秒后可重新发送/ }),
    ).toBeDisabled();
  });

  test("invalid deployment origin still returns safe auth redirects", async ({
    request,
  }) => {
    // 线上曾因 NEXT_PUBLIC_SITE_URL 漏写协议而返回 500。
    // 这里模拟 CDN 传入正式域名，确认两个公开认证入口都能使用安全默认地址完成跳转。
    const headers = { "x-forwarded-host": "account.pt5global.com" };
    const confirmResponse = await request.get("/auth/confirm", {
      headers,
      maxRedirects: 0,
    });
    const signOutResponse = await request.post("/auth/sign-out", {
      headers,
      maxRedirects: 0,
    });
    const unsafeSignOutResponse = await request.post("/auth/sign-out?next=%2F%5Coutside.example", {
      headers,
      maxRedirects: 0,
    });

    expect(confirmResponse.status()).toBe(307);
    expect(confirmResponse.headers().location).toBe(
      "https://account.pt5global.com/login",
    );
    expect(signOutResponse.status()).toBe(303);
    expect(signOutResponse.headers().location).toBe(
      "https://account.pt5global.com/login",
    );
    expect(unsafeSignOutResponse.status()).toBe(303);
    expect(unsafeSignOutResponse.headers().location).toBe("https://account.pt5global.com/login");
  });

  test("announces a rate-limit error immediately", async ({ page }) => {
    await page.route("**/auth/v1/recover**", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          code: "over_request_rate_limit",
          message: "rate limit exceeded",
        }),
        contentType: "application/json",
        status: 429,
      });
    });

    await page.goto("/forgot-password");
    await page.getByLabel("电子邮箱").fill("member@example.com");
    await page.getByRole("button", { name: "发送重置邮件" }).click();

    const errorNotice = page.locator(
      '[data-slot="feedback-notice"][data-tone="error"]',
    );
    await expect(errorNotice).toHaveRole("alert");
    await expect(errorNotice).toHaveAttribute("aria-live", "assertive");
    await expect(errorNotice).toHaveText("请求过于频繁，请稍后再试。");
  });

  test("verified recovery link opens the new password form on desktop and mobile", async ({
    page,
  }) => {
    const adminClient = getLocalSupabaseAdminClient();

    if (!adminClient) {
      test.skip(true, "这个回归只在本地 Supabase 环境生成恢复链接。");
      return;
    }

    const account = getRegressionAccount("administrator");
    const { data, error } = await adminClient.auth.admin.generateLink({
      email: account.email,
      type: "recovery",
    });

    expect(error).toBeNull();

    if (!data.properties) {
      throw new Error("本地 Supabase 没有返回可验证的恢复链接。");
    }

    const tokenHash = data.properties.hashed_token;
    expect(tokenHash).toBeTruthy();

    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto(
      `/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`,
    );

    await expect(page).toHaveURL(/\/forgot-password\?type=recovery$/);
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByLabel("确认新密码")).toBeVisible();
    await expect(page.getByRole("button", { name: "保存新密码" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ height: 844, width: 390 });
    await page.reload();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("expired recovery token offers a new email instead of loading forever", async ({
    page,
  }) => {
    await page.goto("/auth/confirm?token_hash=expired-token&type=recovery");

    await expect(page).toHaveURL(
      /\/forgot-password\?type=recovery&error=invalid$/,
    );
    await expect(page.locator('[data-slot="feedback-notice"][role="alert"]')).toHaveText(
      "重置链接已失效，请重新发送一封重置邮件。",
    );
    await expect(page.getByLabel("电子邮箱")).toBeVisible();
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
  });

  test("ordinary signed-in session cannot imitate password recovery", async ({
    page,
  }) => {
    const account = await loginAs(page, "administrator");
    await page.goto("/forgot-password?type=recovery");

    await expect(page).toHaveURL(
      new RegExp(`${escapeRegExp(account.workspacePath)}/home(?:[?#].*)?$`),
    );
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
  });

  test("signed-in user opening the ordinary page returns to the workspace", async ({
    page,
  }) => {
    const account = await loginAs(page, "administrator");
    await page.goto("/forgot-password");

    await expect(page).toHaveURL(
      new RegExp(`${escapeRegExp(account.workspacePath)}/home(?:[?#].*)?$`),
    );
  });
});

function readResetRequestPayload(postData: string | null) {
  if (!postData) return { email: null, redirectTo: null };

  try {
    const payload = JSON.parse(postData) as {
      email?: unknown;
      redirect_to?: unknown;
    };

    return {
      email: typeof payload.email === "string" ? payload.email : null,
      redirectTo:
        typeof payload.redirect_to === "string" ? payload.redirect_to : null,
    };
  } catch {
    return { email: null, redirectTo: null };
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
