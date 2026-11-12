import { test, expect } from "./fixtures";
import {
  executeLearningSql,
  loginLearningUser,
} from "../../scripts/learning/local-fixture-session.mjs";
import zh from "../../messages/zh.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };

for (const [language, width] of [
  ["zh", 1440],
  ["en", 390],
] as const) {
  test(`订单草稿的双层弹窗保持键盘焦点：${language}/${width}`, async ({
    page,
    context,
    learningUser,
  }, testInfo) => {
    const messages = language === "zh" ? zh : en;
    const confirm = messages.DashboardFramework.confirm;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.addCookies([
      { name: "bs-locale", value: "zh", url: "http://localhost:3000" },
    ]);
    await loginLearningUser(page, learningUser);
    await context.addCookies([
      { name: "bs-locale", value: language, url: "http://localhost:3000" },
    ]);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/admin/wholesale/orders");

    const start = page.getByRole("button", {
      name: messages.UiText.components_dashboard_wholesale_wholesale_orders_section.text001.trim(),
      exact: true,
    });
    await start.click();
    const draft = page
      .getByRole("dialog")
      .filter({ has: page.locator('textarea[name="notes"]') });
    const notes = draft.locator('textarea[name="notes"]');
    const marker = `Learning draft ${learningUser.runId}`;
    await notes.fill(marker);
    await page.keyboard.press("Escape");

    const top = page
      .getByRole("dialog")
      .filter({
        has: page.getByRole("button", { name: confirm.accept, exact: true }),
      });
    const close = top.getByRole("button", {
      name: messages.UiText.shared.closeDialog,
      exact: true,
    });
    const cancel = top.getByRole("button", {
      name: confirm.cancel,
      exact: true,
    });
    const accept = top.getByRole("button", {
      name: confirm.accept,
      exact: true,
    });
    // 从第一项按 Tab 可以逐个访问确认框按钮，底层表单不应抢回焦点。
    await expect(close).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(accept).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(accept).toBeFocused();
    await page.screenshot({
      path: testInfo.outputPath(`order-draft-${language}-${width}.png`),
    });

    await page.keyboard.press("Escape");
    await expect(top).toHaveCount(0);
    await expect(notes).toBeFocused();
    await expect(notes).toHaveValue(marker);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(
      "hidden",
    );

    await page.keyboard.press("Escape");
    await accept.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(start).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
      "hidden",
    );
    await page.reload();
    await expect(start).toBeVisible();
    expect(
      executeLearningSql(
        `select count(*) from public.wholesale_orders where notes='${marker}';`,
      ),
    ).toBe("0");
    expect(errors).toEqual([]);
  });
}
