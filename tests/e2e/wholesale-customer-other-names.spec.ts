import { expect, type Page } from "@playwright/test";
import { test, type CustomerAliasPageFixture } from "./helpers/customer-alias-fixture";
import { expectNotForbiddenPage, expectWorkspaceShell, loginAs } from "./helpers/auth";

test.describe("wholesale customer other names", () => {
  test("admin can add another name from customer details", async ({ page, customerAlias }) => {
    await createOwnCustomer(page, customerAlias);
    await openCustomerByName(page, customerAlias.customerName);
    const detailsDialog = page.getByRole("dialog", { name: customerAlias.customerName });
    await expect(detailsDialog).toBeVisible();
    await detailsDialog.getByRole("button", { name: "新增名称" }).click();
    await detailsDialog.getByLabel("新增其他名称").fill(customerAlias.aliasName);
    await detailsDialog.getByRole("button", { name: "保存名称" }).click();
    await expect(page.getByText("客户其他名称已保存。")).toBeVisible();
    await expect(detailsDialog.getByText(customerAlias.aliasName, { exact: true })).toHaveCount(1);
    const saved = await customerAlias.verify([customerAlias.initialName, customerAlias.aliasName], 2);
    await page.reload();
    await openCustomerByName(page, customerAlias.customerName);
    await expect(detailsDialog.getByText(customerAlias.aliasName, { exact: true })).toHaveCount(1);
    await expect(detailsDialog.getByText(customerAlias.initialName, { exact: true })).toBeVisible();

    // 既有界面把重复名称作为核对提示并保留输入，等待这次请求终态后再核对版本不变。
    await detailsDialog.getByRole("button", { name: "新增名称" }).click();
    await detailsDialog.getByLabel("新增其他名称").fill(customerAlias.aliasName);
    await detailsDialog.getByRole("button", { name: "保存名称" }).click();
    await expect(page.getByText("客户资料中已有这些名称。", { exact: true })).toBeVisible();
    await expect(detailsDialog.getByLabel("新增其他名称")).toHaveValue(customerAlias.aliasName);
    const repeated = await customerAlias.verify([customerAlias.initialName, customerAlias.aliasName], 2);
    expect(repeated).toEqual(saved);
    await page.reload();
    await openCustomerByName(page, customerAlias.customerName);
    await expect(detailsDialog.getByText(customerAlias.aliasName, { exact: true })).toHaveCount(1);
  });

  test("customer details name form stays usable on mobile width", async ({ page, customerAlias }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await createOwnCustomer(page, customerAlias);
    await openCustomerByName(page, customerAlias.customerName);
    const detailsDialog = page.getByRole("dialog", { name: customerAlias.customerName });
    await expect(detailsDialog).toBeVisible();
    await detailsDialog.getByRole("button", { name: "新增名称" }).click();
    await expect(detailsDialog.getByLabel("新增其他名称")).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
  });
});

/** 客户也从真实表单创建；先核对独立记录，再进行别名操作，固定客户始终不写。 */
async function createOwnCustomer(page: Page, fixture: CustomerAliasPageFixture) {
  await loginAs(page, "administrator");
  await page.goto("/admin/wholesale/customers");
  await expectWorkspaceShell(page);
  await expectNotForbiddenPage(page);
  await page.getByRole("button", { name: "新增客户" }).click();
  const create = page.getByRole("dialog", { name: "新增批发客户" });
  await create.getByLabel("客户唯一标识名称").fill(fixture.customerName);
  await create.getByLabel("客户其他名称").fill(fixture.initialName);
  await create.getByLabel("备注").fill(fixture.marker);
  await create.getByRole("button", { name: "保存客户" }).click();
  await expect(create).toHaveCount(0);
  await fixture.verify([fixture.initialName], 1);
}

async function openCustomerByName(page: Page, customerName: string) {
  await page.getByLabel("搜索客户").fill(customerName);
  await page.getByRole("button", { name: customerName, exact: true }).filter({ visible: true }).click();
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflowPixels).toBeLessThanOrEqual(2);
}
