import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

test.describe("global review center entrypoint", () => {
  test("administrator review center is a global desktop navigation item", async ({
    page,
  }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/home");

    const sidebar = page.locator("aside").first();
    const navigation = sidebar.locator("nav");
    const reviewLink = sidebar.getByRole("link", {
      name: "审核中心",
      exact: true,
    });
    const wholesaleGroupLabel = sidebar.getByText("批发业务", { exact: true });

    await expect(reviewLink).toHaveAttribute("href", "/admin/reviews");
    await expect(reviewLink).toHaveCount(1);

    // 审核中心属于全局入口，应位于业务板块标题之前。
    const topLevelLabels = await navigation
      .locator(":scope > a, :scope > div > p")
      .allTextContents();
    const labels = topLevelLabels.map((label) => label.trim());
    expect(labels[0]).toBe("首页");
    expect(labels.indexOf("审核中心")).toBeGreaterThan(0);
    expect(labels.indexOf("审核中心")).toBeLessThan(labels.indexOf("批发业务"));

    await expect(wholesaleGroupLabel).toBeVisible();
    await expect(sidebar.getByRole("button", { name: "批发业务", exact: true })).toHaveCount(0);
    await expect(reviewLink).toBeVisible();

    // 页面总宽度不能超过浏览器可视宽度，否则侧栏或新版系统名称会造成横向滚动。
    const desktopHasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(desktopHasHorizontalOverflow).toBe(false);

  });

  test("administrator review center stays global in mobile navigation", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 812, width: 375 });
    await loginAs(page, "administrator");
    await page.goto("/admin/home");

    const mobileHeader = page.locator("header");
    await mobileHeader.getByRole("button", { name: "首页", exact: true }).click();

    const mobileNavigation = mobileHeader.locator("nav");
    const reviewLink = mobileNavigation.getByRole("link", {
      name: "审核中心",
      exact: true,
    });
    const wholesaleGroupLabel = mobileNavigation.getByText("批发业务", {
      exact: true,
    });

    await expect(reviewLink).toHaveAttribute("href", "/admin/reviews");
    await expect(reviewLink).toBeVisible();
    await expect(wholesaleGroupLabel).toBeVisible();

    // 移动菜单按纵向排列，通过位置断言确保审核中心仍位于业务分组标题之前。
    const reviewBox = await reviewLink.boundingBox();
    const wholesaleBox = await wholesaleGroupLabel.boundingBox();
    expect(reviewBox).not.toBeNull();
    expect(wholesaleBox).not.toBeNull();
    expect(reviewBox!.y).toBeLessThan(wholesaleBox!.y);

    await reviewLink.click();
    await expect(page).toHaveURL(/\/admin\/reviews(?:[?#].*)?$/);
    await expect(
      page.getByRole("heading", { name: "审核中心", exact: true }),
    ).toBeVisible();

    // 移动端同样禁止横向溢出，避免标题、按钮或审核列表被压到屏幕之外。
    const mobileHasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(mobileHasHorizontalOverflow).toBe(false);
  });
});
