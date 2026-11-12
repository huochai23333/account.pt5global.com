import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import { fillDateControl } from "./helpers/date-control";
import { chooseSelectOption } from "./helpers/select-control";
import { shanghaiDate } from "../test-support/shanghai-calendar";
import { readDisposablePostgresTarget } from "../test-support/disposable-fixture";
import { cleanupFixtureResources } from "../test-support/fixture-cleanup-sequence";
import {
  createFeeCustomerFixture,
  prepareFeeCustomer,
  cleanupFeeCustomer,
} from "./helpers/wholesale-fee-customer-fixture";
import {
  createFeeOrderFixture,
  registerFeeOrderRequest,
  confirmFeeOrder,
  cleanupFeeOrder,
} from "./helpers/wholesale-fee-order-fixture";
import { collectFeePageErrors } from "./helpers/wholesale-fee-order-page";
import {
  withFeePageRoute,
  forwardFeeWrite,
} from "./helpers/wholesale-fee-page-route";

const CREATE_ORDER_RPC_PATH = "/rest/v1/rpc/create_wholesale_order";
const ORDER_RPC =
  "**/rest/v1/rpc/{create_wholesale_order,get_wholesale_order_page}";
const prefix = `fees-e2e-${randomUUID()}`;
const customer = createFeeCustomerFixture(prefix);
const order = createFeeOrderFixture(
  prefix,
  "creation-dedup",
  customer.id,
  "55555555-5555-4555-8555-555555555555",
  "new",
  "creation-dedup",
);

// 端口不代表项目身份；任何准备或登录前先核验专属API/数据库映射与暂停调度。
test.beforeAll(async ({ baseURL }) => {
  readDisposablePostgresTarget(
    {
      baseURL,
      supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      mode: process.env.PT5_E2E_FIXTURE_MODE,
      project: process.env.PT5_E2E_DATABASE_PROJECT,
      container: process.env.PT5_E2E_DATABASE_CONTAINER,
    },
    (args) =>
      execFileSync("docker", args, {
        encoding: "utf8",
        timeout: 12000,
        windowsHide: true,
      }).trim(),
  );
  prepareFeeCustomer(customer);
});
// 无论页面断言在哪里失败，仍尝试关闭页面和核对全部专属资源；各失败由原测试框架保留。
test.afterEach(async ({ page }) => {
  await cleanupFixtureResources(
    () => page.unrouteAll({ behavior: "wait" }),
    () => page.close(),
  );
});
test.afterAll(async () => {
  await cleanupFixtureResources(
    async () => cleanupFeeOrder(order),
    async () => cleanupFeeCustomer(customer),
  );
});

test.describe("批发订单创建防重复", () => {
  test("业务员连续提交时只创建一次，并等待列表刷新后再关闭弹窗", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = collectFeePageErrors(page);
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "salesman");
    // 先完成初次列表响应，再安装保存后的刷新闸门，避免把初次加载误当作保存后刷新。
    const initialResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/rpc/get_wholesale_order_page") &&
        response.request().method() === "POST",
    );
    await page.goto("/salesman/wholesale/orders");
    await (await initialResponse).finished();
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    const note = order.note;
    const createPayloads: Array<Record<string, unknown>> = [];
    page.on("request", (request) => {
      if (request.url().includes(CREATE_ORDER_RPC_PATH))
        createPayloads.push(request.postDataJSON() as Record<string, unknown>);
    });
    let releaseOrderRefresh = () => {};
    const orderRefreshGate = new Promise<void>((resolve) => {
      releaseOrderRefresh = resolve;
    });
    let announceOrderRefresh = () => {};
    const orderRefreshStarted = new Promise<void>((resolve) => {
      announceOrderRefresh = resolve;
    });

    // 一个路由作用域同时管理原创建请求和刷新闸门；正文失败先释放闸门，再等待处理器排空。
    await withFeePageRoute(
      page,
      ORDER_RPC,
      async (route) => {
        if (route.request().url().includes(CREATE_ORDER_RPC_PATH)) {
          await forwardFeeWrite(route, order, (value) =>
            registerFeeOrderRequest(order, value),
          );
        } else {
          announceOrderRefresh();
          await orderRefreshGate;
          await route.continue();
        }
      },
      async () => {
        try {
          await page.getByRole("button", { name: "新建订单" }).click();
          const dialog = page.getByRole("dialog", { name: "新建批发订单" });
          await fillOrderCreateForm(dialog, note);
          const createResponse = page.waitForResponse(
            (response) =>
              response.url().includes(CREATE_ORDER_RPC_PATH) &&
              response.request().method() === "POST",
          );
          const saveButton = dialog.getByRole("button", { name: "保存订单" });
          await saveButton.click();
          expect((await createResponse).ok()).toBe(true);
          await orderRefreshStarted;
          // 列表仍被暂停时，独立查询证明恰好一张完整订单和一份提成已经提交。
          confirmFeeOrder(order);
          await expect(dialog).toBeVisible();
          await expect(saveButton).toBeDisabled();
          // 同步提交覆盖React下一次渲染前的窗口，不能只看按钮disabled外观。
          await dialog.locator("form").evaluate((form: HTMLFormElement) => {
            form.requestSubmit();
          });
          await expect.poll(() => createPayloads.length).toBe(1);
          expect(createPayloads[0]?.p_creation_request_id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          );
          releaseOrderRefresh();
          await expect(dialog).toHaveCount(0);
          await expect(page.getByText("批发订单已保存。")).toBeVisible();
        } finally {
          // 提前断言失败同样解锁，避免unrouteAll(wait)等待一个永不释放的Promise。
          releaseOrderRefresh();
        }
      },
    );
    await page.getByLabel("搜索订单").fill(note);
    const createdRows = page.locator('[data-testid^="wholesale-order-row-"]');
    await expect(createdRows).toHaveCount(1);
    await expect(
      page.getByTestId(`wholesale-order-row-${order.proof!.order!.id}`),
    ).toBeVisible();
    await page.reload();
    await page.getByLabel("搜索订单").fill(note);
    await expect(createdRows).toHaveCount(1);
    confirmFeeOrder(order);
    expect(createPayloads).toHaveLength(1);

    await page.setViewportSize({ height: 844, width: 390 });
    await page.getByRole("button", { name: "新建订单" }).click();
    const mobileDialog = page.getByRole("dialog", { name: "新建批发订单" });
    await expect(mobileDialog).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
    const mobileSaveBox = await mobileDialog
      .getByRole("button", { name: "保存订单" })
      .boundingBox();
    expect(mobileSaveBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await page.keyboard.press("Escape");
    await expect(mobileDialog).toHaveCount(0);
    expect(createPayloads).toHaveLength(1);
    expect(errors).toEqual([]);
  });
});

/** 表单仍使用原1单/100采购/20运费/200美元样本；客户和业务员按稳定编号选择。 */
async function fillOrderCreateForm(
  dialog: ReturnType<Page["getByRole"]>,
  note: string,
) {
  await chooseSelectOption(dialog.getByLabel("客户名"), { value: customer.id });
  await chooseSelectOption(dialog.getByLabel("关联业务员"), {
    value: "55555555-5555-4555-8555-555555555555",
  });
  await dialog.getByLabel("小单数量").fill("1");
  await dialog.getByLabel("产品采购金额").fill("100");
  await dialog.getByLabel("国际运费").fill("20");
  await dialog.getByLabel("其他费用").fill("3");
  await dialog.getByLabel("推荐佣金费用").fill("2");
  await dialog.getByLabel("快递公司").fill("DHL");
  await chooseSelectOption(dialog.getByLabel("客户支付币种"), { value: "USD" });
  await dialog.getByLabel("客户支付金额").fill("200");
  await chooseSelectOption(dialog.getByLabel("收款平台"), { label: "Wise" });
  await fillDateControl(
    dialog.getByLabel("订单计入月份"),
    shanghaiDate().slice(0, 7),
  );
  await dialog.getByLabel("备注").fill(note);
}
async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflowPixels).toBeLessThanOrEqual(2);
}
