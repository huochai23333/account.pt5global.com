import { expect, test } from "@playwright/test";

import { loginAs, setTestLocale } from "./helpers/auth";

for (const role of ["administrator", "salesman"] as const) {
  test(`${role} wholesale navigation starts with leads, customers and orders`, async ({ page }) => {
    test.setTimeout(120_000);
    await loginAs(page, role);
    const workspace = role === "administrator" ? "admin" : role;
    const prefix = `/${workspace}/wholesale/`;
    const expected = ["leads", "customers", "orders", "inventory-orders", "settlement-releases", "order-claims", "logistics",
      ...(role === "administrator" ? ["people"] : []), "vip", "referrals", "commission", "incentives",
      ...(role === "administrator" ? ["settings"] : [])];

    for (const locale of ["zh", "en"] as const) {
      await setTestLocale(page, locale);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${prefix}leads`);
      const aside = page.locator("aside").first();
      // 桌面侧栏直接展示全部板块，标题不再控制收起或展开。
      await expect(aside.getByText(locale === "zh" ? "批发业务" : "Wholesale Business", { exact: true })).toBeVisible();
      await expect(aside.getByRole("button", { name: locale === "zh" ? "批发业务" : "Wholesale Business", exact: true })).toHaveCount(0);

      const desktopLinks = aside.locator(`a[href^="${prefix}"]`);
      await expect(desktopLinks).toHaveCount(expected.length);
      await expect(desktopLinks.first()).toBeVisible();
      await expect(desktopLinks.last()).toBeVisible();
      expect(await desktopLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")?.split("/").pop()))).toEqual(expected);
      await expect(desktopLinks.nth(0)).toHaveText(locale === "zh" ? "线索" : "Leads");
      await expect(desktopLinks.nth(1)).toHaveText(locale === "zh" ? "客户管理" : "Customer Management");
      await expect(desktopLinks.nth(2)).toHaveText(locale === "zh" ? "批发订单" : "Wholesale Orders");
      await page.screenshot({ path: `output/wholesale-nav-${role}-${locale}-1440.png` });

      // 实际点击前三项，保证只是调整位置，没有改变链接对应的页面。
      for (const section of expected.slice(0, 3)) {
        await aside.locator(`a[href="${prefix}${section}"]`).click();
        await expect(page).toHaveURL(new RegExp(`${prefix}${section}$`));
      }

      await page.setViewportSize({ width: 375, height: 812 });
      const header = page.locator("header").first();
      await header.getByRole("button", { name: locale === "zh" ? "批发业务 / 批发订单" : "Wholesale Business / Wholesale Orders", exact: true }).click();
      const mobileLinks = header.locator(`nav[aria-hidden="false"] a[href^="${prefix}"]`);
      await expect(mobileLinks).toHaveCount(expected.length);
      expect(await mobileLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")?.split("/").pop()))).toEqual(expected);
      await mobileLinks.nth(2).scrollIntoViewIfNeeded();
      for (const index of [0, 1, 2]) await expect(mobileLinks.nth(index)).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(await mobileLinks.evaluateAll((links) => links.every((link) => link.clientWidth >= 100 && link.scrollWidth <= link.clientWidth + 1))).toBe(true);
      await page.screenshot({ path: `output/wholesale-nav-${role}-${locale}-375.png` });
      await mobileLinks.first().click();
      await expect(page).toHaveURL(new RegExp(`${prefix}leads$`));
    }
  });
}
