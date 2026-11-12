import { expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { test, type CustomerAliasPageFixture } from "./helpers/customer-alias-fixture";
import { readDisposablePostgresTarget } from "../test-support/disposable-fixture";
import { readLocalPostgresRows, localSqlValue } from "./helpers/local-postgres-query";

import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
  type RegressionRole,
} from "./helpers/auth";

test.describe("wholesale customer management", () => {
  test.beforeEach(({ baseURL }) => {
    // 固定账号的阅读和错误删除测试也先核验专属项目，不能只给创建用例加边界。
    readDisposablePostgresTarget({ baseURL, supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      mode: process.env.PT5_E2E_FIXTURE_MODE, project: process.env.PT5_E2E_DATABASE_PROJECT,
      container: process.env.PT5_E2E_DATABASE_CONTAINER }, args =>
      execFileSync("docker", args, { encoding: "utf8", timeout: 12000, windowsHide: true }).trim());
  });

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

  test("admin can edit and delete a created customer", async ({ page, customerAlias }) => {
    await expectCreateEditAndDeleteCustomer(page, "administrator", "/admin", customerAlias);
  });

  test("salesman can edit and delete a created customer", async ({ page, customerAlias }) => {
    await expectCreateEditAndDeleteCustomer(page, "salesman", "/salesman", customerAlias);
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

    const protectedCustomer = readCustomer("unique_name", "Wholesale Alpha");
    const orderCounts = readLocalPostgresRows<{ count: number }>(
      `select count(*)::integer as count from public.wholesale_orders where customer_id=${localSqlValue(protectedCustomer.id)}`,
    );
    expect(orderCounts).toHaveLength(1);
    expect(orderCounts[0].count).toBeGreaterThan(0);
    await openCustomerByName(page, "Wholesale Alpha");

    const detailsDialog = page.getByRole("dialog", { name: "Wholesale Alpha" });
    await detailsDialog.getByRole("button", { name: "删除客户" }).click();

    const deleteDialog = page.getByRole("dialog", { name: "删除批发客户" });
    await deleteDialog.getByRole("button", { name: "确认删除" }).click();

    await expect(page.getByText("这个客户已经有批发订单，不能删除。")).toBeVisible();
    await expect(detailsDialog).toBeVisible();
    // 错误提示不能证明没有误删：按同一ID比对完整行/版本，并确认原订单数量仍在。
    expect(readCustomer("id", protectedCustomer.id)).toEqual(protectedCustomer);
    expect(readLocalPostgresRows<{ count: number }>(
      `select count(*)::integer as count from public.wholesale_orders where customer_id=${localSqlValue(protectedCustomer.id)}`,
    )).toEqual(orderCounts);
    await page.reload();
    await openCustomerByName(page, "Wholesale Alpha");
    await expect(detailsDialog).toBeVisible();
  });
});

async function expectCreateEditAndDeleteCustomer(
  page: Page,
  role: RegressionRole,
  basePath: "/admin" | "/salesman",
  fixture: CustomerAliasPageFixture,
) {
  // 复用已审过的客户夹具：写入前登记UUID名称/备注，断言失败也按归属和修订精确回收。
  const customerName = fixture.customerName;
  const editedContact = `微信 ${fixture.aliasName}`;
  const editedSource = `测试来源 ${fixture.aliasName}`;

  await loginAs(page, role);
  await page.goto(`${basePath}/wholesale/customers`);
  await expectWorkspaceShell(page);
  await expectNotForbiddenPage(page);

  await page.getByRole("button", { name: "新增客户" }).click();

  const createDialog = page.getByRole("dialog", { name: "新增批发客户" });
  await createDialog.getByLabel("客户唯一标识名称").fill(customerName);
  await createDialog.getByLabel("客户其他名称").fill(fixture.initialName);
  await createDialog.getByLabel("联系方式").fill(`微信 ${fixture.initialName}`);
  await createDialog.getByLabel("客户来源").fill("自动测试");
  await createDialog.getByLabel("备注").fill(fixture.marker);
  await createDialog.getByRole("button", { name: "保存客户" }).click();

  await expect(page.getByText("批发客户已保存。")).toBeVisible();
  const created = await fixture.verify([fixture.initialName], 1);
  expect(readCustomer("id", created.id)).toMatchObject({ id: created.id, unique_name: customerName,
    contact_details: `微信 ${fixture.initialName}`, source: "自动测试", notes: fixture.marker, edit_revision: 1 });
  await page.reload();
  await page.getByLabel("搜索客户").fill(customerName);
  await openCustomerByName(page, customerName);

  const detailsDialog = page.getByRole("dialog", { name: customerName });
  await detailsDialog.getByRole("button", { name: "编辑客户" }).click();

  const editDialog = page.getByRole("dialog", { name: "编辑批发客户" });
  await editDialog.getByLabel("联系方式").fill(editedContact);
  await editDialog.getByLabel("客户来源").fill(editedSource);
  await editDialog
    .getByLabel("客户其他名称")
    .fill(`${fixture.initialName}\n${fixture.aliasName}`);
  await editDialog.getByRole("button", { name: "保存修改" }).click();

  await expect(page.getByText("客户信息已更新。")).toBeVisible();
  await expect(editDialog).toHaveCount(0);
  await expect(detailsDialog.getByText(editedContact)).toBeVisible();
  await expect(detailsDialog.getByText(editedSource)).toBeVisible();
  const edited = await fixture.verify([fixture.initialName, fixture.aliasName], 2);
  expect(edited.id).toBe(created.id);
  const editedRecord = readCustomer("id", created.id);
  expect(editedRecord).toMatchObject({ contact_details: editedContact, source: editedSource, notes: fixture.marker, edit_revision: 2 });
  await page.reload();
  await page.getByLabel("搜索客户").fill(customerName);
  await openCustomerByName(page, customerName);
  await expect(detailsDialog.getByText(editedContact, { exact: true })).toBeVisible();
  await expect(detailsDialog.getByText(editedSource, { exact: true })).toBeVisible();
  expect(readCustomer("id", created.id)).toEqual(editedRecord);

  await detailsDialog.getByRole("button", { name: "删除客户" }).click();

  const deleteDialog = page.getByRole("dialog", { name: "删除批发客户" });
  await deleteDialog.getByRole("button", { name: "确认删除" }).click();

  await expect(page.getByText("客户已删除。")).toBeVisible();
  expectCustomerAbsent(fixture);
  await page.reload();
  await page.getByLabel("搜索客户").fill(customerName);
  await expect(page.getByText(customerName, { exact: true })).toHaveCount(0);
}

type CustomerRecord = { id: string; unique_name: string; contact_details: string | null; source: string | null;
  notes: string | null; edit_revision: number; other_names: string[]; row_version: string };

/** 独立Docker只读连接返回完整行和版本，避免页面响应自身成为唯一的业务凭证。 */
function readCustomer(column: "id" | "unique_name", value: string) {
  const rows = readLocalPostgresRows<CustomerRecord>(
    `select c.*,c.xmin::text as row_version from public.wholesale_customers c where c.${column}=${localSqlValue(value)}`,
  );
  expect(rows).toHaveLength(1);
  return rows[0];
}

function expectCustomerAbsent(fixture: CustomerAliasPageFixture) {
  if (!fixture.customerId) throw new Error("本次客户编号尚未确认，不能判断删除完成");
  for (const [column, value] of [["id", fixture.customerId], ["unique_name", fixture.customerName]]) {
    expect(readLocalPostgresRows<{ id: string }>(
      `select id from public.wholesale_customers where ${column}=${localSqlValue(value)}`,
    )).toEqual([]);
  }
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
