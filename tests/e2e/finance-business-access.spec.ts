import { expect, test, type Page } from "@playwright/test";

import {
  expectForbiddenPage,
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";

test.describe("finance business access", () => {
  test("finance can open salesman-like wholesale sections", async ({ page }) => {
    await loginAs(page, "finance");

    for (const workspacePath of [
      "/finance/wholesale/orders",
      "/finance/wholesale/settlement-releases",
      "/finance/wholesale/order-claims",
      "/finance/wholesale/logistics",
      "/finance/wholesale/customers",
      "/finance/wholesale/vip",
      "/finance/wholesale/referrals",
      "/finance/wholesale/commission",
      "/finance/wholesale/incentives",
    ]) {
      await page.goto(workspacePath);
      await expectWorkspaceShell(page);
      await expectNotForbiddenPage(page);
    }
  });

  test("finance only sees wholesale business on desktop and mobile", async ({
    page,
  }) => {
    await loginAs(page, "finance");
    await page.goto("/finance/wholesale/orders");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    const desktopSidebar = page.locator("aside").first();
    await expect(
      desktopSidebar.getByText("旅游业务", { exact: true }),
    ).toHaveCount(0);
    await expect(
      desktopSidebar.getByText("批发业务", { exact: true }),
    ).toBeVisible();
    await expect(
      desktopSidebar.getByRole("link", { name: "公司费用" }),
    ).toBeVisible();
    await expect(
      desktopSidebar.getByRole("link", { name: "批发订单" }),
    ).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/finance/wholesale/orders");

    const mobileHeader = page.locator("header").first();
    await expect(page.getByRole("heading", { name: "批发订单" })).toBeVisible();
    await mobileHeader
      .getByRole("button", { name: "批发业务 / 批发订单" })
      .click();

    const mobileNav = mobileHeader.locator("nav");
    await expect(
      mobileNav.getByText("旅游业务", { exact: true }),
    ).toHaveCount(0);
    await expect(
      mobileNav.getByText("批发业务", { exact: true }),
    ).toBeVisible();
    await expect(
      mobileNav.getByRole("link", { name: "公司费用" }),
    ).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
  });

  test("finance cannot open administrator-only wholesale pages", async ({
    page,
  }) => {
    await loginAs(page, "finance");

    await page.goto("/finance/wholesale/people");

    await expectForbiddenPage(page);
  });

  test("finance can manage claim groups while administrator-only pages stay protected", async ({
    page,
  }) => {
    await loginAs(page, "finance");
    await page.goto("/finance/wholesale/order-claims");

    await expect(
      page.getByRole("button", { name: "上传 1688 文件" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /已认领/ }).click();
    await expect(page.getByText("1688-LOCAL-001").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "调整关联" }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: /认领大厅/ }).click();
    await expect(
      page.getByRole("button", { exact: true, name: "认领" }),
    ).not.toHaveCount(0);
    await page.setViewportSize({ height: 844, width: 390 });
    await expectNoDocumentHorizontalOverflow(page);
  });

  test("finance cannot open tourism business", async ({ page }) => {
    await loginAs(page, "finance");

    await page.goto("/finance/tourism/commission");

    await expect(page).toHaveURL(
      /\/business-unavailable\?business=tourism$/,
    );
    await expect(
      page.getByRole("heading", { name: "旅游业务暂时停止服务" }),
    ).toBeVisible();
  });
});

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflowPixels).toBeLessThanOrEqual(2);
}
