import { test } from "@playwright/test";
import { InventoryOrderFixture } from "../test-support/inventory-order-fixture";
import { runLocalSupabaseSql } from "./helpers/local-supabase";
import {
  createOrderFromAdmin,
  reuseCreditAsSalesmanAndCheckManager,
} from "./helpers/inventory-order-pages";
import {
  applyForCreditAsClient,
  approveCreditAsFinance,
  requestExtensionAsClient,
  reviewExtensionAndRepayAsFinance,
} from "./helpers/inventory-credit-pages";
import {
  viewRepaidEligibilityAsClient,
  viewInventoryOnMobile,
} from "./helpers/inventory-order-read-pages";

test.describe("库存订单与专属信贷", () => {
  // 每个角色用独立浏览器上下文，串联前一步数据库确认的订单与信贷凭证。
  test.describe.configure({ mode: "serial" });
  let fixture: InventoryOrderFixture | undefined;

  test.beforeAll(() => {
    fixture = new InventoryOrderFixture(runLocalSupabaseSql);
  });

  test.afterAll(async ({}, testInfo) => {
    const counts = fixture?.cleanup();
    if (counts)
      await testInfo.attach("inventory-cleanup", {
        contentType: "application/json",
        body: JSON.stringify(counts),
      });
  });

  function requireFixture() {
    if (!fixture) throw new Error("专属库存夹具尚未就绪");
    return fixture;
  }

  test("管理员通过页面创建一笔待支付库存订单", async ({ page }) => {
    await createOrderFromAdmin(page, requireFixture());
  });

  test("客户只能读取订单并申请固定信贷", async ({ page }) => {
    await applyForCreditAsClient(page, requireFixture());
  });

  test("财务可统一审核信贷并管理全部库存订单", async ({ page }) => {
    await approveCreditAsFinance(page, requireFixture());
  });

  test("客户申请延期，财务批准后一次还清", async ({ page }) => {
    await requestExtensionAsClient(page, requireFixture());
  });

  test("财务审核延期并登记还款", async ({ page }) => {
    await reviewExtensionAndRepayAsFinance(page, requireFixture());
  });

  test("固定200美元还清后客户只看到长期资格", async ({ page }) => {
    await viewRepaidEligibilityAsClient(page);
  });

  test("业务员直接复用固定资格并叠加三档，经理没有入口", async ({
    browser,
  }) => {
    await reuseCreditAsSalesmanAndCheckManager(browser, requireFixture());
  });

  test("客户移动端没有订单或附件写入口且排版不溢出", async ({ page }) => {
    await viewInventoryOnMobile(page);
  });
});
