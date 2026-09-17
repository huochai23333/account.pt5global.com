import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test("报价表视觉对照", async ({ page }) => {
  await loginAs(page, "salesman");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/salesman/quotes/new");
  // 等客户端表单接管完毕后再截图，避免截图器隐藏光标的临时样式触发开发模式提示。
  await page.getByLabel("Client / store").click();
  await page.locator(".q-document-title").click();
  // 对照附件的主要层次和列数，防止以后只保留字段却把纸张式版式改掉。
  const sections = await page.locator(".q-page:first-of-type .q-letterhead, .q-page:first-of-type .q-page-head, .q-page:first-of-type .q-dest-fields, .q-page:first-of-type .q-document-title, .q-page:first-of-type .q-tax, .q-page:first-of-type .q-table-scroll")
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
  expect(sections).toHaveLength(6);
  expect(sections).toEqual([...sections].sort((a, b) => a - b));
  await expect(page.locator(".q-table thead th")).toHaveCount(17);
  await page.locator(".q-form").screenshot({ path: "output/quote-current-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator(".q-form").screenshot({ path: "output/quote-current-mobile.png" });
});
