import { test, expect } from "./fixtures";
import { loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import zh from "../../messages/zh.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };

test.use({ learningRole: "salesman" });

// 只替换该页面的读取边界；实际登录、资料页面与 Hook 继续执行，不写业务权限。
for (const [language, width] of [
  ["zh", 1440],
  ["en", 390],
] as const) {
  test(`邀请权限读取失败可重试：${language}/${width}`, async ({
    page,
    context,
    learningUser,
  }, testInfo) => {
    const copy = (language === "zh" ? zh : en).DashboardMy;
    await page.setViewportSize({ width, height: 1000 });
    await context.addCookies([
      { name: "bs-locale", value: "zh", url: "http://localhost:3000" },
    ]);
    await loginLearningUser(page, learningUser);
    await context.addCookies([
      { name: "bs-locale", value: language, url: "http://localhost:3000" },
    ]);
    let unavailable = true;
    await page.route(
      "**/rest/v1/rpc/get_current_salesman_business_boards",
      (route) =>
        unavailable
          ? route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ message: "synthetic-read-failure" }),
            })
          : route.continue(),
    );
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/salesman/my");
    await expect(
      page.getByText(copy.businessInviteLoadFailed, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(copy.businessInviteNoAccess, { exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`invite-error-${language}-${width}.png`),
      fullPage: true,
    });
    unavailable = false;
    await page
      .getByRole("button", { name: copy.businessInviteRetry, exact: true })
      .click();
    await expect(
      page.getByText(copy.businessInviteLoadFailed, { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: language === "zh" ? /复制.*注册链接/ : /^Copy .+ Link$/,
      }),
    ).toHaveCount(1);
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: language === "zh" ? /复制.*注册链接/ : /^Copy .+ Link$/,
      }),
    ).toHaveCount(1);
    expect(pageErrors).toEqual([]);
  });
}
