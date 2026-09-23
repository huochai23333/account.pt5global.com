import { expect, test, type Page } from "@playwright/test";

import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
  type RegressionRole,
} from "./helpers/auth";

test.describe("wholesale customer management", () => {
  test("桌面客户详情可用键盘打开并返回原位置", async ({ page }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/customers");
    const trigger = page.getByRole("button", { name: "Wholesale Alpha", exact: true }).filter({ visible: true });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Wholesale Alpha" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("admin can edit and delete a created customer", async ({ page }) => {
    await expectCreateEditAndDeleteCustomer(page, "administrator", "/admin");
  });

  test("salesman can edit and delete a created customer", async ({ page }) => {
    await expectCreateEditAndDeleteCustomer(page, "salesman", "/salesman");
  });

  test("customer edit controls stay usable on mobile width", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/customers");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    await openCustomerByName(page, "Wholesale Alpha");

    const detailsDialog = page.getByRole("dialog", { name: "Wholesale Alpha" });
    await expect(detailsDialog.getByRole("button", { name: "编辑客户" })).toBeVisible();
    await expect(detailsDialog.getByRole("button", { name: "删除客户" })).toBeVisible();

    await detailsDialog.getByRole("button", { name: "编辑客户" }).click();

    const editDialog = page.getByRole("dialog", { name: "编辑批发客户" });
    await expect(editDialog.getByLabel("客户唯一标识名称")).toBeVisible();
    await expect(editDialog.getByRole("button", { name: "保存修改" })).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
  });

  test("customer with wholesale orders is kept when delete is requested", async ({
    page,
  }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/customers");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    await openCustomerByName(page, "Wholesale Alpha");

    const detailsDialog = page.getByRole("dialog", { name: "Wholesale Alpha" });
    await detailsDialog.getByRole("button", { name: "删除客户" }).click();

    const deleteDialog = page.getByRole("dialog", { name: "删除批发客户" });
    await deleteDialog.getByRole("button", { name: "确认删除" }).click();

    await expect(page.getByText("这个客户已经有批发订单，不能删除。")).toBeVisible();
    await expect(detailsDialog).toBeVisible();
  });
});

async function expectCreateEditAndDeleteCustomer(
  page: Page,
  role: RegressionRole,
  basePath: "/admin" | "/salesman",
) {
  const timestamp = Date.now();
  const customerName = `自动测试客户 ${role} ${timestamp}`;
  const editedContact = `微信 自动测试 ${timestamp}`;
  const editedSource = `测试来源 ${timestamp}`;

  await loginAs(page, role);
  await page.goto(`${basePath}/wholesale/customers`);
  await expectWorkspaceShell(page);
  await expectNotForbiddenPage(page);

  await page.getByRole("button", { name: "新增客户" }).click();

  const createDialog = page.getByRole("dialog", { name: "新增批发客户" });
  await createDialog.getByLabel("客户唯一标识名称").fill(customerName);
  await createDialog.getByLabel("客户其他名称").fill(`${customerName} 店铺`);
  await createDialog.getByLabel("联系方式").fill(`微信 ${timestamp}`);
  await createDialog.getByLabel("客户来源").fill("自动测试");
  await createDialog.getByLabel("备注").fill("用于编辑删除测试");
  await createDialog.getByRole("button", { name: "保存客户" }).click();

  await expect(page.getByText("批发客户已保存。")).toBeVisible();
  await page.getByLabel("搜索客户").fill(customerName);
  await openCustomerByName(page, customerName);

  const detailsDialog = page.getByRole("dialog", { name: customerName });
  await detailsDialog.getByRole("button", { name: "编辑客户" }).click();

  const editDialog = page.getByRole("dialog", { name: "编辑批发客户" });
  await editDialog.getByLabel("联系方式").fill(editedContact);
  await editDialog.getByLabel("客户来源").fill(editedSource);
  await editDialog
    .getByLabel("客户其他名称")
    .fill(`${customerName} 店铺\n${customerName} 对账`);
  await editDialog.getByRole("button", { name: "保存修改" }).click();

  await expect(page.getByText("客户信息已更新。")).toBeVisible();
  await expect(editDialog).toHaveCount(0);
  await expect(detailsDialog.getByText(editedContact)).toBeVisible();
  await expect(detailsDialog.getByText(editedSource)).toBeVisible();

  await detailsDialog.getByRole("button", { name: "删除客户" }).click();

  const deleteDialog = page.getByRole("dialog", { name: "删除批发客户" });
  await deleteDialog.getByRole("button", { name: "确认删除" }).click();

  await expect(page.getByText("客户已删除。")).toBeVisible();
  await page.getByLabel("搜索客户").fill(customerName);
  await expect(page.getByText(customerName, { exact: true })).toHaveCount(0);
}

async function openCustomerByName(page: Page, customerName: string) {
  await page
    .getByText(customerName, { exact: true })
    .filter({ visible: true })
    .first()
    .click();
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflowPixels).toBeLessThanOrEqual(2);
}
