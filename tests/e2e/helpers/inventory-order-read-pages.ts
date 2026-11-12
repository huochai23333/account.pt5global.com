import { expect, type Page } from "@playwright/test";
import { loginAs } from "./auth";
import { inventoryOrderRow } from "./inventory-order-page-receipts";

export async function viewRepaidEligibilityAsClient(page: Page) {
  await loginAs(page, "client");
  await page.goto("/client/wholesale/inventory-orders");
  await expect(page.getByText(/已获200美元长期使用资格/).first()).toBeVisible();

  const awaitingRow = inventoryOrderRow(page, "INV-LOCAL-001");
  await awaitingRow.getByRole("button", { name: "申请信贷" }).click();
  const applyDialog = page.getByRole("dialog", { name: "申请订单信贷" });
  await expect(applyDialog.getByLabel("安心周转额度")).toHaveCount(0);
  await expect(applyDialog.getByLabel("订单助力额度")).toBeVisible();
  await expect(
    applyDialog.getByText("一单库存订单金额的50%", { exact: true }),
  ).toBeVisible();
  await applyDialog.getByRole("button", { name: "取消" }).click();
}

export async function viewInventoryOnMobile(page: Page) {
  await page.setViewportSize({ height: 844, width: 390 });
  await loginAs(page, "client");
  await page.goto("/client/wholesale/inventory-orders");

  await expect(
    page.locator('[data-slot="responsive-data-view"]'),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "创建库存订单" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "全额实付" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "作废" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "修改" })).toHaveCount(0);
  const mobileOrderFilters = page.getByTestId(
    "customer-inventory-order-filters",
  );
  await expect(
    mobileOrderFilters.getByPlaceholder("订单编号、客户、业务员、币种或备注"),
  ).toHaveCount(0);
  await expect(
    mobileOrderFilters.getByPlaceholder(
      "订单编号、客户、商品、1688链接、币种或备注",
    ),
  ).toBeVisible();
  await mobileOrderFilters
    .getByRole("button", { name: "更多筛选条件" })
    .click();
  await expect(mobileOrderFilters.getByLabel("状态")).toBeVisible();
  await expect(
    mobileOrderFilters.getByRole("button", { name: "最近 30 天" }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const presetLabel of ["本月", "上月", "最近 3 个月", "自定义"]) {
    await expect(
      mobileOrderFilters.getByRole("button", { name: presetLabel }),
    ).toBeVisible();
  }
  await expectNoDocumentHorizontalOverflow(page);

  // 手机使用订单卡片。读取已知种子订单，避免随新增订单的排序变化。
  const seedCard = page.getByRole("article").filter({
    has: page.getByText("INV-LOCAL-001", { exact: true }),
  });
  await seedCard.getByRole("button", { name: "查看 Order List" }).click();
  const attachmentDialog = page.getByRole("dialog", {
    name: /的 Order List$/,
  });
  await expect(
    attachmentDialog.getByText("选择表格", { exact: true }),
  ).toHaveCount(0);
  await expect(
    attachmentDialog.getByRole("button", { name: "上传所选文件" }),
  ).toHaveCount(0);
  await expect(
    attachmentDialog.getByRole("button", { name: "删除" }),
  ).toHaveCount(0);
  await attachmentDialog
    .getByRole("button", { exact: true, name: "关闭" })
    .click();

  await seedCard.getByRole("button", { name: /商品明细/ }).click();
  const itemDialog = page.getByRole("dialog", { name: /的商品明细$/ });
  await expect(
    itemDialog.getByText("数量：", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    itemDialog.getByRole("button", { name: "增加产品" }),
  ).toHaveCount(0);
  await expect(
    itemDialog.getByRole("button", { name: "保存商品" }),
  ).toHaveCount(0);
  await itemDialog.getByRole("button", { exact: true, name: "关闭" }).click();

  await page.getByRole("button", { name: "信贷管理" }).click();
  await expect(
    page.getByPlaceholder("订单编号、客户、信贷档位或说明"),
  ).toBeVisible();
  await expect(
    page.getByTestId("customer-inventory-credit-filters").getByLabel("客户"),
  ).toHaveCount(0);
  const mobileCreditFilters = page.getByTestId(
    "customer-inventory-credit-filters",
  );
  await mobileCreditFilters
    .getByRole("button", { name: "更多筛选条件" })
    .click();
  await expect(mobileCreditFilters.getByLabel("信贷档位")).toBeVisible();

  await expectNoDocumentHorizontalOverflow(page);
  await expectNoVerticalText(page);
  await expectVisibleButtonsHaveTouchSize(page);
}

export async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflowPixels).toBeLessThanOrEqual(2);
}

async function expectNoVerticalText(page: Page) {
  const verticalElements = await page.locator("main *:visible").evaluateAll(
    (elements) =>
      elements.filter((element) => {
        const style = window.getComputedStyle(element);
        return style.writingMode !== "horizontal-tb";
      }).length,
  );
  expect(verticalElements).toBe(0);
}

async function expectVisibleButtonsHaveTouchSize(page: Page) {
  const undersizedLabels = await page
    .locator("main button:visible")
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => {
          const box = button.getBoundingClientRect();
          return box.width < 40 || box.height < 40;
        })
        .map(
          (button) =>
            button.textContent?.trim() || button.getAttribute("aria-label"),
        ),
    );
  expect(undersizedLabels).toEqual([]);
}
