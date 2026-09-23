import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";
import { resetIntegratedMailFixture } from "./helpers/mail-fixtures";

test("1440、390、320px 下左栏与邮件内容没有横向溢出", async ({ page }) => {
  await resetIntegratedMailFixture();
  await loginAs(page, "administrator");
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 720 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin/mail");
    await expect(page.getByRole("heading", { name: "邮件工作台" })).toBeVisible();
    // 同一份业务内容依次进入收件箱、规则和隔离区，核对最窄宽度也不会撑开整页。
    for (const section of [null, "收件规则", /隔离区 0/] as const) {
      if (section) await page.getByRole("button", { name: section }).click();
      const layout = await page.evaluate(() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth }));
      expect(layout.scroll).toBeLessThanOrEqual(layout.viewport);
    }
  }
});
