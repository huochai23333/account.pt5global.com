import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

// 这里只检查客户推荐目录的展示；账号推荐树、关系写入和佣金权限另有测试。
test.describe("referral tree company branch", () => {
  test("administrator can see company branch in the wholesale referral tree", async ({
    page,
  }) => {
    await loginAs(page, "administrator");

    await page.goto("/admin/wholesale/referrals");
    await expect(
      page.getByRole("heading", { name: "推荐树", exact: true }).first(),
    ).toBeVisible();
    const directory = page.getByRole("region", { name: "客户推荐树", exact: true });
    // 分页记录只有客户，公司根节点显示为路径；不能再要求已移除的独立根卡片。
    await expect(directory.getByText(/^公司(?: → .+)?$/).first()).toBeVisible();
    await expect(directory.getByText("主分支", { exact: true })).toHaveCount(0);
    await expect(directory.getByText("公司子类", { exact: true }).first()).toBeVisible();
    await expectPageWidthToFit(page);
  });

  test("administrator can use referral trees on mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "administrator");

    await page.goto("/admin/wholesale/referrals");
    const directory = page.getByRole("region", { name: "客户推荐树", exact: true });
    await expect(directory.getByText(/^公司(?: → .+)?$/).first()).toBeVisible();
    await expect(directory.getByText("公司子类", { exact: true }).first()).toBeVisible();
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
