import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { expectVisibleControlsMeetHeight, expectNoHorizontalOverflow } from "./helpers/design-system-governance";

// 这里只检查控件高度、分页与 VIP 断点；表单和待办另有同层入口。
test.describe("设计系统治理守卫", () => {
  test("移动与桌面控件遵守共享高度令牌", async ({ page }) => {
    await loginAs(page, "administrator");
    await page.setViewportSize({ height: 900, width: 390 });
    await page.goto("/admin/company-expenses");
    await expect(page.getByRole("heading", { name: "筛选内容" })).toHaveCount(0);
    const mobileFilterSearch = page
      .locator(
        '[data-slot="dashboard-search-input"] [data-slot="input"]',
      )
      .first();
    await expect(mobileFilterSearch).toHaveCSS("height", "44px");
    const mobileFilterSection = mobileFilterSearch.locator(
      "xpath=ancestor::section[1]",
    );
    expect(
      (await mobileFilterSection.boundingBox())?.height ??
        Number.POSITIVE_INFINITY,
    ).toBeLessThanOrEqual(220);
    await page.getByRole("button", { name: "新增费用" }).click();
    const dialog = page.getByRole("dialog", { name: "新增费用" });
    await expectVisibleControlsMeetHeight(
      dialog.locator(
        '[data-slot="button"], [data-slot="input"]:not([type="checkbox"]):not([type="radio"]), [data-slot="select"]',
      ),
      44,
    );
    await page.keyboard.press("Escape");
    await page.setViewportSize({ height: 900, width: 1440 });
    // 当前仅开放批发业务，桌面筛选高度必须从真实可用的订单入口验证。
    await page.goto("/admin/wholesale/orders");
    await expect(page.getByRole("heading", { name: "筛选订单" })).toHaveCount(0);
    const desktopFilterControls = page.locator(
      '[data-slot="dashboard-search-input"] [data-slot="input"]:visible, [data-density="filter"] :is([data-slot="input"], [data-slot="select"]):visible',
    );
    await expect(desktopFilterControls.first()).toBeVisible();
    const desktopFilterHeights = await desktopFilterControls.evaluateAll(
      (elements) =>
        elements.map((element) =>
          Number.parseFloat(window.getComputedStyle(element).height),
        ),
    );
    expect(new Set(desktopFilterHeights)).toEqual(new Set([40]));
    const desktopFilterSection = desktopFilterControls
      .first()
      .locator("xpath=ancestor::section[1]");
    expect(
      (await desktopFilterSection.boundingBox())?.height ??
        Number.POSITIVE_INFINITY,
    ).toBeLessThanOrEqual(380);
    // 紧凑控件在桌面端统一为 40px；普通输入仍由 default 令牌保持 48px。
    const compactControls = page.locator(
      '[data-slot="button"][data-size="compact"]:visible, [data-slot="button"][data-size="icon-compact"]:visible, [data-control-size="compact"]:visible',
    );
    await expect(compactControls.first()).toBeVisible();
    await expectVisibleControlsMeetHeight(compactControls, 40);
  });

  test("分页在三个验收宽度不挤压且只渲染一次", async ({ page }) => {
    await loginAs(page, "administrator");

    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ height: 900, width });
      // 本地销售线索种子稳定超过一页，可从现行业务入口验证真正渲染出的页码按钮。
      await page.goto("/admin/wholesale/leads");

      const previous = page.getByRole("button", { name: "上一页" });
      const next = page.getByRole("button", { name: "下一页" });
      await expect(previous).toHaveCount(1);
      await expect(next).toHaveCount(1);
      await expect(previous).toBeVisible();
      await expect(next).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const minimumHeight = width === 390 ? 44 : 40;
      expect(
        (await previous.boundingBox())?.height ?? 0,
      ).toBeGreaterThanOrEqual(minimumHeight);
      expect((await next.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
        minimumHeight,
      );
    }
  });

  test("VIP 宽表只在 lg 断点切换", async ({ page }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/vip");

    const responsiveView = page
      .locator('[data-slot="responsive-data-view"][data-breakpoint="lg"]')
      .first();
    const desktop = responsiveView.locator(":scope > div").nth(0);
    const mobile = responsiveView.locator(":scope > div").nth(1);

    for (const width of [390, 768]) {
      await page.setViewportSize({ height: 900, width });
      await expect(desktop).toBeHidden();
      await expect(mobile).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    await page.setViewportSize({ height: 900, width: 1440 });
    await expect(desktop).toBeVisible();
    await expect(mobile).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });
});
