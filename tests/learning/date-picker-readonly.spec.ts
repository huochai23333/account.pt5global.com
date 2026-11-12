import { test, expect } from "./fixtures";
import { loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";

test("固定按月生效的时间无法通过快捷键修改", async ({
  page,
  context,
  learningUser,
}) => {
  await context.addCookies([
    { name: "bs-locale", value: "zh", url: "http://localhost:3000" },
  ]);
  await loginLearningUser(page, learningUser);
  await page.goto("/admin/wholesale/settings");
  await page
    .getByTestId("business-parameter-row-wholesale_referral_waybill_bonus")
    .getByRole("button", { name: "修改", exact: true })
    .click();
  const dateInput = page.getByTestId("business-parameter-effective-time");
  await expect(dateInput).toHaveAttribute("readonly", "");
  const effectiveTime = await dateInput.inputValue();
  // 只读输入的键盘入口必须和已禁用的日历按钮一致。
  await dateInput.press("Alt+ArrowDown");
  await expect(page.locator('[data-slot="date-picker-popup"]')).toHaveCount(0);
  await expect(dateInput).toHaveValue(effectiveTime);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
