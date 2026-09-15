import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

test.describe("dashboard account password reset", () => {
  test("account center submits one reset request and starts cooldown", async ({
    page,
  }) => {
    const account = await loginAs(page, "administrator");
    let resetRequestCount = 0;
    let resetRequestEmail: string | null = null;
    let resetRequestRedirectTo: string | null = null;

    // The page flow is verified without sending a real password reset email.
    await page.route("**/auth/v1/recover**", async (route) => {
      resetRequestCount += 1;
      const payload = readResetRequestPayload(route.request().postData());
      resetRequestEmail = payload.email;
      resetRequestRedirectTo =
        new URL(route.request().url()).searchParams.get("redirect_to") ??
        payload.redirectTo;

      await route.fulfill({
        body: "{}",
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto("/admin/my");
    await expect(page.getByRole("heading", { name: "账号中心" })).toBeVisible();

    const passwordResetButton = page.getByRole("button", { name: "修改密码" });
    await expect(passwordResetButton).toBeVisible();
    await passwordResetButton.click();

    await expect(
      page.getByText("重置密码邮件已开始发送", { exact: false }),
    ).toBeVisible();
    await expect(
      page.locator('[data-slot="feedback-notice"][data-tone="info"]'),
    ).toContainText("重置密码邮件已开始发送");
    const cooldownButton = page.getByRole("button", {
      name: /秒后可再次发送/,
    });
    await expect(cooldownButton).toBeDisabled();
    await expect(cooldownButton).toContainText(/秒后可再次发送/);
    await expectNoHorizontalOverflow(page);

    expect(resetRequestCount).toBe(1);
    expect(resetRequestEmail).toBe(account.email);
    expect(resetRequestRedirectTo).toBe("http://localhost:3000/forgot-password");
  });

  test("account center layout fits desktop and mobile widths", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");
    await page.goto("/admin/my");
    await expect(page.getByRole("heading", { name: "账号中心" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ height: 844, width: 390 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "账号中心" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

function readResetRequestPayload(postData: string | null) {
  if (!postData) {
    return { email: null, redirectTo: null };
  }

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
