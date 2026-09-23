import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

test("批发订单默认常用列并可切换到完整字段", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, "administrator");
  await page.goto("/admin/wholesale/orders");

  // 切换前后用可见表头和操作入口核对真实渲染结果。
  await expect(page.getByRole("columnheader")).toHaveCount(7);
  await expect(page.locator('[data-testid^="wholesale-order-row-"]').first()).toBeVisible();
  await page.getByRole("button", { name: "查看全部字段" }).click();
  await expect(page.getByRole("button", { name: "显示常用字段" })).toBeVisible();
  await expect(page.getByRole("columnheader")).toHaveCount(26);
  await expect(page.getByRole("button", { name: "管理附件" }).first()).toBeVisible();

  // 本地种子单号包含上海时区的当前月份，避免跨月后回归用例误查旧单号。
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit" })
    .format(new Date()).replace("-", "");
  await page.getByLabel("搜索订单").fill(`WH-LOCAL-${month}-002`);
  await page.getByRole("button", { name: "跨日期查此单号" }).click();
  await expect(page.locator('[data-testid^="wholesale-order-row-"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "管理附件" })).toBeVisible();
});
