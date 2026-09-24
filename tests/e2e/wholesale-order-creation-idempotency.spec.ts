import { expect, test, type Page } from "@playwright/test";

import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import { fillDateControl } from "./helpers/date-control";
import { chooseSelectOption } from "./helpers/select-control";

const CREATE_ORDER_RPC_PATH = "/rest/v1/rpc/create_wholesale_order";
const ORDER_PAGE_RPC = "**/rest/v1/rpc/get_wholesale_order_page";

test.describe("批发订单创建防重复", () => {
  test("业务员连续提交时只创建一次，并等待列表刷新后再关闭弹窗", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "salesman");
    await page.goto("/salesman/wholesale/orders");
    await expectWorkspaceShell(page);
    await expectNotForbiddenPage(page);

    const note = `创建防重复 ${Date.now()}`;
    const createPayloads: Array<Record<string, unknown>> = [];
    page.on("request", (request) => {
      if (!request.url().includes(CREATE_ORDER_RPC_PATH)) {
        return;
      }

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

    // 数据库保存成功后故意暂停列表刷新，稳定复现原来按钮过早恢复的几秒窗口。
    await page.route(ORDER_PAGE_RPC, async (route) => {
      announceOrderRefresh();
      await orderRefreshGate;
      await route.continue();
    });

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
    await createResponse;
    await orderRefreshStarted;

    await expect(dialog).toBeVisible();
    await expect(saveButton).toBeDisabled();

    // requestSubmit 模拟辅助技术或脚本再次触发表单；同步 ref 必须在 React
    // 下一次渲染前就拦住它，不能只依赖按钮的 disabled 外观。
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

    await page.getByLabel("搜索订单").fill(note);
    // 备注仍参与搜索，但常用列不展示备注；结果应只剩刚创建的订单。
    const createdRows = page.locator('[data-testid^="wholesale-order-row-"]');
    await expect(createdRows).toHaveCount(1);

    // 同一个弹窗在手机宽度仍需保持正常表单布局和可触控按钮尺寸。
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
  });
});

async function fillOrderCreateForm(
  dialog: ReturnType<Page["getByRole"]>,
  note: string,
) {
  await chooseSelectOption(dialog.getByLabel("客户名"), {
    label: "Wholesale Alpha",
  });
  await chooseSelectOption(dialog.getByLabel("关联业务员"), {
    label: "本地业务员",
  });
  await dialog.getByLabel("小单数量").fill("1");
  await dialog.getByLabel("产品采购金额").fill("100");
  await dialog.getByLabel("国际运费").fill("20");
  await dialog.getByLabel("其他费用").fill("3");
  await dialog.getByLabel("推荐佣金费用").fill("2");
  await dialog.getByLabel("快递公司").fill("DHL");
  await chooseSelectOption(dialog.getByLabel("客户支付币种"), {
    value: "USD",
  });
  await dialog.getByLabel("客户支付金额").fill("200");
  await chooseSelectOption(dialog.getByLabel("收款平台"), { label: "Wise" });
  await fillDateControl(
    dialog.getByLabel("订单计入月份"),
    currentShanghaiMonth(),
  );
  await dialog.getByLabel("备注").fill(note);
}

function currentShanghaiMonth() {
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}`;
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflowPixels).toBeLessThanOrEqual(2);
}
