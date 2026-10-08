import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";
import { expectNoPageOverflow } from "./helpers/company-template-actions";

const SEEDED_TEMPLATE_ID = "a3200000-0000-4000-8000-000000000001";

test("模板预览在跳转和正文载入期间持续显示等待提示", async ({ page }) => {
  await loginAs(page, "salesman");
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  // 延迟目标页的数据响应，让真实点击后的短暂等待稳定复现。
  await page.route(`**/company-templates/${SEEDED_TEMPLATE_ID}*`, async (route) => {
    const request = route.request();
    if (request.headers().rsc === "1" || request.url().includes("_rsc=")) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    await route.continue();
  });
  await page.goto("/salesman/company-templates");
  await page.getByRole("link", { name: "预览模板" }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "正在打开模板，请稍候…" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/salesman/company-templates/${SEEDED_TEMPLATE_ID}$`));
  await expect(page.frameLocator("iframe").getByText("PT5 Dropshipping", { exact: true })).toBeVisible();
  await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(0);
  await expectNoPageOverflow(page);
  await page.reload();
  await expect(page.frameLocator("iframe").getByText("PT5 Dropshipping", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByText("公司模板请在电脑上填写和打印。")).toBeVisible();
  await expectNoPageOverflow(page);
  expect(pageErrors).toEqual([]);
});
