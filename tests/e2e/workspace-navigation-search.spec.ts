import { expect, test } from "@playwright/test";
import { loginAs, setTestLocale } from "./helpers/auth";
import type { RegressionRole } from "./helpers/accounts";

// 从真实菜单发起搜索与跳转；每个岗位以登录后的权限内入口作为结果边界。
const roles: RegressionRole[] = ["administrator", "salesman", "operator", "finance", "client"];
for (const role of roles) {
  for (const locale of role === "administrator" ? ["zh", "en"] as const : ["zh"] as const) {
    test(`工作栏搜索 ${role} ${locale}：筛选、清空、跳转和响应式`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
      });
      await page.setViewportSize({ width: 1440, height: 900 });
      await loginAs(page, role);
      if (locale === "en") {
        await setTestLocale(page, "en");
        await page.reload();
      }
      const sidebar = page.locator("aside").first();
      const links = sidebar.locator("nav a");
      const search = sidebar.getByRole("searchbox", { name: locale === "zh" ? "搜索板块" : "Search sections" });
      const clear = sidebar.getByRole("button", { name: locale === "zh" ? "清空搜索" : "Clear search" });
      await expect(search).toBeVisible();
      const original = await links.evaluateAll((nodes) => nodes.map((node) => ({
        href: node.getAttribute("href")!,
        label: node.querySelector("span")!.textContent!.trim(),
      })));
      expect(original.length).toBeGreaterThan(1);
      const target = original.find((item) => item.href.endsWith("/documents"))!;
      expect(target).toBeTruthy();
      const keyword = target.label.slice(0, 2);
      const expected = original.filter((item) => item.label.toLowerCase().includes(keyword.toLowerCase()));
      await search.fill(`  ${keyword.toUpperCase()}  `);
      expect(await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")))).toEqual(expected.map((item) => item.href));
      // 清空按钮可用键盘抵达，清空后焦点回到搜索框，完整入口和顺序均恢复。
      await search.press("Tab");
      await expect(clear).toBeFocused();
      await clear.press("Enter");
      await expect(search).toBeFocused();
      await expect(search).toHaveValue("");
      await expect(links).toHaveCount(original.length);
      await search.fill(keyword);
      await search.press("Escape");
      await expect(search).toHaveValue("");
      await expect(links).toHaveCount(original.length);
      await search.fill("板块不存在-zzzz-no-section");
      await expect(links).toHaveCount(0);
      await expect(sidebar.getByRole("status")).toHaveText(locale === "zh" ? "没有找到相关板块" : "No matching sections");
      await clear.click();

      // 短桌面滚动到末项时，搜索位置不动，菜单末项不能被退出按钮遮挡。
      for (const width of [1440, 1024]) {
        await page.setViewportSize({ width, height: 720 });
        const before = await search.boundingBox();
        await links.last().scrollIntoViewIfNeeded();
        const after = await search.boundingBox();
        expect(after!.y).toBeCloseTo(before!.y, 0);
        await expect(search).toBeInViewport();
        await expect(links.last()).toBeInViewport();
        const last = await links.last().boundingBox();
        const logout = await sidebar.getByRole("button", { name: locale === "zh" ? "退出登录" : "Sign Out", exact: true }).boundingBox();
        expect(last!.y + last!.height).toBeLessThanOrEqual(logout!.y + 1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        await links.first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `output/nav-search-${role}-${locale}-${width}.png` });
      }

      await search.fill(target.label);
      await search.press("Tab"); await clear.press("Tab");
      await expect(links.first()).toBeFocused();
      await sidebar.locator(`nav a[href="${target.href}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${target.href}$`));
      await expect(page.getByRole("heading", { name: target.label, exact: true })).toBeVisible();
      await expect(search).toHaveValue("");
      await expect(links).toHaveCount(original.length);
      await expect(sidebar.locator(`nav a[href="${target.href}"]`)).toHaveAttribute("aria-current", "page");
      await search.fill(keyword);
      await page.reload();
      await expect(search).toHaveValue("");
      await expect(links).toHaveCount(original.length);
      expect(await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")))).toEqual(original.map((item) => item.href));

      // 桌面控件只存在于隐藏侧栏；手机和平板可见顶部菜单不增加搜索。
      // 资料库仅提供桌面入口，窄屏导航验收使用双方均支持的首页入口。
      await page.goto(original[0].href);
      if (role === "administrator" && locale === "zh") {
        // 只切换编辑视图，不增删或移动组件，确认搜索不会挤入添加组件侧栏。
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.getByTestId("home-edit-button").click();
        await expect(page.getByTestId("home-widget-sidebar")).toBeInViewport();
        await expect(search).not.toBeInViewport();
        await page.getByTestId("home-edit-done-button").click();
        await expect(search).toBeInViewport();
      }
      for (const width of [768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(sidebar).toBeHidden();
        await expect(page.getByRole("searchbox", { name: locale === "zh" ? "搜索板块" : "Search sections" })).toHaveCount(0);
        const toggle = page.locator("header button[aria-expanded]").filter({ has: page.locator("span.min-w-0.truncate") }).first();
        await toggle.click();
        const menu = page.locator('header nav[aria-hidden="false"]');
        await expect(menu).toHaveCSS("opacity", "1");
        await expect(menu.getByRole("link").first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        await page.screenshot({ path: `output/nav-search-${role}-${locale}-${width}.png` });
        await toggle.click();
      }
      await expect(page.locator("nextjs-portal [data-nextjs-dialog-overlay]")).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
}
