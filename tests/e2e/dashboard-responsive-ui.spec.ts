import { expect, test, type Locator, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";
import { chooseSelectOption } from "./helpers/select-control";

test.describe("工作台分阶段视觉升级", () => {
  test("首页按 1280px 分界自动排列并保留桌面编辑", async ({ page }) => {
    await loginAs(page, "administrator");

    for (const width of [390, 768, 1279]) {
      await page.setViewportSize({ height: 900, width });
      await page.goto("/admin/home");

      await expect(page.getByTestId("home-edit-button")).toBeHidden();
      await expect(page.getByTestId("home-manage-button")).toBeVisible();
      await expect(page.getByTestId("home-todo-title-input")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectAutomaticHomeLayout(page, width);
      await expectNoClippedHomeWidgets(page);

      const inviteCode = page.getByTestId("home-invite-code").first();
      if (await inviteCode.isVisible().catch(() => false)) {
        const lineCount = await inviteCode.evaluate((element) => {
          const lineHeight = Number.parseFloat(
            window.getComputedStyle(element).lineHeight,
          );
          return element.getBoundingClientRect().height / lineHeight;
        });
        expect(lineCount).toBeLessThan(1.6);
      }
    }

    for (const width of [1280, 1440]) {
      await page.setViewportSize({ height: 900, width });
      await page.goto("/admin/home");
      await expect(page.getByTestId("home-edit-button")).toBeVisible();
      await expect(page.getByTestId("home-widget-grid")).toHaveCSS(
        "grid-template-columns",
        /.+ .+ .+ .+ .+/,
      );
      await expectNoHorizontalOverflow(page);
      await expectNoClippedHomeWidgets(page);
    }

    // 编辑状态本身不修改布局；从桌面缩到自动布局时不能产生云端保存请求。
    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto("/admin/home");
    await page.getByTestId("home-edit-button").click();
    await expect(page.getByTestId("home-edit-done-button")).toBeVisible();
    const layoutWrites: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() !== "GET" &&
        /(?:save_user_home_widget_layout|user_home_widget_layouts)/.test(
          request.url(),
        )
      ) {
        layoutWrites.push(request.url());
      }
    });
    await page.setViewportSize({ height: 900, width: 1279 });
    await expect(page.getByTestId("home-edit-button")).toBeHidden();
    await expect(page.getByTestId("home-manage-button")).toBeVisible();
    await expect(page.getByTestId("home-widget-placement-boundary")).toHaveCSS(
      "opacity",
      "0",
    );
    await page.waitForTimeout(400);
    expect(layoutWrites).toEqual([]);
  });

  test("移动顶栏入口满足触控尺寸且账号锚点有效", async ({ page }) => {
    await loginAs(page, "administrator");
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/admin/home");

    for (const name of ["切换语言", "查看公告", "提交反馈", "打开账号菜单"]) {
      await expectTouchTarget(page.getByRole("button", { name }), 44);
    }

    await page.getByRole("button", { name: "切换语言" }).click();
    await page.waitForTimeout(250);
    await expectTouchTarget(page.getByRole("menuitemradio", { name: "中文" }), 44);
    await expectTouchTarget(page.getByRole("menuitemradio", { name: "EN" }), 44);

    const accountTrigger = page.getByTestId("workspace-account-menu-trigger");
    await accountTrigger.click();
    const accountMenu = page.getByTestId("workspace-account-menu");
    const accountCenter = page.getByRole("link", { name: "账号中心" });
    const accountVerification = page.getByRole("link", { name: "账号与认证" });
    await expect(accountMenu).toBeVisible();
    await expectTouchTarget(accountCenter, 44);
    await expectTouchTarget(accountVerification, 44);
    await expect(accountCenter).toHaveAttribute(
      "href",
      "/admin/my#account-center",
    );
    await expect(accountVerification).toHaveAttribute(
      "href",
      "/admin/my#account-verification",
    );
    const accountMenuBounds = await accountMenu.boundingBox();
    expect(accountMenuBounds).not.toBeNull();
    expect(Math.round(accountMenuBounds?.x ?? -1)).toBeGreaterThanOrEqual(0);
    expect(
      Math.round((accountMenuBounds?.x ?? 0) + (accountMenuBounds?.width ?? 0)),
    ).toBeLessThanOrEqual(390);
    await expectNoHorizontalOverflow(page);

    const avatarContrast = await accountTrigger.locator("span").first().evaluate(
      (element) => {
        const style = window.getComputedStyle(element);
        return contrastRatio(style.color, style.backgroundColor);

        function contrastRatio(foreground: string, background: string) {
          const foregroundLuminance = luminance(foreground);
          const backgroundLuminance = luminance(background);
          const lighter = Math.max(foregroundLuminance, backgroundLuminance);
          const darker = Math.min(foregroundLuminance, backgroundLuminance);
          return (lighter + 0.05) / (darker + 0.05);
        }

        function luminance(color: string) {
          const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
          const values = channels.map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.03928
              ? normalized / 12.92
              : ((normalized + 0.055) / 1.055) ** 2.4;
          });
          return (values[0] ?? 0) * 0.2126 +
            (values[1] ?? 0) * 0.7152 +
            (values[2] ?? 0) * 0.0722;
        }
      },
    );
    expect(avatarContrast).toBeGreaterThanOrEqual(4.5);

    await accountCenter.click();
    await expect(page).toHaveURL(/\/admin\/my#account-center$/);
    await expect(page.locator("#account-center")).toBeVisible();
  });

  for (const role of ["administrator", "salesman", "operator", "finance", "client"] as const) {
    test(`${role} 超窄屏顶栏和手机导航保持清晰`, async ({ page }) => {
      await loginAs(page, role);
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      for (const width of [320, 360, 390]) {
        await page.setViewportSize({ height: 900, width });
        await page.goto(role === "administrator" ? "/admin/home" : `/${role}/home`);
        await expect(page.getByTestId("home-widget-card").first()).toBeVisible();

        const label = page.locator("header p.font-label");
        // 320px 装不下辅助岗位标签和四个操作入口，系统标题仍在第二行完整显示。
        if (width === 320) await expect(label).toBeHidden();
        else await expect(label).toBeVisible();

        const layout = await page.evaluate(() => {
          const labelElement = document.querySelector("header p.font-label");
          const labelBox = labelElement?.getClientRects()[0] ?? null;
          const languageBox = document.querySelector('header button[aria-label="切换语言"]')?.getBoundingClientRect();
          return {
            labelRight: labelBox?.right ?? null,
            languageLeft: languageBox?.left ?? null,
            languageRight: languageBox?.right ?? null,
            overflow: document.documentElement.scrollWidth - window.innerWidth,
          };
        });
        expect(layout.overflow).toBeLessThanOrEqual(2);
        expect(layout.languageRight).not.toBeNull();
        expect(layout.languageRight!).toBeLessThanOrEqual(width);
        if (layout.labelRight !== null) {
          expect(layout.labelRight).toBeLessThanOrEqual(layout.languageLeft!);
        }

        if (width === 320) {
          await page.getByRole("button", { name: "切换语言" }).click();
          const languageMenu = page.getByRole("menu");
          await expect(languageMenu.getByRole("menuitemradio", { name: "中文" })).toBeVisible();
          const languageAlpha = await languageMenu.evaluate((element) => {
            const channels = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [];
            return channels.length === 4 ? channels[3] : 1;
          });
          expect(languageAlpha).toBe(1);
          await page.keyboard.press("Escape");
          await expect(languageMenu).toHaveCount(0);
        }

        const navButton = page.locator("header").getByRole("button", { exact: true, name: "首页" });
        await navButton.click();
        const nav = page.locator('header nav[aria-hidden="false"]');
        await expect(nav).toBeVisible();
        await expect(nav.getByRole("link", { exact: true, name: "首页" })).toBeVisible();
        const menu = await nav.evaluate((element) => {
          const color = getComputedStyle(element).backgroundColor;
          const channels = color.match(/[\d.]+/g)?.map(Number) ?? [];
          const box = element.getBoundingClientRect();
          return { alpha: channels.length === 4 ? channels[3] : 1, left: box.left, right: box.right };
        });
        // 浮层必须不透底，否则页面上的文字会穿过菜单，与入口文案叠在一起。
        expect(menu.alpha).toBe(1);
        expect(menu.left).toBeGreaterThanOrEqual(0);
        expect(menu.right).toBeLessThanOrEqual(width);
        await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(0);
      }

      await page.reload();
      await expect(page.getByTestId("home-widget-card").first()).toBeVisible();
      await page.locator("header").getByRole("button", { exact: true, name: "首页" }).click();
      await expect(page.locator('header nav[aria-hidden="false"]')).toBeVisible();
      expect(pageErrors).toEqual([]);
    });
  }

  test("公司费用首屏、移动筛选和弹窗底部操作区符合共享规则", async ({
    page,
  }) => {
    await loginAs(page, "finance");
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/finance/company-expenses");

    const search = page.getByPlaceholder("搜索费用名称、收款方或备注");
    const category = page.getByLabel("费用分类");
    await expect(search).toBeVisible();
    await expect(category).toBeHidden();
    // 页面名已经说明当前业务，列表不再重复显示“费用记录”标题；首条业务卡应直接进入首屏。
    await expect(page.locator("article").first()).toBeInViewport();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: /更多筛选条件/ }).click();
    await expect(category).toBeVisible();
    await chooseSelectOption(category, { value: "office" });
    await expect(page.getByText("已启用 1 个筛选条件")).toBeVisible();
    await page.getByRole("button", { name: "恢复默认筛选" }).click();
    await expect(page.getByText("已启用 1 个筛选条件")).toHaveCount(0);

    const createButton = page.getByRole("button", { name: "新增费用" });
    await createButton.click();
    const dialog = page.getByRole("dialog", { name: "新增费用" });
    const footer = dialog.getByTestId("dashboard-dialog-actions");
    await expect(footer).toBeVisible();
    await page.waitForTimeout(250);
    const initialFooterBox = await requiredBox(footer);
    const dialogBox = await requiredBox(dialog);
    expect(initialFooterBox.y + initialFooterBox.height).toBeLessThanOrEqual(
      dialogBox.y + dialogBox.height + 1,
    );
    await footer.evaluate((element) => {
      element.previousElementSibling?.scrollTo({ top: 10_000 });
    });
    const scrolledFooterBox = await requiredBox(footer);
    expect(Math.abs(scrolledFooterBox.y - initialFooterBox.y)).toBeLessThan(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(createButton).toBeFocused();

    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/finance/company-expenses");
    const firstRecord = page.locator("article").first();
    await expect(firstRecord).toBeInViewport();
    await expect(category).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

async function expectAutomaticHomeLayout(page: Page, width: number) {
  const cards = page.locator('[data-testid="home-widget-card"]');
  const boxes = await cards.evaluateAll((elements) =>
    elements.map((element) => ({
      height: element.getBoundingClientRect().height,
      type: element.getAttribute("data-home-widget-type"),
      width: element.getBoundingClientRect().width,
      x: element.getBoundingClientRect().x,
      y: element.getBoundingClientRect().y,
    })),
  );
  const byType = new Map(boxes.map((box) => [box.type, box]));
  const orderedTypes = ["greeting", "todos", "announcements", "invite", "clock"];

  for (let index = 1; index < orderedTypes.length; index += 1) {
    const previous = byType.get(orderedTypes[index - 1]);
    const current = byType.get(orderedTypes[index]);
    expect(previous).toBeTruthy();
    expect(current).toBeTruthy();
    expect(current!.y).toBeGreaterThanOrEqual(previous!.y);
  }

  if (width === 390) {
    const xPositions = orderedTypes.map((type) => Math.round(byType.get(type)!.x));
    expect(new Set(xPositions).size).toBe(1);
  } else {
    expect(byType.get("greeting")!.width).toBeGreaterThan(
      byType.get("invite")!.width * 1.8,
    );
    expect(Math.abs(byType.get("invite")!.y - byType.get("clock")!.y)).toBeLessThan(2);
  }
}

async function expectTouchTarget(locator: Locator, minimum: number) {
  await expect(locator).toBeVisible();
  const box = await requiredBox(locator);
  expect(box.height).toBeGreaterThanOrEqual(minimum);
  expect(box.width).toBeGreaterThanOrEqual(minimum);
}

async function expectNoClippedHomeWidgets(page: Page) {
  const clippedWidgets = await page
    .locator('[data-testid="home-widget-card"]')
    .evaluateAll((elements) =>
      elements
        .map((element) => ({
          overflow: element.scrollHeight - element.clientHeight,
          type: element.getAttribute("data-home-widget-type"),
        }))
        .filter((item) => item.overflow > 2),
    );

  expect(clippedWidgets).toEqual([]);
}

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}
