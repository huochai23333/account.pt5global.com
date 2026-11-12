import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";
import {
  chooseSelectOption,
  expectSelectValue,
  getSelectValue,
} from "./helpers/select-control";

// 在真实费用页操作共用Select，但不保存费用；交互/隐藏字段断言不替代业务写入验收。
test.describe("shared rounded select", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/company-expenses");
    await expect(page.getByRole("heading", { name: "公司费用" })).toBeVisible();
  });

  test("supports keyboard, outside click and dialog focus restoration", async ({
    page,
  }) => {
    const categorySelect = page.getByLabel("费用分类");
    await categorySelect.focus();
    await categorySelect.press("ArrowDown");
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    expect(await getSelectValue(categorySelect)).not.toBe("all");

    // Escape 关闭菜单后必须把焦点交还触发器，不能让键盘用户掉到页面开头。
    await categorySelect.click();
    // 必须先等菜单真实挂载；否则 Escape 可能早于 Base UI 注册键盘监听。
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("option")).toHaveCount(0);
    await expect(categorySelect).toBeFocused();

    await categorySelect.click();
    // 先等浮层真正挂载再点击外部区域，避免测试点击早于 Base UI 注册外部点击监听。
    // 真实用户也只有看到菜单后才会执行这一步，因此等待不会改变被验证的交互含义。
    await expect(page.getByRole("option").first()).toBeVisible();
    // Base UI 用透明交互层接管菜单外点击；坐标点击和真实用户行为一致，也能验证该层会关闭菜单。
    await page.mouse.click(4, 4);
    await expect(page.getByRole("option")).toHaveCount(0);

    const createButton = page.getByRole("button", { name: "新增费用" });
    await createButton.click();
    const dialog = page.getByRole("dialog", { name: "新增费用" });
    const dialogCategory = dialog.getByLabel("费用分类");
    await dialogCategory.click();
    await expect(page.getByRole("option").first()).toBeVisible();

    // 弹窗内第一次 Escape 只关闭菜单，第二次才关闭弹窗并恢复发起按钮焦点。
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(dialogCategory).toBeFocused();

    // 输入首字母应跳到匹配项，保留原生选择菜单常用的快速键盘操作。
    const dialogCurrency = dialog.getByLabel("币种");
    await dialogCurrency.click();
    await expect(page.getByRole("option").first()).toBeVisible();
    // 菜单可见后 Base UI 还会把焦点移到当前选项；等焦点真正进入菜单，
    // 再输入首字母，才能验证真实键盘路径而不是挂载瞬间的竞争。
    await expect(
      page.getByRole("option", { exact: true, name: "CNY" }),
    ).toBeFocused();
    await page.keyboard.press("u");
    await page.keyboard.press("Enter");
    await expectSelectValue(dialogCurrency, "USD");
    await expect(page.getByRole("option")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(createButton).toBeFocused();

    // 页面和浮层都只能出现 Base UI 角色节点，不能再混入系统原生选择器。
    await expect(page.locator("select, option")).toHaveCount(0);
  });

  test("keeps touch targets and popup inside the mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    // 移动端次要筛选默认折叠，先按真实用户路径展开后再检查选择菜单。
    await page.getByRole("button", { name: /更多筛选条件/ }).click();
    const currencySelect = page.getByLabel("币种");
    await currencySelect.click();
    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible();

    const optionHeights = await options.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().height),
    );
    // Chromium 在部分缩放比例下会产生细微的亚像素误差，但最终触控区域仍须达到 44px。
    expect(Math.min(...optionHeights)).toBeGreaterThanOrEqual(43.9);
    await expectDocumentInsideViewport(page);

    const usdOption = page.getByRole("option", { exact: true, name: "USD" });
    if ((await usdOption.count()) > 0) {
      await usdOption.click();
      await expectSelectValue(currencySelect, "USD");
    } else {
      await page.keyboard.press("Escape");
      await chooseSelectOption(currencySelect, { value: "all" });
    }
  });
});

async function expectDocumentInsideViewport(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflowPixels).toBeLessThanOrEqual(2);
}
