import { expect, test } from "@playwright/test";

import { loginAs, setTestLocale } from "./helpers/auth";
import {
  capture,
  disableControlTransitions,
  expectAuthControlsMeetTouchHeight,
  expectAuthFieldAssociation,
  expectAuthLayout,
  expectAnchoredPopupInsideViewport,
  expectDocumentInsideViewport,
  expectSemanticContrast,
  expectSemanticControlStyle,
  expectSoftFilterControlHierarchy,
  isAuthRoute,
  readControlStyle,
  readFocusStyle,
  routeToName,
  signOut,
  stabilizeVisualPage,
} from "./helpers/design-system-visual";
import { openDateControl } from "./helpers/date-control";

const viewports = [
  { height: 900, name: "desktop", width: 1440 },
  { height: 844, name: "mobile", width: 390 },
] as const;

for (const viewport of viewports) {
  test.describe(`design system visual baseline - ${viewport.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ height: viewport.height, width: viewport.width });
      await setTestLocale(page, "zh");
      await stabilizeVisualPage(page);
    });

    test("public and authentication pages", async ({ page }) => {
      const authImageRequests: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("zhang-kaiyv-Xqf2ph7vrgc-unsplash")) {
          authImageRequests.push(request.url());
        }
      });

      for (const route of [
        "/login",
        "/register",
        "/forgot-password",
        "/privacy",
        "/missing-visual-page",
      ] as const) {
        await page.goto(route);
        await expect(page.locator("main")).toBeVisible();
        await expectDocumentInsideViewport(page);
        if (isAuthRoute(route)) {
          await expect(page.locator(".auth-card-surface")).toHaveCount(1);
          await expect(page.locator(".auth-form-surface")).toHaveCount(1);
          await expect(
            page.locator(
              '[data-auth-region="information"] img[alt=""][src*="zhang-kaiyv"]',
            ),
          ).toHaveCount(1);
          await expectAuthLayout(page, viewport.name);
          await expectAuthFieldAssociation(page);
          if (viewport.name === "mobile") {
            await expectAuthControlsMeetTouchHeight(page);
          }
        } else {
          await expect(
            page.locator(
              ".auth-card-surface, .auth-grid-dots, .auth-aside-overlay, .auth-aside-glow, .auth-form-surface",
            ),
          ).toHaveCount(0);
        }
        await capture(page, `${viewport.name}-${routeToName(route)}.png`);
      }

      expect(authImageRequests.length).toBeGreaterThan(0);

      await loginAs(page, "client");
      await page.goto("/admin/home");
      await expect(
        page.getByRole("heading", { name: "这个页面不在你的工作范围内" }),
      ).toBeVisible();
      await capture(page, `${viewport.name}-access-limited.png`);
    });

    test("authentication large controls still use shared primitives", async ({
      page,
    }) => {
      await page.goto("/login");
      await disableControlTransitions(page);
      await expectSemanticContrast(page);
      const authInput = page.locator('[data-slot="input"]').first();
      const authPrimaryButton = page.locator(
        '[data-slot="button"][data-variant="primary"][type="submit"]',
      );
      const authInputStyle = await readControlStyle(authInput);
      const authButtonStyle = await readControlStyle(authPrimaryButton);
      await expect(authInput).toHaveAttribute("data-control-size", "large");
      await expect(authPrimaryButton).toHaveAttribute("data-size", "large");
      expect(authInputStyle.height).toBe("52px");
      expect(authButtonStyle.height).toBe("52px");
      await authInput.focus();
      const authInputFocusStyle = await readFocusStyle(authInput);

      await loginAs(page, "administrator");
      await page.goto("/admin/company-expenses");
      await disableControlTransitions(page);
      await page.getByRole("button", { name: "新增费用" }).click();
      const dialog = page.getByRole("dialog", { name: "新增费用" });
      const workspaceInput = dialog.locator('[data-slot="input"]').first();
      const workspacePrimaryButton = dialog.locator(
        '[data-slot="button"][data-variant="primary"]',
      );

      await expect(workspaceInput).toBeVisible();
      await expect(workspacePrimaryButton).toBeVisible();
      await expect(workspaceInput).toHaveAttribute(
        "data-control-size",
        "default",
      );
      await expect(workspacePrimaryButton).toHaveAttribute(
        "data-size",
        "default",
      );
      expectSemanticControlStyle(await readControlStyle(workspaceInput), authInputStyle);
      expectSemanticControlStyle(
        await readControlStyle(workspacePrimaryButton),
        authButtonStyle,
      );

      await workspaceInput.focus();
      expect(await readFocusStyle(workspaceInput)).toEqual(authInputFocusStyle);
    });

    test("representative workspaces and standard form dialog", async ({ page }) => {
      // 该用例连续覆盖多角色、多页面和日期浮层，强制重建基线时截图写盘会更慢。
      test.setTimeout(90_000);
      await loginAs(page, "administrator");

      const adminRoutes = [
        ["/admin/home", "admin-home"],
        ["/admin/accounts", "admin-accounts"],
        ["/admin/company-expenses", "company-expenses"],
        ["/admin/wholesale/orders", "wholesale-orders"],
        ["/admin/wholesale/commission", "wholesale-commission"],
      ] as const;

      for (const [route, name] of adminRoutes) {
        await page.goto(route);
        await expect(page.locator("main")).toBeVisible();
        if (route === "/admin/wholesale/orders") {
          // 页面外壳会先于订单查询完成显示；截图必须等真实列表进入当前响应式视图，
          // 否则完整套件较慢时可能把加载中的空白区域误当成视觉回归。
          const visibleOrderItem =
            viewport.name === "mobile"
              ? page.locator('[data-testid^="wholesale-order-card-"]').first()
              : page.locator('[data-testid^="wholesale-order-row-"]').first();
          await expect(visibleOrderItem).toBeVisible();
          await expectSoftFilterControlHierarchy(page);
        }
        await capture(page, `${viewport.name}-${name}.png`);
      }

      await page.goto("/admin/company-expenses");
      if (viewport.name === "mobile") {
        // 折叠态本身是移动资源页的默认构图，单独留一张基线防止筛选重新占满首屏。
        await capture(
          page,
          "mobile-company-expenses-filter-collapsed.png",
        );
        await page.getByRole("button", { name: /更多筛选条件/ }).click();
      }
      const categoryFilter = page.getByLabel("费用分类");
      if (viewport.name === "mobile") {
        // 移动端筛选项位于首屏下沿，明确居中后再截图，避免 Playwright 自动滚动量随数据高度变化。
        await categoryFilter.evaluate((element) =>
          element.scrollIntoView({ behavior: "auto", block: "center" }),
        );
      } else {
        // 桌面端完整筛选面板位于首屏，固定在页面顶部后再打开菜单。
        // 如果沿用上一个页面的滚动位置，浏览器可能在点击时自行滚动，造成同一菜单出现两种构图。
        await page.evaluate(() => window.scrollTo({ behavior: "auto", top: 0 }));
      }
      await categoryFilter.click();
      await expect(page.getByRole("option").first()).toBeVisible();
      if (viewport.name === "mobile") {
        // 菜单打开后会把焦点移到当前选项，浏览器可能再次滚动页面。
        // 重新把触发器放回视口中部，使浮层始终贴着输入框，而不是偶尔停在页面顶端。
        await categoryFilter.evaluate((element) =>
          element.scrollIntoView({ behavior: "auto", block: "center" }),
        );
        await expect
          .poll(async () => (await categoryFilter.boundingBox())?.y ?? -1)
          .toBeGreaterThan(300);
      } else {
        // Base UI 会把焦点移入选中项；浏览器可能因此再次滚动页面。
        // 菜单完成打开后重新固定首屏，并等待滚动值生效，再记录稳定的桌面构图。
        await page.evaluate(() => window.scrollTo({ behavior: "auto", top: 0 }));
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      }
      await capture(
        page,
        `${viewport.name}-company-expenses-filter-menu.png`,
      );
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: "新增费用" }).click();
      const expenseDialog = page.getByRole("dialog", { name: "新增费用" });
      await expect(expenseDialog).toBeVisible();
      await capture(page, `${viewport.name}-standard-form-dialog.png`);
      if (viewport.name === "mobile") {
        const footer = expenseDialog.getByTestId("dashboard-dialog-actions");
        await footer.evaluate((element) => {
          element.previousElementSibling?.scrollTo({ top: 10_000 });
        });
        await capture(page, "mobile-long-form-dialog-footer.png");
      }
      await expenseDialog.getByLabel("费用分类").click();
      await expect(page.getByRole("option").first()).toBeVisible();
      await capture(page, `${viewport.name}-standard-form-menu.png`);
      await page.keyboard.press("Escape");

      const expenseDate = expenseDialog.getByLabel("付款日期");
      await openDateControl(expenseDate, /打开日期选择/);
      await expectAnchoredPopupInsideViewport(page);
      await capture(page, `${viewport.name}-date-picker.png`);
      await page.keyboard.press("Escape");

      const expenseMonth = expenseDialog.getByLabel("所属月份");
      await openDateControl(expenseMonth, /打开月份选择/);
      await expectAnchoredPopupInsideViewport(page);
      await capture(page, `${viewport.name}-month-picker.png`);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");

      await signOut(page);
      await loginAs(page, "operator");
      await page.goto("/operator/reimbursements");
      await capture(page, `${viewport.name}-operator-reimbursements.png`);

      await signOut(page);
      await loginAs(page, "client");
      await page.goto("/client/home");
      await capture(page, `${viewport.name}-client-home.png`);
    });
  });
}

test("tablet breakpoint keeps representative pages inside the viewport", async ({
  page,
}) => {
  // 768px 正好是数据列表从移动卡片切换到桌面表格的 md 断点，单独检查它可以发现
  // 两套视图交界处的按钮挤压或页面横向溢出，同时无需为中间宽度再维护一整套截图。
  await page.setViewportSize({ height: 900, width: 768 });
  await setTestLocale(page, "zh");
  await stabilizeVisualPage(page);

  for (const route of [
    "/login",
    "/register",
    "/forgot-password",
    "/privacy",
    "/missing-visual-page",
  ] as const) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expectDocumentInsideViewport(page);
    if (isAuthRoute(route)) {
      await expectAuthLayout(page, "mobile");
    }
  }

  await loginAs(page, "administrator");

  for (const route of [
    "/admin/accounts",
    "/admin/company-expenses",
    "/admin/wholesale/orders",
    "/admin/wholesale/commission",
  ] as const) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expectDocumentInsideViewport(page);
  }

  await page.goto("/admin/company-expenses");
  await page.getByRole("button", { name: "新增费用" }).click();
  const expenseDialog = page.getByRole("dialog", { name: "新增费用" });
  await openDateControl(expenseDialog.getByLabel("付款日期"), /打开日期选择/);
  await expectAnchoredPopupInsideViewport(page);
  await page.keyboard.press("Escape");
  await openDateControl(expenseDialog.getByLabel("所属月份"), /打开月份选择/);
  await expectAnchoredPopupInsideViewport(page);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
});

test("首页在自动布局与桌面布局分界处保持稳定构图", async ({ page }) => {
  await setTestLocale(page, "zh");
  await stabilizeVisualPage(page);
  await loginAs(page, "administrator");

  for (const viewport of [
    { height: 900, name: "tablet-admin-home", width: 768 },
    { height: 900, name: "desktop-threshold-admin-home", width: 1280 },
  ] as const) {
    await page.setViewportSize({ height: viewport.height, width: viewport.width });
    await page.goto("/admin/home");
    await expectDocumentInsideViewport(page);
    await capture(page, `${viewport.name}.png`);
  }
});
