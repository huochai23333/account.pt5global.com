import { expect, type Page } from "@playwright/test";

import {
  expectForbiddenPage,
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import { fillDateControl } from "./helpers/date-control";
import { chooseSelectOption } from "./helpers/select-control";
import { test } from "./helpers/company-expense-fixture";
import { shanghaiDate } from "../test-support/shanghai-calendar";

test.describe("company expenses", () => {
  test("administrator can open company expenses", async ({ page }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/company-expenses");

    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
    await expect(page.getByRole("heading", { name: "公司费用" })).toBeVisible();
  });

  test("finance can open company expenses", async ({ page }) => {
    await loginAs(page, "finance");
    await page.goto("/finance/company-expenses");

    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
    await expect(page.getByRole("heading", { name: "公司费用" })).toBeVisible();
  });

  test("salesman cannot open company expenses", async ({ page }) => {
    await loginAs(page, "salesman");
    await page.goto("/salesman/company-expenses");

    await expectForbiddenPage(page);
  });

  test("finance can create and delete a company expense", async ({ page, expenseFixture }) => {
    const { title } = expenseFixture;
    const month = shanghaiDate().slice(0, 7);

    await loginAs(page, "finance");
    await page.goto("/finance/company-expenses");
    await expectWorkspaceShell(page);

    await page.getByRole("button", { name: "新增费用" }).click();
    const dialog = page.getByRole("dialog", { name: "新增费用" });
    await expect(dialog).toBeVisible();
    await fillDateControl(
      dialog.getByLabel("所属月份"),
      month,
    );
    await dialog.getByLabel("费用名称").fill(title);
    await chooseSelectOption(dialog.getByLabel("费用分类"), {
      value: "office",
    });
    await dialog.getByLabel("金额").fill("123.45");
    await chooseSelectOption(dialog.getByLabel("币种"), { value: "CNY" });
    await dialog.getByLabel("收款方").fill("自动测试收款方");
    await dialog.getByLabel("备注").fill("用于公司费用页面回归测试");
    await dialog.getByRole("button", { name: "保存费用" }).click();

    await expect(page.getByText("费用已保存。")).toBeVisible();
    const expenseCard = page.locator("article").filter({ hasText: title });
    await expect(expenseCard).toBeVisible();
    await expect(expenseCard.getByText("¥123.45")).toBeVisible();
    await expenseFixture.expectSaved(month);
    await page.reload();
    await expect(expenseCard).toBeVisible();
    await expenseFixture.expectSaved(month);

    const deleteButton = expenseCard.getByRole("button", { name: "删除" });
    await deleteButton.click();

    const confirmDialog = page.getByRole("dialog", {
      name: "请确认这项操作",
    });
    await expect(confirmDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(confirmDialog).toBeHidden();
    await expect(expenseCard).toBeVisible();
    await expect(deleteButton).toBeFocused();
    await expenseFixture.expectSaved(month);

    // 取消确认不能触发删除；再次打开后只有明确确认才继续领域操作。
    await deleteButton.click();
    await confirmDialog.getByRole("button", { name: "暂不操作" }).click();
    await expect(expenseCard).toBeVisible();
    await expenseFixture.expectSaved(month);

    await deleteButton.click();
    await confirmDialog.getByRole("button", { name: "确认操作" }).click();

    await expect(page.getByText("费用已删除。")).toBeVisible();
    await expect(expenseCard).toHaveCount(0);
    await expenseFixture.expectAbsent();
    await page.reload();
    await expect(expenseCard).toHaveCount(0);
    await expenseFixture.expectAbsent();
  });

  test("company expenses page fits mobile width", async ({ page }) => {
    await loginAs(page, "finance");
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/finance/company-expenses");

    await expect(page.getByRole("heading", { name: "公司费用" })).toBeVisible();
    await expect(page.getByRole("button", { name: "新增费用" })).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
  });
});

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflowPixels).toBeLessThanOrEqual(2);
}
