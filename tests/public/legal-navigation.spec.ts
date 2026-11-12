import { expect, test } from "@playwright/test";
import { localeCookieName } from "../../i18n/config";

const pages = [
  { path: "/help", zh: "帮助中心", en: "Help Center", sections: 5 },
  { path: "/privacy", zh: "隐私政策", en: "Privacy Policy", sections: 8 },
  { path: "/terms", zh: "服务条款", en: "Terms of Service", sections: 10 },
] as const;

for (const width of [1440, 390]) {
  for (const locale of ["zh", "en"] as const) {
    test(`公开内容导航 ${locale}/${width}px：当前链接与页面一致`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 844 });
      await page.context().addCookies([{ name: localeCookieName, value: locale, url: "http://localhost:3000" }]);
      await page.goto("/login");
      await page.getByRole("link", { name: pages[0][locale], exact: true }).click();

      // 从真实登录页页脚进入，随后只用公开页导航切换正文。
      for (const entry of pages) {
        if (entry !== pages[0]) {
          await page.getByRole("navigation").getByRole("link", { name: entry[locale], exact: true }).click();
        }
        await expect(page).toHaveURL(new RegExp(`${entry.path}$`));
        await expect(page).toHaveTitle(new RegExp(entry[locale]));
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(entry[locale]);
        await expect(page.locator("article h2")).toHaveCount(entry.sections);
        const currentLink = page.getByRole("navigation").locator('[aria-current="page"]');
        await expect(currentLink).toHaveCount(1);
        await expect(currentLink).toHaveText(entry[locale]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }

      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(pages[2][locale]);
      await expect(page.getByRole("navigation").locator('[aria-current="page"]')).toHaveText(pages[2][locale]);
      await page.screenshot({ path: testInfo.outputPath(`terms-${locale}-${width}.png`) });

      // 条款路由使用共用的语言环境，切换后应保留路径和当前页标记。
      const nextLocale = locale === "zh" ? "en" : "zh";
      const language = nextLocale === "zh" ? "中文" : "EN";
      if (width < 640) {
        await page.getByRole("button", { name: locale === "zh" ? "切换语言" : "Change language", exact: true }).click();
        await page.getByRole("menuitemradio", { name: language, exact: true }).click();
      } else {
        await page.getByRole("button", { name: language, exact: true }).click();
      }
      await expect(page).toHaveURL(/\/terms$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(pages[2][nextLocale]);
      await page.reload();
      await expect(page.getByRole("navigation").locator('[aria-current="page"]')).toHaveText(pages[2][nextLocale]);
      expect(errors).toEqual([]);
    });
  }
}
