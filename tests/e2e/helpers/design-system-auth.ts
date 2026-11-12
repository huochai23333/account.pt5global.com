import { expect, type Page } from "@playwright/test";

// 认证页的布局、可操作性与退出会话。切换语言菜单后恢复关闭态，避免污染后续截图。
export async function signOut(page: Page) {
  await page.goto("/auth/sign-out?next=%2Flogin");
  await page.getByRole("button", { name: /退出登录|Sign out/ }).click();
  await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);
}

export async function expectAuthLayout(
  page: Page,
  viewportName: "desktop" | "mobile",
) {
  // 认证页连续导航时要等待语言组件完成 hydration。移动端使用单一当前语言入口，
  // 验证菜单选项后立即关闭，避免视觉基线截到浮层展开状态。
  const languageTrigger = page.getByRole("button", { name: "切换语言" });
  const usesCompactLanguageMenu = await languageTrigger
    .isVisible()
    .catch(() => false);

  if (usesCompactLanguageMenu) {
    await languageTrigger.click();
    await expect(
      page.getByRole("menuitemradio", { exact: true, name: "中文" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitemradio", { exact: true, name: "EN" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitemradio")).toHaveCount(0);
    await languageTrigger.evaluate((element) => {
      if (element instanceof HTMLElement) element.blur();
      window.scrollTo({ behavior: "auto", top: 0 });
    });
  } else {
    await expect(
      page.getByRole("button", { exact: true, name: "中文" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { exact: true, name: "EN" }),
    ).toBeVisible();
  }

  const information = page.locator('[data-auth-region="information"]');
  const supplementalNote = page.locator(
    '[data-auth-region="supplemental-note"]',
  );
  const formBox = await page.locator('[data-auth-region="form"]').boundingBox();

  expect(formBox).not.toBeNull();
  if (!formBox) return;

  if (viewportName === "mobile") {
    await expect(information).toBeHidden();
    await expect(supplementalNote).toBeVisible();
    const noteBox = await supplementalNote.boundingBox();
    expect(noteBox).not.toBeNull();
    if (noteBox) expect(formBox.y).toBeLessThan(noteBox.y);
  } else {
    await expect(information).toBeVisible();
    await expect(supplementalNote).toBeHidden();
    const informationBox = await information.boundingBox();
    expect(informationBox).not.toBeNull();
    if (informationBox) expect(informationBox.x).toBeLessThan(formBox.x);
  }
}

export async function expectAuthFieldAssociation(page: Page) {
  const input = page.locator('[data-slot="input"]').first();
  await expect(input).toBeVisible();
  const inputId = await input.getAttribute("id");
  expect(inputId).toBeTruthy();
  await expect(page.locator(`label[for="${inputId}"]`)).toBeVisible();
}

export async function expectAuthControlsMeetTouchHeight(page: Page) {
  const heights = await page
    .locator('[data-slot="button"], [data-slot="input"], [data-slot="select"]')
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const style = window.getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            box.height > 0 &&
            box.width > 0
          );
        })
        .map((element) => element.getBoundingClientRect().height),
    );

  expect(heights.length).toBeGreaterThan(0);
  // Chromium 在部分缩放比例下会把 44px 报成 43.99998px，四舍五入后才是实际 CSS 尺寸。
  expect(Math.round(Math.min(...heights))).toBeGreaterThanOrEqual(44);
}

export function isAuthRoute(route: string) {
  return ["/login", "/register", "/forgot-password"].includes(route);
}
