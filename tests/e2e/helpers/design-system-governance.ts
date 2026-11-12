import { expect, type Locator, type Page } from "@playwright/test";

// 几何、字段关联和焦点共用断言；只观察页面，不保存业务数据。
export async function expectVisibleControlsMeetHeight(
  controls: Locator,
  minimumHeight: number,
) {
  const heights = await controls.evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          box.height > 0
        );
      })
      // 入场动画可能短暂缩放几何框；设计令牌验收读取最终 CSS 高度，避免把 44px 误判为 43.88px。
      .map((element) =>
        Number.parseFloat(window.getComputedStyle(element).height),
      ),
  );

  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights)
    expect(height).toBeGreaterThanOrEqual(minimumHeight);
}

/**
 * 六类标准弹窗共用同一个验证函数，确保新增字段不会只在某一个业务页面修好。
 * 必填、提示和错误都通过 `aria-describedby` / `aria-required` 传递，业务层无需手写关联。
 */
export async function expectStandardFormContract(dialog: Locator) {
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(":focus")).not.toHaveCount(0);

  const fields = dialog.locator('[data-slot="field"]');
  await expect(fields.first()).toBeVisible();
  for (let index = 0; index < (await fields.count()); index += 1) {
    const field = fields.nth(index);
    const label = field.locator('[data-slot="field-label"]');
    const control = field
      .locator(
        '[data-slot="input"], [data-slot="textarea"], [data-slot="select"], [data-slot="date-picker-root"] input',
      )
      .first();
    const controlId = await control.getAttribute("id");
    expect(controlId).toBeTruthy();
    await expect(label).toHaveAttribute("for", controlId!);

    if ((await field.getAttribute("data-required")) === "true") {
      await expect(control).toHaveAttribute("aria-required", "true");
    }

    const descriptionIds = await control.getAttribute("aria-describedby");
    for (const descriptionId of descriptionIds?.split(/\s+/).filter(Boolean) ??
      []) {
      await expect(field.locator(`#${descriptionId}`)).toBeVisible();
    }
  }

  const firstControl = fields
    .first()
    .locator(
      '[data-slot="input"], [data-slot="textarea"], [data-slot="select"], [data-slot="date-picker-root"] input',
    )
    .first();
  await firstControl.focus();
  await expect(firstControl).toBeFocused();
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}
