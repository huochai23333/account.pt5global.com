import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

test.describe("referral tree company branch", () => {
  test("administrator can see company branch in the wholesale referral tree", async ({
    page,
  }) => {
    await loginAs(page, "administrator");

    await page.goto("/admin/wholesale/referrals");
    await expect(
      page.getByRole("heading", { name: "推荐树", exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("公司", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("主分支", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("公司子类").first()).toBeVisible();
    await expectPageWidthToFit(page);
  });

  test("administrator can use referral trees on mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "administrator");

    await page.goto("/admin/wholesale/referrals");
    await expect(page.getByText("公司", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("公司子类").first()).toBeVisible();
    await expectPageWidthToFit(page);
  });
});

async function expectPageWidthToFit(page: Page) {
  const widthState = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(widthState.scrollWidth).toBeLessThanOrEqual(widthState.clientWidth + 2);
}
