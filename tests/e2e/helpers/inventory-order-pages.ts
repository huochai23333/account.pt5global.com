import { expect, type Browser, type Page } from "@playwright/test";
import { chooseSelectOption } from "./select-control";
import { expectNotForbiddenPage, expectWorkspaceShell, loginAs } from "./auth";
import type { InventoryOrderFixture } from "../../test-support/inventory-order-fixture";
import { expectNoDocumentHorizontalOverflow } from "./inventory-order-read-pages";
import {
  changeInventoryOrder,
  createInventoryOrder,
  inventoryOrderRow,
  orderNumber,
} from "./inventory-order-page-receipts";

export async function createOrderFromAdmin(
  page: Page,
  fixture: InventoryOrderFixture,
) {
  await page.setViewportSize({ height: 900, width: 1440 });
  await loginAs(page, "administrator");
  await page.goto("/admin/wholesale/inventory-orders");
  await expectWorkspaceShell(page);
  await expectNotForbiddenPage(page);
  await expect(
    page.getByRole("heading", { level: 2, name: "库存订单" }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "INV-LOCAL-001" })).toBeVisible();
  const orderFilters = page.getByTestId("customer-inventory-order-filters");
  const recentThirtyDays = orderFilters.getByRole("button", {
    name: "最近 30 天",
  });
  await expect(recentThirtyDays).toHaveAttribute("aria-pressed", "true");
  await orderFilters.getByRole("button", { name: "上月" }).click();
  await expect(page.getByText("没有符合筛选条件的记录")).toBeVisible();
  await recentThirtyDays.click();
  await expect(page.getByRole("cell", { name: "INV-LOCAL-001" })).toBeVisible();

  // 先覆盖关键词、状态和无结果恢复，确认筛选不会影响后续订单操作。
  const orderSearch = page.getByPlaceholder(
    "订单编号、客户、商品、1688链接、币种或备注",
  );
  await orderSearch.fill("INV-LOCAL-002");
  await expect(page.getByRole("cell", { name: "INV-LOCAL-002" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "INV-LOCAL-001" })).toHaveCount(
    0,
  );
  await orderSearch.fill("不存在的库存订单");
  await expect(page.getByText("没有符合筛选条件的记录")).toBeVisible();
  await page.getByRole("button", { name: "恢复默认范围" }).click();
  await chooseSelectOption(page.getByLabel("状态"), {
    label: "已付清",
  });
  await expect(page.getByRole("cell", { name: "INV-LOCAL-002" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "INV-LOCAL-001" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "恢复默认范围" }).click();

  await page.getByRole("button", { name: "创建库存订单" }).click();
  const dialog = page.getByRole("dialog", { name: "创建库存订单" });
  await chooseSelectOption(dialog.getByLabel("客户"), {
    label: "Wholesale Beta",
  });
  await chooseSelectOption(dialog.getByLabel("业务员"), {
    label: "本地业务员",
  });
  await dialog.getByLabel("购买金额").fill("350");
  await chooseSelectOption(dialog.getByLabel("币种"), { label: "USD" });
  await dialog.getByLabel("第 1 件商品名称").fill("浏览器测试收纳袋");
  await dialog.getByLabel("产品数量").fill("12");
  await dialog
    .getByLabel("1688货品链接")
    .fill("https://detail.1688.com/offer/350001.html");
  await dialog.getByRole("button", { name: "增加产品" }).click();
  await dialog.getByLabel("第 2 件商品名称").fill("浏览器测试标签");
  await dialog.getByLabel("产品数量").nth(1).fill("30");
  await dialog.getByLabel("备注或说明").fill(fixture.note("application"));
  const created = await createInventoryOrder(
    dialog.getByRole("button", { name: "创建订单" }),
    fixture,
    "application",
    350,
  );
  expect(created.items.map((row) => [row.product_name, row.quantity])).toEqual(
    expect.arrayContaining([
      ["浏览器测试收纳袋", 12],
      ["浏览器测试标签", 30],
    ]),
  );
  expect(created.items).toHaveLength(2);

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("库存订单已创建。")).toBeVisible();
  // 创建凭证先确定数据库订单编号，金额只用于展示断言。
  const newOrderRow = inventoryOrderRow(
    page,
    orderNumber(fixture, "application"),
  );
  await expect(newOrderRow).toContainText("Wholesale Beta");
  await expect(newOrderRow).toContainText("待支付");

  // 商品名称和1688链接都纳入关键词筛选，但表格保持紧凑，不直接展开商品行。
  await orderSearch.fill("浏览器测试收纳袋");
  await expect(newOrderRow).toBeVisible();
  await orderSearch.fill("350001");
  await expect(newOrderRow).toBeVisible();
  await orderSearch.fill("");
  await page.reload();
  await expect(newOrderRow).toContainText("待支付");
  await expectNoDocumentHorizontalOverflow(page);
}

export async function reuseCreditAsSalesmanAndCheckManager(
  browser: Browser,
  fixture: InventoryOrderFixture,
) {
  const salesmanContext = await browser.newContext();
  try {
    const salesmanPage = await salesmanContext.newPage();
    await loginAs(salesmanPage, "salesman");
    await salesmanPage.goto("/salesman/wholesale/inventory-orders");
    await expect(
      salesmanPage.getByRole("button", { name: "创建库存订单" }),
    ).toBeVisible();
    await expect(
      salesmanPage.getByRole("button", { name: "维护备注" }).first(),
    ).toBeVisible();

    await salesmanPage.getByRole("button", { name: "创建库存订单" }).click();
    const createDialog = salesmanPage.getByRole("dialog", {
      name: "创建库存订单",
    });
    await chooseSelectOption(createDialog.getByLabel("客户"), {
      label: "Wholesale Beta",
    });
    await createDialog.getByLabel("购买金额").fill("500");
    await chooseSelectOption(createDialog.getByLabel("币种"), {
      label: "USD",
    });
    await createDialog.getByLabel("第 1 件商品名称").fill("固定额度复用商品");
    await createDialog.getByLabel("备注或说明").fill(fixture.note("reuse"));
    await createDialog.getByLabel("产品数量").fill("6");
    const created = await createInventoryOrder(
      createDialog.getByRole("button", { name: "创建订单" }),
      fixture,
      "reuse",
      500,
    );
    expect(created.items).toHaveLength(1);
    expect(created.items[0]).toMatchObject({
      product_name: "固定额度复用商品",
      quantity: 6,
    });
    await expect(salesmanPage.getByText("库存订单已创建。")).toBeVisible();

    const reuseRow = inventoryOrderRow(
      salesmanPage,
      orderNumber(fixture, "reuse"),
    );
    await reuseRow.getByRole("button", { name: "管理信贷" }).click();
    const manageDialog = salesmanPage.getByRole("dialog", {
      name: "管理订单信贷",
    });
    const fixedSection = manageDialog
      .locator("section")
      .filter({ hasText: "安心周转额度" });
    await expect(fixedSection).toContainText("固定200美元");
    await chooseSelectOption(fixedSection.getByLabel("是否使用"), {
      label: "直接使用",
    });
    const singleSection = manageDialog
      .locator("section")
      .filter({ hasText: "订单助力额度" });
    await expect(singleSection).toContainText("一单库存订单金额的50%");
    await chooseSelectOption(singleSection.getByLabel("是否使用"), {
      label: "直接使用",
    });
    await singleSection.getByLabel("批准金额（美元）").fill("100");
    const allSection = manageDialog
      .locator("section")
      .filter({ hasText: "长期合作额度" });
    await expect(allSection).toContainText("所有订单金额的5%");
    await chooseSelectOption(allSection.getByLabel("是否使用"), {
      label: "直接使用",
    });
    await allSection.getByLabel("批准金额（美元）").fill("50");
    await expect(manageDialog.getByLabel("订单剩余实付金额")).toHaveValue(
      "150",
    );
    const paid = await changeInventoryOrder(
      manageDialog.getByRole("button", { name: "确认并立即生效" }),
      fixture,
      "reuse",
      "credit_managed",
      "manage_customer_inventory_order_credit",
    );
    expect(paid.orders[0]).toMatchObject({
      actual_payment_amount: 150,
      credit_offset_amount: 350,
      payment_status: "paid",
      remaining_amount: 0,
      revision: Number(created.orders[0].revision) + 1,
    });
    expect(paid.credits).toHaveLength(3);
    expect(paid.credits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tier: "fixed_200_usd",
          approved_amount_usd: 200,
          status: "active",
        }),
        expect.objectContaining({
          tier: "single_order_50",
          approved_amount_usd: 100,
          status: "active",
        }),
        expect.objectContaining({
          tier: "all_orders_5",
          approved_amount_usd: 50,
          status: "active",
        }),
      ]),
    );
    await expect(
      salesmanPage.getByText("订单信贷已生效，订单已经结清。"),
    ).toBeVisible();
    await expect(reuseRow).toContainText("已付清");

    await reuseRow.getByRole("button", { name: /维护商品/ }).click();
    const itemDialog = salesmanPage.getByRole("dialog", {
      name: /的商品明细$/,
    });
    await itemDialog.getByRole("button", { name: "增加产品" }).click();
    await itemDialog.getByLabel("第 2 件商品名称").fill("付款后补充商品");
    await itemDialog.getByLabel("产品数量").nth(1).fill("2");
    const updated = await changeInventoryOrder(
      itemDialog.getByRole("button", { name: "保存商品" }),
      fixture,
      "reuse",
      "items_updated",
      "replace_customer_inventory_order_items",
    );
    expect(updated.orders[0]).toMatchObject({
      payment_status: "paid",
      revision: Number(paid.orders[0].revision) + 1,
    });
    expect(updated.items).toHaveLength(2);
    expect(updated.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          product_name: "固定额度复用商品",
          quantity: 6,
        }),
        expect.objectContaining({
          product_name: "付款后补充商品",
          quantity: 2,
        }),
      ]),
    );
    await expect(salesmanPage.getByText("商品明细已更新。")).toBeVisible();
    await salesmanPage.reload();
    await expect(reuseRow).toContainText("已付清");
    await reuseRow.getByRole("button", { name: /维护商品/ }).click();
    await expect(itemDialog.getByLabel("第 2 件商品名称")).toHaveValue(
      "付款后补充商品",
    );
  } finally {
    await salesmanContext.close();
  }

  const managerContext = await browser.newContext();
  try {
    const managerPage = await managerContext.newPage();
    await loginAs(managerPage, "manager");
    await managerPage.goto("/manager/wholesale/inventory-orders");
    await expect(managerPage).toHaveURL(/\/business-unavailable(?:[?#].*)?$/);
    await expect(
      managerPage.getByRole("heading", { name: "当前没有可使用的业务" }),
    ).toBeVisible();
  } finally {
    await managerContext.close();
  }
}
