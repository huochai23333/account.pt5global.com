import { expect, test } from "@playwright/test";
import { setTestLocale } from "./helpers/auth";

/** 认证页只验证首次进入与减少动效偏好；原 auth 辅助入口限制仍保留，未执行原用例。 */
test.describe("全系统动效回归", () => {
  test("认证页带有统一首屏动效和动效令牌", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await setTestLocale(page, "zh");
    await page.goto("/login");

    const pageMotion = page.locator('[data-motion-page="true"]');
    await expect(pageMotion).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();

    const pageDuration = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--motion-duration-page")
        .trim(),
    );
    expect(["320ms", ".32s"]).toContain(pageDuration);
  });

  test("减少动态效果时取消明显位移和长动画", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setTestLocale(page, "zh");
    await page.goto("/login");

    await expect(page.locator('[data-motion-page="true"]')).toBeVisible();

    const longRunningAnimations = await page.evaluate(
      () =>
        document.getAnimations().filter((animation) => {
          const duration = Number(animation.effect?.getTiming().duration ?? 0);
          return animation.playState === "running" && duration > 1;
        }).length,
    );

    expect(longRunningAnimations).toBe(0);
  });
});
