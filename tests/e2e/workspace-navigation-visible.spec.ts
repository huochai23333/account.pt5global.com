import { expect, test } from "@playwright/test";

import { expectWorkspaceShell, loginAs } from "./helpers/auth";

test("desktop wholesale sections stay visible after navigation and reload", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await loginAs(page, "administrator");
  await page.goto("/admin/home");
  await expectWorkspaceShell(page);

  const sidebar = page.locator("aside").first();
  const wholesaleLinks = sidebar.locator('a[href^="/admin/wholesale/"]');

  // 桌面业务标题没有折叠按钮；板块可直接访问并在刷新后继续显示。
  await expect(sidebar.getByText("批发业务", { exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "批发业务" })).toHaveCount(0);
  await expect(wholesaleLinks.first()).toBeVisible();
  await expect(wholesaleLinks.last()).toBeVisible();
  await wholesaleLinks.last().scrollIntoViewIfNeeded();
  await expect(wholesaleLinks.last()).toBeInViewport();
  await wholesaleLinks.first().click();
  await expect(page).toHaveURL(/\/admin\/wholesale\/leads$/);
  await page.reload();
  await expect(wholesaleLinks.first()).toBeVisible();
  await expect(wholesaleLinks.last()).toBeVisible();

  await page.setViewportSize({ height: 812, width: 375 });
  const mobileHeader = page.locator("header").first();
  await mobileHeader
    .getByRole("button", { name: "批发业务 / 线索" })
    .click();
  await expect(
    mobileHeader.locator('nav[aria-hidden="false"] a[href^="/admin/wholesale/"]').first(),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
