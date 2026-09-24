import { expect, type Locator } from "@playwright/test";

/**
 * 日期输入在界面上会按语言显示斜杠或年月，但业务层仍保存 ISO 字符串。
 * 测试通过真正的键盘录入和 Enter 提交，再读取组件公开的 data-value，
 * 同时覆盖用户操作与最终 FormData 值，不依赖 DatePicker 的内部隐藏 input 结构。
 */
export async function fillDateControl(input: Locator, value: string) {
  // 连续修改日期范围时，前一个字段会触发路由回写。先像用户一样聚焦并全选，
  // 再逐字输入，可以让 DatePicker 的“聚焦草稿保护”先建立，避免旧受控值在
  // Playwright 快速 fill 的同一时刻回写并与新文本拼接。
  await input.focus();
  await expect(input).toBeFocused();
  await input.press("Control+A");
  if (value) {
    await input.type(value);
  } else {
    await input.press("Backspace");
  }
  await input.press("Enter");
}

export async function expectDateControlValue(input: Locator, value: string) {
  await expect(input).toHaveAttribute("data-value", value);
}

export async function getDateControlValue(input: Locator) {
  return (await input.getAttribute("data-value")) ?? "";
}

/**
 * 日历按钮与可见输入位于同一个相对定位容器中。
 * 通过公开读屏名称打开弹层，避免业务测试绑定图标或 DOM 层级。
 */
export async function openDateControl(input: Locator, buttonName: RegExp) {
  const root = input.locator(
    'xpath=ancestor::*[@data-slot="date-picker-root"][1]',
  );
  await root.getByRole("button", { name: buttonName }).click();
  // 关闭动效会短暂保留旧弹层，只等待当前仍打开的那一层。
  await expect(input.page().locator('[data-slot="date-picker-popup"]:not([data-closed])')).toBeVisible();
}
