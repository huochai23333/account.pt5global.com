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

  // 桌面直接列出入口；选中的首页和业务行也必须保持相同位置与高度。
  await expect(sidebar.getByText("批发业务", { exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("button", { name: "批发业务" })).toHaveCount(0);
  await expect(wholesaleLinks.first()).toBeVisible();
  await expect(wholesaleLinks.last()).toBeVisible();
  const dimensions = await sidebar.locator("nav a").evaluateAll((links) => links.map((link) => {
    const row = link.getBoundingClientRect();
    const icon = link.querySelector("svg")!.getBoundingClientRect();
    const label = link.querySelector("span")!.getBoundingClientRect();
    return { x: row.x, width: row.width, height: row.height, iconX: icon.x, labelX: label.x };
  }));
  for (const row of dimensions) {
    for (const key of ["x", "width", "height", "iconX", "labelX"] as const) {
      expect(Math.abs(row[key] - dimensions[0][key])).toBeLessThanOrEqual(1);
    }
  }
  await page.screenshot({ path: "output/sidebar-alignment-desktop.png" });
  await wholesaleLinks.last().scrollIntoViewIfNeeded();
  await expect(wholesaleLinks.last()).toBeInViewport();
  await wholesaleLinks.first().click();
  await expect(page).toHaveURL(/\/admin\/wholesale\/leads$/);
  await page.reload();
  await expect(wholesaleLinks.first()).toBeVisible();
  await expect(wholesaleLinks.last()).toBeVisible();

  // 小屏仍使用原有顶部菜单，分别检查三个常用窄屏宽度。
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ height: 812, width });
    const mobileHeader = page.locator("header").first();
    const menuButton = mobileHeader.getByRole("button", { name: "批发业务 / 线索" });
    const mobileNavigation = mobileHeader.locator('nav[aria-hidden="false"]');
    await menuButton.click();
    // 等待展开动画完成再截图，避免把动画中暂时透底的画面误判为最终布局。
    await expect(mobileNavigation).toHaveCSS("opacity", "1");
    await expect(
      mobileNavigation.locator('a[href^="/admin/wholesale/"]').first(),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: `output/sidebar-alignment-mobile-${width}.png` });
    await menuButton.click();
  }
  await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
