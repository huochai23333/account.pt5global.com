import { test, expect } from "./fixtures";
import { writeFile } from "node:fs/promises";
import {
  executeLearningSql,
  loginLearningUser,
} from "../../scripts/learning/local-fixture-session.mjs";

type StoredLayout = {
  user_id: string;
  scope: string;
  widgets: Array<{ type: string; width: number; x: number }>;
  updated_at: string;
};

for (const language of ["zh", "en"] as const) {
  test(`专属首页布局：${language} 拖动、缩放、读回及刷新`, async ({
    page,
    context,
    learningUser,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type()))
        errors.push(message.text());
    });
    await context.addCookies([
      { name: "bs-locale", value: "zh", url: "http://localhost:3000" },
    ]);
    await loginLearningUser(page, learningUser);
    await context.addCookies([
      { name: "bs-locale", value: language, url: "http://localhost:3000" },
    ]);
    await page.reload();

    // 通过独立数据库连接读取自己的记录；不把页面回调或 Toast 当成已保存。
    const readLayout = (): StoredLayout[] =>
      JSON.parse(
        executeLearningSql(`select coalesce(json_agg(t),'[]') from (
          select user_id,scope,widgets,updated_at from public.user_home_widget_layouts
          where user_id='${learningUser.id}') t;`),
      );
    const card = page.locator(
      '[data-testid="home-widget-card"][data-home-widget-type="todos"]',
    );
    await page.getByTestId("home-edit-button").click();
    await expect(card).toHaveAttribute("data-home-widget-width", "3");
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    const stride = await page.getByTestId("home-widget-grid").evaluate((el) => {
      const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
      return (el.getBoundingClientRect().width - gap * 4) / 5 + gap;
    });
    await page.mouse.move(box!.x + box!.width - 12, box!.y + box!.height / 2);
    const handle = card.getByTestId("home-widget-resize-handle-active");
    await expect(handle).toHaveAttribute("data-resize-direction", "right");
    const handleBox = await handle.boundingBox();
    expect(handleBox).not.toBeNull();
    const startX = handleBox!.x + handleBox!.width / 2;
    const startY = handleBox!.y + handleBox!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + stride, startY, { steps: 8 });
    await expect(page.getByTestId("home-widget-resize-preview")).toContainText(
      "4 × 3",
    );
    await expect(card).toHaveAttribute("data-home-widget-width", "3");
    await page.mouse.up();
    await expect(card).toHaveAttribute("data-home-widget-width", "4");
    await expect
      .poll(
        () => readLayout()[0]?.widgets.find((w) => w.type === "todos")?.width,
        { timeout: 20_000 },
      )
      .toBe(4);
    const resized = readLayout()[0];
    await page.reload();
    await expect(card).toHaveAttribute("data-home-widget-width", "4");
    await page.getByTestId("home-edit-button").click();

    // 编辑标题持续摆动，滚动时必须用静止外框；拖动仍从真实标题和鼠标发起。
    await card.scrollIntoViewIfNeeded();
    const label = await card
      .getByTestId("home-widget-editor-label")
      .boundingBox();
    expect(label).not.toBeNull();
    const dragX = label!.x + label!.width / 2;
    const dragY = label!.y + label!.height / 2;
    await page.mouse.move(dragX, dragY);
    await page.mouse.down();
    await page.mouse.move(dragX + stride, dragY, { steps: 8 });
    await page.mouse.up();
    await expect
      .poll(() => readLayout()[0]?.widgets.find((w) => w.type === "todos")?.x, {
        timeout: 20_000,
      })
      .toBe(1);
    const moved = readLayout()[0];
    expect(readLayout()).toHaveLength(1);
    await page.reload();
    await expect(card).toHaveCSS("grid-column-start", "2");
    await expect(card).toHaveAttribute("data-home-widget-width", "4");
    await expect(page.getByTestId("home-clock-time")).toHaveText(
      /^\d{1,2}:\d{2}$/,
    );
    await expect(
      page.locator("nextjs-portal [data-nextjs-dialog]"),
    ).toHaveCount(0);

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(card).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`home-${language}-${width}.png`),
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
    const receipt = testInfo.outputPath("layout-business-receipts.json");
    await writeFile(
      receipt,
      JSON.stringify({ resized, moved, reloadConsistent: true }, null, 2),
    );
    await testInfo.attach("layout-business-receipts", {
      path: receipt,
      contentType: "application/json",
    });
  });
}
