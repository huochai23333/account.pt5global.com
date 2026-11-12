import { expect, type Page } from "@playwright/test";

// 筛选区的默认边界与焦点层级。检查通过后恢复原折叠状态，供后续截图继续使用。
/**
 * 筛选区的静止状态应当轻于普通表单，但聚焦状态仍必须清楚可见。
 * 这里读取浏览器最终计算色，避免只检查 class 名却没有真正覆盖到页面。
 */
export async function expectSoftFilterControlHierarchy(page: Page) {
  const mobileDisclosure = page.getByRole("button", {
    name: /更多筛选条件/,
  });
  // 桌面和手机都可能默认收起筛选项；先等折叠按钮挂载，再按页面实际状态判断，
  // 检查完成后恢复原状态，保证后续截图仍记录用户进入页面时的构图。
  await expect(
    page.getByRole("button", { name: /更多筛选条件|收起筛选条件/ }),
  ).toBeVisible();
  const restoreCollapsedState = await mobileDisclosure.isVisible();

  if (restoreCollapsedState) {
    await expect(mobileDisclosure).toBeVisible();
    await mobileDisclosure.click();
    await expect(
      page.getByRole("button", { name: /收起筛选条件/ }),
    ).toBeVisible();
  }

  const filterInput = page.locator('[data-slot="input"]').first();
  const filterControls = page.locator(
    '[data-slot="field"][data-density="filter"] :is([data-slot="input"], [data-slot="select"])',
  );
  const inactivePreset = page.getByRole("button", { name: "本月", exact: true });
  const activePreset = page.getByRole("button", {
    name: "最近 30 天",
    exact: true,
  });

  await expect(filterInput).toBeVisible();
  expect(await filterControls.count()).toBeGreaterThanOrEqual(5);
  await expect(inactivePreset).toHaveAttribute("aria-pressed", "false");
  await expect(activePreset).toHaveAttribute("aria-pressed", "true");

  // 页面导航后鼠标可能恰好落在控件上；先移到空白角落，避免把正常的 hover 边框误判成默认层级不一致。
  await page.mouse.move(0, 0);

  const colors = await page.evaluate(() => {
    const resolveToken = (token: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      document.body.append(probe);
      const color = window.getComputedStyle(probe).color;
      probe.remove();
      return color;
    };

    return {
      filterBorder: resolveToken("--filter-control-border"),
      focusBorder: resolveToken("--ring"),
      primarySurface: resolveToken("--primary"),
    };
  });

  // 文本输入、选择菜单和日期输入必须从同一个 Field 上下文继承浅边界。
  // 逐个读取计算样式可以防止某类控件只在 class 名上看似正确，实际仍回退到默认深边框。
  const filterControlCount = await filterControls.count();
  // hover 退场会按主题时长平滑过渡；轮询最终颜色既保留真实动效，也避免把中间帧误判成第二套边框。
  await expect
    .poll(() =>
      filterControls.evaluateAll((elements) =>
        elements.map(
          (element) => window.getComputedStyle(element).borderColor,
        ),
      ),
    )
    .toEqual(Array(filterControlCount).fill(colors.filterBorder));
  await expect(inactivePreset).toHaveCSS("border-color", colors.filterBorder);
  await expect(activePreset).toHaveCSS("background-color", colors.primarySurface);

  await filterInput.focus();
  await expect(filterInput).toHaveCSS("border-color", colors.focusBorder);
  await filterInput.blur();

  if (restoreCollapsedState) {
    await page.getByRole("button", { name: /收起筛选条件/ }).click();
  }
}
