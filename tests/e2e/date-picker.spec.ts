import { expect, test } from "@playwright/test";

import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
  setTestLocale,
} from "./helpers/auth";
import {
  expectDateControlValue,
  fillDateControl,
  openDateControl,
} from "./helpers/date-control";
import { expandOrderFilters } from "./helpers/order-filter-visibility";

test.describe("全站日期选择控件", () => {
  test("日期和月份支持键盘输入、错误恢复与日历点选", async ({ page }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/company-expenses");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    await page.getByRole("button", { name: "新增费用" }).click();
    const dialog = page.getByRole("dialog", { name: "新增费用" });
    const monthInput = dialog.getByLabel("所属月份");
    const dateInput = dialog.getByLabel("付款日期");

    // 中文年份优先格式、斜杠格式以及闰年日期都应归一化成原有业务字符串。
    await fillDateControl(monthInput, "2024/02");
    await expectDateControlValue(monthInput, "2024-02");
    await expect(monthInput).toHaveValue("2024年02月");

    await fillDateControl(dateInput, "2024/02/29");
    await expectDateControlValue(dateInput, "2024-02-29");
    await expect(dateInput).toHaveValue("2024/02/29");

    await fillDateControl(dateInput, "2023/02/29");
    await expect(dateInput).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByText("请输入有效日期，例如 2026/06/18。"))
      .toBeVisible();

    // Escape 只丢弃尚未提交的错误文本，不改变最后一个有效业务值。
    await dateInput.press("Escape");
    await expect(dateInput).toHaveValue("2024/02/29");
    await expectDateControlValue(dateInput, "2024-02-29");
    await expect(dateInput).not.toHaveAttribute("aria-invalid", "true");

    await openDateControl(dateInput, /打开日期选择/);
    const popup = page.locator('[data-slot="date-picker-popup"]');
    await popup.locator('[data-day="2024-02-28"] button').click();
    await expectDateControlValue(dateInput, "2024-02-28");
    await expect(popup).toHaveCount(0);
    await expect(dateInput).toBeFocused();

    // Alt + ↓ 是不依赖鼠标的打开方式；月份点选后同样立即提交并关闭。
    await monthInput.focus();
    await monthInput.press("Alt+ArrowDown");
    await expect(popup).toBeVisible();
    await popup.getByRole("gridcell", { name: /3月/ }).click();
    await expectDateControlValue(monthInput, "2024-03");
    await expect(popup).toHaveCount(0);

    await openDateControl(dateInput, /打开日期选择/);
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    // 日期范围仍由两个字段维护；结束日期早于开始日期时不得污染原有筛选值。
    await page.goto("/admin/wholesale/orders");
    await expandOrderFilters(page);
    const fromInput = page.getByLabel("下单日期从");
    const toInput = page.getByLabel("下单日期到");
    const previousTo = await toInput.getAttribute("data-value");
    await fillDateControl(toInput, "2000/01/01");
    await expect(toInput).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("请选择允许范围内的日期或时间。"))
      .toBeVisible();
    await expectDateControlValue(toInput, previousTo ?? "");
    await expect(fromInput).not.toHaveAttribute("data-value", "");
  });

  test("英文界面接受地区顺序并保持 ISO 业务值", async ({ page }) => {
    await loginAs(page, "administrator");
    await setTestLocale(page, "en");
    await page.goto("/admin/company-expenses");
    await page.getByRole("button", { name: "Add Expense" }).click();

    const dialog = page.getByRole("dialog", { name: "Add Expense" });
    // 必填星号属于字段契约的一部分；按文本框的可访问名称精确定位，避免同时匹配“打开月份选择”按钮。
    const monthInput = dialog.getByRole("textbox", {
      exact: true,
      name: "Month",
    });
    const dateInput = dialog.getByRole("textbox", {
      exact: true,
      name: "Paid date (optional; can be added later)",
    });
    await fillDateControl(monthInput, "02/2024");
    await fillDateControl(dateInput, "02/29/2024");
    await expectDateControlValue(monthInput, "2024-02");
    await expectDateControlValue(dateInput, "2024-02-29");
    await expect(monthInput).toHaveValue("02/2024");
    await expect(dateInput).toHaveValue("02/29/2024");
  });
});
