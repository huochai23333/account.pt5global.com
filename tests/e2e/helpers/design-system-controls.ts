import { expect, type Locator, type Page } from "@playwright/test";

// 共享控件的主题语义与焦点样式。对比度只核对选定令牌，不代表整站无障碍验收。
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
