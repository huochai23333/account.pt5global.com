import { expect, test } from "@playwright/test";

import { loginAs, setTestLocale } from "./helpers/auth";

// 从真实登录页面进入工作台，验证删除入口后其他导航仍可用，并核对旧地址的终态。
for (const scenario of [
  { role: "administrator", locale: "zh" },
  { role: "administrator", locale: "en" },
  { role: "finance", locale: "zh" },
] as const) {
  test(`移除管理板块 ${scenario.role} ${scenario.locale}：导航、助手和原地址`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    const removedReads: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      // 原地址不存在时的资源诊断只在明确断言页面不存在之后单独核对。
      if (["error", "warning"].includes(message.type())) errors.push(message.text());
    });
    page.on("request", request => {
      if (/get_system_operation_health|workspace_feedback|acknowledge_system_health_alert/.test(request.url())) {
        removedReads.push(request.url());
      }
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    const account = await loginAs(page, scenario.role);
    if (scenario.locale === "en") {
      await setTestLocale(page, "en");
      await page.reload();
    }
    const removedLinks = page.locator('a[href$="/feedback"], a[href$="/system-health"]');
    const submitFeedback = page.getByRole("button", { name: /提交反馈|Submit feedback/i });
    await expect(removedLinks).toHaveCount(0);
    await expect(submitFeedback).toHaveCount(0);

    // 保留的汇率入口通过菜单点击打开，刷新后仍显示真实业务页面。
    await page.locator("aside").first().locator(`a[href="${account.workspacePath}/settings"]`).click();
    await expect(page.getByRole("heading", { name: scenario.locale === "zh" ? "汇率" : "Exchange Rates", exact: true })).toBeVisible();
    await page.reload();
    await expect(removedLinks).toHaveCount(0);
    await expect(page.getByRole("heading", { name: scenario.locale === "zh" ? "汇率" : "Exchange Rates", exact: true })).toBeVisible();

    await page.getByTestId("ai-assistant-launcher").click();
    await expect(page.locator("#ai-assistant-input")).toBeVisible();
    await expect(submitFeedback).toHaveCount(0);
    await page.locator("#ai-assistant-input").press("Escape");
    await expect(page.locator("#ai-assistant-input")).toHaveCount(0);

    await page.screenshot({ path: `output/removed-admin-panels/${scenario.role}-${scenario.locale}-1440.png` });
    await page.goto(`${account.workspacePath}/home`);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator("aside").first()).toBeHidden();
      const toggle = page.locator("header button[aria-expanded]").filter({ has: page.locator("span.min-w-0.truncate") }).first();
      await toggle.click();
      const menu = page.locator('header nav[aria-hidden="false"]');
      await expect(menu).toHaveCSS("opacity", "1");
      await expect(menu.getByRole("link").first()).toBeVisible();
      await expect(removedLinks).toHaveCount(0);
      await expect(submitFeedback).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `output/removed-admin-panels/${scenario.role}-${scenario.locale}-${width}.png` });
      await toggle.click();
    }
    await expect(page.locator("nextjs-portal [data-nextjs-dialog-overlay]")).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(removedReads).toEqual([]);

    // 页面不存在才允许预期的资源错误；不忽略正常业务页中的任何控制台错误。
    for (const segment of ["feedback", "system-health"]) {
      errors.length = 0;
      const route = `${account.workspacePath}/${segment}`;
      await page.goto(route);
      const heading = page.getByRole("heading", { name: scenario.locale === "zh" ? "你访问的页面不存在" : "The page you requested does not exist" });
      await expect(heading).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      await page.reload();
      await expect(heading).toBeVisible();
      await expect(page.locator("nextjs-portal [data-nextjs-dialog-overlay]")).toHaveCount(0);
      expect(errors.filter(message => !message.includes("404 (Not Found)"))).toEqual([]);
    }
  });
}
