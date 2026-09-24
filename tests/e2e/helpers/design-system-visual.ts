import { expect, type Locator, type Page } from "@playwright/test";

export async function stabilizeVisualPage(page: Page) {
  // 服务端先生成日期，浏览器预先改写 Date 会让两侧首屏不一致并触发水合错误。
  // 只请求减少动效；截图时另行冻结动画与光标，不改动业务日期。
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .addStyleTag({
      content: `
        *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }
        nextjs-portal { display: none !important; }
      `,
    })
    .catch(() => undefined);
}

export async function capture(page: Page, name: string) {
  // 每次导航后重新注入样式，因为整页请求会创建新的 document。
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}nextjs-portal{display:none!important}",
  });
  await expect(page).toHaveScreenshot(name, {
    animations: "disabled",
    // Playwright 默认截图会临时给输入框写入 caret-color，撞上 React 水合时会产生假告警。
    caret: "initial",
    maxDiffPixelRatio: 0.015,
  });
}

export async function signOut(page: Page) {
  await page.goto("/auth/sign-out?next=%2Flogin");
  await page.getByRole("button", { name: /退出登录|Sign out/ }).click();
  await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);
}

export async function expectDocumentInsideViewport(page: Page) {
  const overflowPixels = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflowPixels).toBeLessThanOrEqual(2);
}

/**
 * 日期、月份和日期时间都使用锚定浮层。这里检查浏览器最终布局而不是 Tailwind 类名，
 * 可以同时发现 390px、768px 和桌面宽度下的碰撞翻转、横向越界与弹层过高问题。
 */
export async function expectAnchoredPopupInsideViewport(page: Page) {
  // 从日期切到月份时，关闭动画可能短暂保留上一层弹窗；最后挂载的是当前弹窗。
  const popup = page.locator('[data-slot="date-picker-popup"]:not([data-closed])').last();
  await expect(popup).toBeVisible();
  const box = await popup.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;

  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  await expectDocumentInsideViewport(page);
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

export async function expectSemanticContrast(page: Page) {
  const ratios = await page.evaluate(() => {
    const rootStyle = window.getComputedStyle(document.documentElement);
    const readToken = (name: string) => rootStyle.getPropertyValue(name).trim();
    const toLuminance = (value: string) => {
      const compactHex = value.replace("#", "");
      const normalizedHex =
        compactHex.length === 3
          ? compactHex
              .split("")
              .map((channel) => `${channel}${channel}`)
              .join("")
          : compactHex;
      const channels = normalizedHex
        .match(/.{2}/g)
        ?.map((channel) => Number.parseInt(channel, 16) / 255);
      if (!channels || channels.length !== 3) return 0;

      const [red, green, blue] = channels.map((channel) =>
        channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4,
      );
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const contrast = (foreground: string, background: string) => {
      const foregroundLuminance = toLuminance(foreground);
      const backgroundLuminance = toLuminance(background);
      return (
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
      );
    };
    const interactiveSurface = readToken("--surface-interactive");

    return {
      control: ["--control-border", "--ring"].map((token) =>
        contrast(readToken(token), interactiveSurface),
      ),
      status: [
        ["--status-info", "--status-info-soft"],
        ["--status-success", "--status-success-soft"],
        ["--status-warning", "--status-warning-soft"],
        ["--status-danger", "--status-danger-soft"],
      ].map(([foreground, background]) =>
        contrast(readToken(foreground), readToken(background)),
      ),
      text: [
        "--content-strong",
        "--content-muted",
        "--content-subtle",
        "--primary",
      ].map((token) => contrast(readToken(token), interactiveSurface)),
    };
  });

  expect(
    Math.min(...ratios.text, ...ratios.status),
    `文字与状态色对比度：${JSON.stringify(ratios)}`,
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    Math.min(...ratios.control),
    `控件边界与焦点对比度：${JSON.stringify(ratios)}`,
  ).toBeGreaterThanOrEqual(3);
}

export async function readControlStyle(locator: Locator) {
  return locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      borderRadius: style.borderRadius,
      borderWidth: style.borderWidth,
      color: style.color,
      fontSize: style.fontSize,
      height: style.height,
    };
  });
}

export function expectSemanticControlStyle(
  actual: Awaited<ReturnType<typeof readControlStyle>>,
  expected: Awaited<ReturnType<typeof readControlStyle>>,
) {
  // large 与 default 会有意使用不同的字号和几何尺寸；这里仅比较它们共享的
  // 语义颜色与边界，防止认证页为了恢复旧视觉而复制另一套控件皮肤。
  expect({
    backgroundColor: actual.backgroundColor,
    borderColor: actual.borderColor,
    borderWidth: actual.borderWidth,
    color: actual.color,
  }).toEqual({
    backgroundColor: expected.backgroundColor,
    borderColor: expected.borderColor,
    borderWidth: expected.borderWidth,
    color: expected.color,
  });
}

export async function disableControlTransitions(page: Page) {
  await page.addStyleTag({
    content: '[data-slot="input"]{transition:none!important}',
  });
}

export async function readFocusStyle(locator: Locator) {
  return locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      borderColor: style.borderColor,
      hasBoxShadow: style.boxShadow !== "none",
      outlineColor: style.outlineColor,
    };
  });
}

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

export function routeToName(route: string) {
  if (route === "/missing-visual-page") return "not-found";
  return route.replace(/^\//, "").replaceAll("/", "-");
}

export function isAuthRoute(route: string) {
  return ["/login", "/register", "/forgot-password"].includes(route);
}
