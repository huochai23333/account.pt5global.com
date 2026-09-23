import { expect, test } from "@playwright/test";

import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";

test("wholesale orders remain usable in English at mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await loginAs(page, "administrator");
  await page.goto("/admin/wholesale/orders");
  await expectWorkspaceShell(page);
  await expectNotForbiddenPage(page);

  // 移动端语言入口使用紧凑菜单，先展开，再选择英文。
  await page.getByRole("button", { name: "切换语言" }).click();
  await page.getByRole("menuitemradio", { name: "EN", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Wholesale order" }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Unsettled", { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: /More filters/ }).click();
  await expect(page.getByLabel("Included month")).toBeVisible();
  await expect(page.getByText("结汇后计算", { exact: true })).toHaveCount(0);

  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflowPixels).toBeLessThanOrEqual(2);
});
