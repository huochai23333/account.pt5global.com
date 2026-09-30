import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

test("邮件筛选等待时显示反馈，完成后仍可刷新读取", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await loginAs(page, "administrator");
  await page.goto("/admin/mail");
  await expect(page.getByRole("heading", { name: "邮件会话" })).toBeVisible();

  await page.route("**/api/mail/threads", async (route) => {
    if (route.request().method() === "POST") {
      // 人为延长只读请求，验证等待中的动画确实留在页面直到结果返回。
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
    await route.continue();
  });

  await page.getByRole("button", { name: /等待客户/ }).click();
  await expect(page.getByRole("heading", { name: "邮件会话" }).locator("svg.animate-spin")).toBeVisible();
  await expect(page.getByRole("heading", { name: "邮件会话" }).locator("svg.animate-spin")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "邮件会话" })).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("手机首页复制等待时只标记当前按钮", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, "administrator");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          await new Promise((resolve) => setTimeout(resolve, 900));
        },
      },
    });
  });

  const button = page.getByTestId("home-invite-copy-code").first();
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute("aria-busy", "true");
  await expect(button.locator("svg.animate-spin")).toBeVisible();
  await expect(button).not.toHaveAttribute("aria-busy", "true");
  await page.reload();
  await expect(page.getByTestId("home-invite-code").first()).toBeVisible();
  // 手机宽度下的等待图标不能把按钮或页面撑出视口。
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
