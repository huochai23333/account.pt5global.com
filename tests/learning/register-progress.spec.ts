import { test, expect } from "@playwright/test";

// 只走资料填写，不提交注册；拦截最终注册请求作为防线，不能向 Auth 或邮件服务产生写入。
for (const language of ["zh", "en"] as const) {
  test(`注册步骤的连线跟随实际顺序：${language}`, async ({
    page,
    context,
  }, testInfo) => {
    let signupRequests = 0;
    await page.route("**/auth/v1/signup**", (route) => {
      signupRequests += 1;
      return route.abort();
    });
    await context.addCookies([
      { name: "bs-locale", value: language, url: "http://localhost:3000" },
    ]);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) errors.push(message.text());
    });
    await page.goto("/register");
    const next = () =>
      page.getByRole("button", {
        name: language === "zh" ? "下一步" : "Continue",
        exact: true,
      });
    const connectors = page.locator('form [role="list"] span[aria-hidden]');
    await expect(connectors).toHaveCount(2);
    await next().click();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    // 当前是第二步，只有第一段连接线已完成，不能按英文单词的字典顺序判断。
    await expect(connectors.nth(0)).toHaveClass(/bg-primary/);
    await expect(connectors.nth(1)).toHaveClass(/bg-border/);
    await page.locator('input[name="username"]').fill("学习步骤验证");
    await page
      .locator('input[name="email"]')
      .fill("learning-progress@example.invalid");
    await next().click();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(connectors.nth(0)).toHaveClass(/bg-primary/);
    await expect(connectors.nth(1)).toHaveClass(/bg-primary/);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`register-${language}-${width}.png`),
        fullPage: true,
      });
    }
    await page.reload();
    await expect(connectors.nth(0)).toHaveClass(/bg-border/);
    await expect(connectors.nth(1)).toHaveClass(/bg-border/);
    expect(signupRequests).toBe(0);
    expect(errors).toEqual([]);
  });
}
