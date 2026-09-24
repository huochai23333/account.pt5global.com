import { expect, test, type Browser, type Page } from "@playwright/test";

import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import { expandOrderFilters } from "./helpers/order-filter-visibility";

const LOCAL_ORDER_NUMBER_2 = buildCurrentLocalOrderNumber(2);

test.describe("wholesale order pagination", () => {
  test("loads stable batches and searches linked numbers across all orders", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
    await expandOrderFilters(page);
    await expect(page.getByLabel("客户", { exact: true })).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
    // 日常默认表格只保留常用列；完整采购关联仍可按需切换查看。
    await expect(page.getByRole("columnheader")).toHaveCount(7);

    const rows = page.locator('[data-testid^="wholesale-order-row-"]');
    await expect(rows).toHaveCount(20);
    await expect(page.getByText(/已显示 20 \/ \d+ 笔订单/)).toBeVisible();

    const firstBatchIds = await readOrderRowIds(page);
    await page.getByRole("button", { name: "继续加载" }).click();
    await expect(rows).toHaveCount(40);

    const loadedIds = await readOrderRowIds(page);
    expect(new Set(loadedIds).size).toBe(loadedIds.length);
    expect(loadedIds.slice(0, 20)).toEqual(firstBatchIds);

    await searchWholesaleOrdersAcrossDates(page, "1688-LOCAL-001");
    await expect(rows).toHaveCount(2);
    await page.getByRole("button", { name: "查看全部字段" }).click();
    for (const orderId of [
      "c2000000-0000-4000-8000-000000000001",
      "c2000000-0000-4000-8000-000000000004",
    ]) {
      await expect(
        page
          .getByTestId(`wholesale-order-row-${orderId}`)
          .getByRole("button", { name: "1688-LOCAL-001" }),
      ).toBeVisible();
    }
  });

  test("salesman and client can use wholesale order cards on mobile", async ({
    browser,
  }) => {
    await expectMobileOrderCards(browser, "salesman", "/salesman/wholesale/orders");
    await expectMobileOrderCards(browser, "client", "/client/wholesale/orders");
  });

  test("mobile shows order cards first and keeps details inside a focused dialog", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");

    await expect(page.getByLabel("搜索订单")).toBeVisible();
    await expect(page.getByText(/当前筛选概览.*（展开）/)).toBeVisible();
    await expect(page.locator('[data-testid^="wholesale-order-card-"]')).toHaveCount(20);
    await expect(page.locator('[data-testid^="wholesale-order-row-"]').first()).toBeHidden();

    await page.locator('[data-testid^="wholesale-order-card-"]').first().click();

    const detailsDialog = page.getByRole("dialog", { name: /^订单 / });
    await expect(detailsDialog).toBeVisible();
    await expect(detailsDialog.getByRole("heading", { name: "费用和利润" }))
      .toBeVisible();
    await expect(detailsDialog.getByRole("heading", { name: "结汇记录" }))
      .toBeVisible();
    await expect(
      detailsDialog.getByRole("heading", { name: "关联采购记录" }),
    ).toBeVisible();
    await expect(detailsDialog.getByRole("heading", { name: "备注" }))
      .toBeVisible();
    await expect(detailsDialog.getByRole("button", { name: "修改订单" }))
      .toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
  });

  test("finance and scoped sales staff can manage Order List attachments", async ({
    browser,
  }) => {
    const roleCases = [
      { role: "finance" as const, url: "/finance/wholesale/orders" },
      { role: "salesman" as const, url: "/salesman/wholesale/orders" },
    ];

    for (const roleCase of roleCases) {
      const context = await browser.newContext({
        viewport: { height: 900, width: 1440 },
      });
      const page = await context.newPage();

      try {
        await loginAs(page, roleCase.role);
        await page.goto(roleCase.url);
        await searchWholesaleOrdersAcrossDates(page, LOCAL_ORDER_NUMBER_2);
        const row = page.locator(
          '[data-testid="wholesale-order-row-c2000000-0000-4000-8000-000000000002"]',
        );
        await expect(row).toBeVisible();
        await page.getByRole("button", { name: "查看全部字段" }).click();
        await expect(page.getByRole("button", { name: "显示常用字段" })).toBeVisible();
        await expect(row.getByRole("button", { name: "管理附件" })).toBeVisible();
      } finally {
        await context.close();
      }
    }
  });

  test("shows core failures and keeps related-record failures local", async ({
    page,
  }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/orders");

    await page.route("**/rest/v1/wholesale_order_settlements**", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ message: "test settlement failure" }),
        contentType: "application/json",
        status: 500,
      });
    });
    await searchWholesaleOrdersAcrossDates(page, "1688-LOCAL-001");
    await expect(page.getByText("部分结汇记录暂时没有加载成功。"))
      .toBeVisible();
    await expect(page.locator('[data-testid^="wholesale-order-row-"]')).toHaveCount(2);
    await page.getByRole("button", { name: "查看全部字段" }).click();
    await expect(
      page.locator('[data-testid^="wholesale-order-row-"]').filter({
        hasText: "1688-LOCAL-001",
      }),
    ).toHaveCount(2);

    await page.unroute("**/rest/v1/wholesale_order_settlements**");
    await page.route("**/rest/v1/rpc/get_wholesale_order_page", (route) =>
      route.abort(),
    );
    await page.getByLabel("搜索订单").fill("无法加载的订单");
    await expect(
      page.getByText("批发订单暂时没有加载成功，请稍后重试。"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
  });

  test("keeps client order fields private and shares Order List attachments", async ({
    browser,
  }) => {
    // 这个用例会依次完成管理员上传、客户下载、桌面与手机检查以及管理员清理，
    // 两个账号的完整流程在较慢的开发环境中可能超过全局 60 秒，因此单独放宽时间。
    test.setTimeout(120_000);

    const uploadKey = Date.now();
    const fileName = `client-order-list-${uploadKey}.csv`;
    const secondFileName = `client-order-list-${uploadKey}.xlsx`;
    const adminContext = await browser.newContext({
      viewport: { height: 900, width: 1440 },
    });
    const clientContext = await browser.newContext({
      viewport: { height: 900, width: 1440 },
    });
    const adminPage = await adminContext.newPage();
    const clientPage = await clientContext.newPage();

    try {
      await loginAs(adminPage, "administrator");
      await adminPage.goto("/admin/wholesale/orders");
      await searchWholesaleOrdersAcrossDates(
        adminPage,
        LOCAL_ORDER_NUMBER_2,
      );

      const adminRow = adminPage.locator(
        '[data-testid="wholesale-order-row-c2000000-0000-4000-8000-000000000002"]',
      );
      await expect(adminRow).toBeVisible();
      await adminPage.getByRole("button", { name: "查看全部字段" }).click();
      await expect(adminPage.getByRole("button", { name: "显示常用字段" })).toBeVisible();
      await adminRow.getByRole("button", { name: "管理附件" }).click();

      const attachmentDialog = adminPage.getByRole("dialog", {
        name: /Order List 附件/,
      });
      await attachmentDialog.locator('input[type="file"]').setInputFiles([
        {
          buffer: Buffer.from("sku,quantity\nLOCAL-001,2\n", "utf8"),
          mimeType: "text/csv",
          name: fileName,
        },
        {
          buffer: Buffer.from("local xlsx test payload", "utf8"),
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          name: secondFileName,
        },
      ]);
      await attachmentDialog.getByRole("button", { name: "上传附件" }).click();
      await expect(adminPage.getByText("Order List 附件已上传。")).toBeVisible();
      await expect(attachmentDialog).toBeHidden();
      await expect(adminRow.getByRole("button", { name: fileName })).toBeVisible();
      await expect(adminRow.getByRole("button", { name: secondFileName })).toBeVisible();
      await adminRow.getByRole("button", { name: "管理附件" }).click();
      await expect(attachmentDialog.getByText(fileName)).toBeVisible();
      await expect(attachmentDialog.getByText(secondFileName)).toBeVisible();

      await loginAs(clientPage, "client");
      await clientPage.goto("/client/wholesale/orders");
      // 客户的数据范围已经固定为本人，因此筛选区不再显示无意义的客户选择框。
      await expect(
        clientPage.getByLabel("客户", { exact: true }),
      ).toHaveCount(0);

      const rpcResponsePromise = clientPage.waitForResponse(
        (response) =>
          response.url().includes("/rest/v1/rpc/get_wholesale_order_page") &&
          response.request().method() === "POST",
      );
      await searchWholesaleOrdersAcrossDates(
        clientPage,
        LOCAL_ORDER_NUMBER_2,
      );
      const rpcPayload = (await (await rpcResponsePromise).json()) as {
        canViewInternalFields: boolean;
        orders: Array<Record<string, unknown>>;
      };

      expect(rpcPayload.canViewInternalFields).toBe(false);
      expect(rpcPayload.orders).toHaveLength(1);
      for (const field of [
        "payment_platform",
        "order_month",
        "referral_commission_fee",
        "product_purchase_amount",
        "international_shipping_fee",
        "other_fee",
      ]) {
        expect(rpcPayload.orders[0]).not.toHaveProperty(field);
      }

      for (const label of [
        "收款平台",
        "订单计入月份",
        "推荐佣金费用",
        "产品采购金额",
        "国际运费",
        "其他费用",
      ]) {
        await expect(
          clientPage.getByRole("columnheader", { name: label }),
        ).toHaveCount(0);
      }

      const clientRow = clientPage.locator(
        '[data-testid="wholesale-order-row-c2000000-0000-4000-8000-000000000002"]',
      );
      await expect(clientRow).toContainText("本地业务员");
      await expect(clientRow).not.toContainText("未分配");
      await expect(clientRow.getByRole("button", { name: fileName })).toBeVisible();
      await expect(clientRow.getByRole("button", { name: secondFileName })).toBeVisible();
      await expect(clientRow.getByRole("button", { name: "管理附件" })).toHaveCount(0);

      const downloadPromise = clientPage.waitForEvent("download");
      await clientRow.getByRole("button", { name: fileName }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(fileName);

      // 客户表格不提供内部采购入口；附件下载仍可正常完成。
      await expect(clientRow.getByRole("button", { name: "1688-CLIENT-LOCAL-001" })).toHaveCount(0);

      await clientPage.setViewportSize({ height: 844, width: 390 });
      await clientPage.goto("/client/wholesale/orders");
      await searchWholesaleOrdersAcrossDates(
        clientPage,
        LOCAL_ORDER_NUMBER_2,
      );
      await clientPage
        .locator('[data-testid="wholesale-order-card-c2000000-0000-4000-8000-000000000002"]')
        .click();
      const mobileDialog = clientPage.getByRole("dialog", {
        name: `订单 ${LOCAL_ORDER_NUMBER_2}`,
      });
      await expect(mobileDialog).toContainText("本地业务员");
      await expect(mobileDialog.getByRole("button", { name: fileName })).toBeVisible();
      await expect(mobileDialog.getByRole("button", { name: secondFileName })).toBeVisible();
      await expect(mobileDialog.getByText("收款平台", { exact: true })).toHaveCount(0);
      await expect(mobileDialog.getByText("产品采购金额", { exact: true })).toHaveCount(0);
      await expectNoDocumentHorizontalOverflow(clientPage);

      await adminPage.bringToFront();
      await attachmentDialog
        .locator(`[data-attachment-name="${fileName}"]`)
        .getByRole("button", { name: "删除" })
        .click();
      await adminPage
        .getByRole("dialog", { name: "请确认这项操作" })
        .getByRole("button", { name: "确认操作" })
        .click();
      await expect(adminPage.getByText("Order List 附件已删除。")).toBeVisible();
      await expect(attachmentDialog.getByText(fileName)).toHaveCount(0);
      const secondDeleteButton = attachmentDialog
        .locator(`[data-attachment-name="${secondFileName}"]`)
        .getByRole("button", { name: "删除" });
      await expect(secondDeleteButton).toBeEnabled();
      // 第一次删除会让弹窗列表重新排版；直接触发第二个按钮，避免测试框架
      // 在列表动画结束前反复等待元素位置稳定。
      await secondDeleteButton.evaluate((button: HTMLButtonElement) => button.click());
      await adminPage
        .getByRole("dialog", { name: "请确认这项操作" })
        .getByRole("button", { name: "确认操作" })
        .click();
      await expect(attachmentDialog.getByText(secondFileName)).toHaveCount(0);
    } finally {
      await adminContext.close();
      await clientContext.close();
    }
  });
});

async function readOrderRowIds(page: Page) {
  return page
    .locator('[data-testid^="wholesale-order-row-"]')
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-testid")?.replace("wholesale-order-row-", "") ?? ""),
    );
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflowPixels).toBeLessThanOrEqual(2);
}

function buildCurrentLocalOrderNumber(index: number) {
  // 本地夹具按上海当前月份生成订单号，测试也按同一业务时区计算，避免月份变化后失效。
  const dateParts = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(new Date());
  const year = dateParts.find((part) => part.type === "year")?.value ?? "";
  const month = dateParts.find((part) => part.type === "month")?.value ?? "";

  return `WH-LOCAL-${year}${month}-${String(index).padStart(3, "0")}`;
}

/**
 * 本地固定订单可能早于页面默认的最近 30 天范围。
 * 精确回归应使用产品已有的“跨日期查此单号”，而不是放宽真实用户的默认查询范围。
 */
async function searchWholesaleOrdersAcrossDates(page: Page, orderNumber: string) {
  await page.getByLabel("搜索订单").fill(orderNumber);
  await page.getByRole("button", { name: "跨日期查此单号" }).click();
}

async function expectMobileOrderCards(
  browser: Browser,
  role: "client" | "salesman",
  path: string,
) {
  const context = await browser.newContext({ viewport: { height: 844, width: 390 } });
  const page = await context.newPage();

  try {
    await loginAs(page, role);
    await page.goto(path);
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);
    await expect(page.getByLabel("搜索订单")).toBeVisible();
    if (role === "client") {
      await expect(page.getByLabel("客户", { exact: true })).toHaveCount(0);
    }
    await expect(page.locator('[data-testid^="wholesale-order-card-"]').first())
      .toBeVisible();
    if (role === "client") {
      // 客户从实际卡片进入详情，确认页面围绕订单履约展示而非后台结汇资料。
      await page.locator('[data-testid^="wholesale-order-card-"]').first().click();
      const dialog = page.getByRole("dialog", { name: /^订单 / });
      await expect(dialog.getByText("物流公司")).toBeVisible();
      await expect(dialog.getByRole("heading", { name: "结汇记录" })).toHaveCount(0);
      await expect(dialog.getByRole("heading", { name: "关联采购记录" })).toHaveCount(0);
      await dialog.getByRole("button", { name: "关闭" }).click();
    }
    await expectNoDocumentHorizontalOverflow(page);
    await expectNoVerticalText(page);
    await expectVisibleButtonsHaveTouchSize(page);
  } finally {
    await context.close();
  }
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
