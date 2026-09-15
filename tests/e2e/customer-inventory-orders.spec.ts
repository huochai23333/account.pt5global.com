import { expect, test, type Page } from "@playwright/test";

import { chooseSelectOption } from "./helpers/select-control";
import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";

test.describe.configure({ mode: "serial" });

test.describe("库存订单与专属信贷", () => {
  test("管理员通过页面创建一笔待支付库存订单", async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/inventory-orders");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
    await expect(
      page.getByRole("heading", { level: 2, name: "库存订单" }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "INV-LOCAL-001" }),
    ).toBeVisible();
    const orderFilters = page.getByTestId("customer-inventory-order-filters");
    const recentThirtyDays = orderFilters.getByRole("button", {
      name: "最近 30 天",
    });
    await expect(recentThirtyDays).toHaveAttribute("aria-pressed", "true");
    await orderFilters.getByRole("button", { name: "上月" }).click();
    await expect(page.getByText("没有符合筛选条件的记录")).toBeVisible();
    await recentThirtyDays.click();
    await expect(
      page.getByRole("cell", { name: "INV-LOCAL-001" }),
    ).toBeVisible();

    // 先覆盖关键词、状态和无结果恢复，确认筛选不会影响后续订单操作。
    const orderSearch =
      page.getByPlaceholder("订单编号、客户、商品、1688链接、币种或备注");
    await orderSearch.fill("INV-LOCAL-002");
    await expect(
      page.getByRole("cell", { name: "INV-LOCAL-002" }),
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: "INV-LOCAL-001" })).toHaveCount(
      0,
    );
    await orderSearch.fill("不存在的库存订单");
    await expect(page.getByText("没有符合筛选条件的记录")).toBeVisible();
    await page.getByRole("button", { name: "恢复默认范围" }).click();
    await chooseSelectOption(page.getByLabel("状态"), {
      label: "已付清",
    });
    await expect(
      page.getByRole("cell", { name: "INV-LOCAL-002" }),
    ).toBeVisible();
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
    await dialog.getByLabel("备注或说明").fill("浏览器库存信贷回归订单");
    await dialog.getByRole("button", { name: "创建订单" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("库存订单已创建。")).toBeVisible();
    // 测试被手动中断后可能留下同金额订单；列表按最新订单在前排列，
    // 因此只取第一行，避免一次重跑同时命中多条记录而产生假失败。
    const newOrderRow = page
      .locator("tbody tr")
      .filter({ hasText: "350.00" })
      .first();
    await expect(newOrderRow).toContainText("Wholesale Beta");
    await expect(newOrderRow).toContainText("待支付");

    // 商品名称和1688链接都纳入关键词筛选，但表格保持紧凑，不直接展开商品行。
    await orderSearch.fill("浏览器测试收纳袋");
    await expect(newOrderRow).toBeVisible();
    await orderSearch.fill("350001");
    await expect(newOrderRow).toBeVisible();
    await orderSearch.fill("");
    await expectNoDocumentHorizontalOverflow(page);
  });

  test("客户只能读取订单并申请固定信贷", async ({ page }) => {
    await loginAs(page, "client");
    await page.goto("/client/wholesale/inventory-orders");
    await expectNotForbiddenPage(page);

    await expect(
      page.getByRole("button", { name: "创建库存订单" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "全额实付" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "作废" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "修改" })).toHaveCount(0);
    await expect(
      page.getByPlaceholder("订单编号、客户、业务员、币种或备注"),
    ).toHaveCount(0);
    await expect(
      page.getByPlaceholder("订单编号、客户、商品、1688链接、币种或备注"),
    ).toBeVisible();
    const orderFilters = page.getByTestId("customer-inventory-order-filters");
    await expect(orderFilters.getByLabel("客户")).toHaveCount(0);
    await expect(orderFilters.getByLabel("业务员")).toHaveCount(0);

    const targetRow = page
      .locator("tbody tr")
      .filter({ hasText: "350.00" })
      .first();
    await targetRow.getByRole("button", { name: "申请信贷" }).click();
    const applyDialog = page.getByRole("dialog", { name: "申请订单信贷" });
    await expect(applyDialog.getByText("固定200美元", { exact: true }))
      .toBeVisible();
    await applyDialog.getByLabel("安心周转额度").check();
    await applyDialog.getByLabel("备注或说明").fill("申请固定档位");
    await applyDialog.getByRole("button", { name: "提交申请" }).click();

    await expect(applyDialog).toHaveCount(0);
    await expect(page.getByText("信贷申请已提交。")).toBeVisible();
  });

  test("财务可统一审核信贷并管理全部库存订单", async ({ page }) => {
    await loginAs(page, "finance");
    await page.goto("/finance/wholesale/inventory-orders");
    await expectNotForbiddenPage(page);
    await expect(
      page.getByRole("button", { name: "创建库存订单" }),
    ).toBeVisible();
    // 财务现在同时拥有库存订单写权限，页面默认先展示订单；
    // 审核动作位于“信贷管理”标签，先显式切换再验证待审核申请。
    await page.getByRole("button", { name: /信贷管理/ }).click();
    await expect(page.getByRole("button", { name: "统一审核" })).toBeVisible();

    await page.getByRole("button", { name: "统一审核" }).click();
    const reviewDialog = page.getByRole("dialog", {
      name: "统一审核订单信贷",
    });
    await chooseSelectOption(reviewDialog.getByLabel("审核结果"), {
      label: "批准",
    });
    await expect(reviewDialog.getByLabel("批准金额（美元）")).toBeDisabled();
    await expect(reviewDialog.getByLabel("订单剩余实付金额")).toHaveValue(
      "150",
    );
    await reviewDialog.getByRole("button", { name: "确认审核" }).click();

    await expect(reviewDialog).toHaveCount(0);
    await expect(page.getByText("订单信贷已审核。")).toBeVisible();
    await expect(page.getByText("使用中")).toBeVisible();

    await page.getByRole("button", { name: /^库存订单/ }).click();
    await expect(
      page.getByRole("button", { name: "维护备注" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /维护商品/ }).first(),
    ).toBeVisible();
    await expect(page.getByText("350.00").first()).toBeVisible();
  });

  test("客户申请延期，财务批准后一次还清", async ({ page }) => {
    await loginAs(page, "client");
    await page.goto("/client/wholesale/inventory-orders");
    await page.getByRole("button", { name: "信贷管理" }).click();
    await page.getByRole("button", { name: "申请延期" }).click();

    const extensionDialog = page.getByRole("dialog", { name: "申请延期" });
    await chooseSelectOption(extensionDialog.getByLabel("延期时长"), {
      label: "2 个月",
    });
    await extensionDialog.getByRole("button", { name: "提交延期申请" }).click();
    await expect(extensionDialog).toHaveCount(0);
    await expect(page.getByText("延期申请已提交。")).toBeVisible();
  });

  test("财务审核延期并登记还款", async ({ page }) => {
    await loginAs(page, "finance");
    await page.goto("/finance/wholesale/inventory-orders");
    await page.getByRole("button", { name: /信贷管理/ }).click();
    await page.getByRole("button", { name: "审核延期" }).click();

    const reviewExtensionDialog = page.getByRole("dialog", {
      name: "审核延期申请",
    });
    await expect(reviewExtensionDialog.getByLabel("审核结果")).toContainText(
      "批准",
    );
    await reviewExtensionDialog
      .getByRole("button", { name: "确认审核" })
      .click();
    await expect(page.getByText("延期申请已审核。")).toBeVisible();

    await page.getByRole("button", { name: "登记一次还清" }).click();
    const repaymentDialog = page.getByRole("dialog", {
      name: "登记一次还清",
    });
    await expect(repaymentDialog.getByLabel("实际还款日期")).not.toHaveValue(
      "",
    );
    await repaymentDialog.getByRole("button", { name: "确认还清" }).click();

    await expect(repaymentDialog).toHaveCount(0);
    await expect(page.getByText("信贷已一次还清。")).toBeVisible();
    await expect(page.getByText("已还清")).toBeVisible();

    // 信贷筛选同时覆盖档位、状态和无结果后的恢复入口。
    await chooseSelectOption(page.getByLabel("信贷状态"), {
      label: "已还清",
    });
    await expect(page.getByText("共 1 条，当前显示 1 条")).toBeVisible();
    await chooseSelectOption(page.getByLabel("信贷档位"), {
      label: "订单助力额度",
    });
    await expect(page.getByText("没有符合筛选条件的记录")).toBeVisible();
    await page.getByRole("button", { name: "清空筛选" }).click();
    const repaidCredit = page
      .getByRole("article")
      .filter({ hasText: "安心周转额度" });
    await expect(repaidCredit).toContainText("已还清");
    await expect(repaidCredit).toContainText("固定200美元");
  });

  test("固定200美元还清后客户只看到长期资格", async ({ page }) => {
    await loginAs(page, "client");
    await page.goto("/client/wholesale/inventory-orders");
    await expect(
      page.getByText(/已获200美元长期使用资格/).first(),
    ).toBeVisible();

    const awaitingRow = page.locator("tbody tr").filter({
      hasText: "INV-LOCAL-001",
    });
    await awaitingRow.getByRole("button", { name: "申请信贷" }).click();
    const applyDialog = page.getByRole("dialog", { name: "申请订单信贷" });
    await expect(applyDialog.getByLabel("安心周转额度")).toHaveCount(0);
    await expect(applyDialog.getByLabel("订单助力额度")).toBeVisible();
    await expect(
      applyDialog.getByText("一单库存订单金额的50%", { exact: true }),
    ).toBeVisible();
    await applyDialog.getByRole("button", { name: "取消" }).click();
  });

  test("业务员直接复用固定资格并叠加三档，经理没有入口", async ({
    browser,
  }) => {
    const salesmanContext = await browser.newContext();
    const salesmanPage = await salesmanContext.newPage();
    await loginAs(salesmanPage, "salesman");
    await salesmanPage.goto("/salesman/wholesale/inventory-orders");
    await expect(
      salesmanPage.getByRole("button", { name: "创建库存订单" }),
    ).toBeVisible();
    await expect(
      salesmanPage.getByRole("button", { name: "维护备注" }).first(),
    ).toBeVisible();

    await salesmanPage
      .getByRole("button", { name: "创建库存订单" })
      .click();
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
    await createDialog
      .getByLabel("第 1 件商品名称")
      .fill("固定额度复用商品");
    await createDialog.getByLabel("产品数量").fill("6");
    await createDialog.getByRole("button", { name: "创建订单" }).click();
    await expect(salesmanPage.getByText("库存订单已创建。")).toBeVisible();

    const reuseRow = salesmanPage
      .locator("tbody tr")
      .filter({ hasText: "500.00" })
      .first();
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
    await manageDialog
      .getByRole("button", { name: "确认并立即生效" })
      .click();
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
    await itemDialog.getByRole("button", { name: "保存商品" }).click();
    await expect(salesmanPage.getByText("商品明细已更新。")).toBeVisible();
    await salesmanContext.close();

    const managerContext = await browser.newContext();
    const managerPage = await managerContext.newPage();
    await loginAs(managerPage, "manager");
    await managerPage.goto("/manager/wholesale/inventory-orders");
    await expect(managerPage).toHaveURL(/\/business-unavailable(?:[?#].*)?$/);
    await expect(
      managerPage.getByRole("heading", { name: "当前没有可使用的业务" }),
    ).toBeVisible();
    await managerContext.close();
  });

  test("客户移动端没有订单或附件写入口且排版不溢出", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await loginAs(page, "client");
    await page.goto("/client/wholesale/inventory-orders");

    await expect(
      page.locator('[data-slot="responsive-data-view"]'),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "创建库存订单" }),
    ).toHaveCount(0);
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

    await page.getByRole("button", { name: "查看 Order List" }).first().click();
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

    await page.getByRole("button", { name: /商品明细/ }).first().click();
    const itemDialog = page.getByRole("dialog", { name: /的商品明细$/ });
    await expect(itemDialog.getByText("数量：", { exact: false }).first()).toBeVisible();
    await expect(itemDialog.getByRole("button", { name: "增加产品" })).toHaveCount(
      0,
    );
    await expect(itemDialog.getByRole("button", { name: "保存商品" })).toHaveCount(
      0,
    );
    await itemDialog
      .getByRole("button", { exact: true, name: "关闭" })
      .click();

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
  });
});

async function expectNoDocumentHorizontalOverflow(page: Page) {
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
