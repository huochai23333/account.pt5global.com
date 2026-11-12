import { expect, type Page } from "@playwright/test";

import { fillDateControl } from "./date-control";
import { chooseSelectOption } from "./select-control";
import { shanghaiDate } from "../../test-support/shanghai-calendar";

const SALESMAN_CODE = "wholesale_salesman_customer_commission";

// 页面只负责发起操作，订单版本与结汇结果由原测试独立查询数据库。
export async function publishSalesmanTier(
  page: Page,
  input: { reason: string; tier1Rate: string; tier2Rate: string; },
) {
  await page.goto("/admin/wholesale/settings");
  const row = page.getByTestId(`business-parameter-row-${SALESMAN_CODE}`);
  await row.getByRole("button", { name: "修改" }).click();
  const dialog = page.getByRole("dialog", { name: /修改批发订单业务员佣金/ });
  await dialog
    .getByTestId("business-parameter-input-existing_customer_rate")
    .fill(input.tier1Rate);
  await dialog
    .getByTestId("business-parameter-input-new_customer_service_fee_rate")
    .fill(input.tier2Rate);
  await dialog
    .getByTestId("business-parameter-change-reason")
    .fill(input.reason);
  await dialog.getByTestId("business-parameter-review-publish").click();
  await page
    .getByRole("dialog", { name: "确认发布这次修改？" })
    .getByRole("button", { name: "确认发布" })
    .click();
  await expect(page.getByText(/已发布第 [23] 版/)).toBeVisible();
}

export async function createWholesaleOrder(page: Page, note: string) {
  await page.goto("/salesman/wholesale/orders");
  await page.getByRole("button", { name: "新建订单" }).click();
  const dialog = page.getByRole("dialog", { name: "新建批发订单" });
  await chooseSelectOption(dialog.getByLabel("客户名"), {
    label: "Wholesale Alpha",
  });
  await chooseSelectOption(dialog.getByLabel("关联业务员"), {
    label: "本地业务员",
  });
  await dialog.getByLabel("小单数量").fill("1");
  await dialog.getByLabel("产品采购金额").fill("100");
  await dialog.getByLabel("国际运费").fill("20");
  await dialog.getByLabel("其他费用").fill("0");
  await dialog.getByLabel("推荐佣金费用").fill("0");
  await dialog.getByLabel("快递公司").fill("DHL");
  await chooseSelectOption(dialog.getByLabel("客户支付币种"), { value: "USD" });
  await dialog.getByLabel("客户支付金额").fill("200");
  await chooseSelectOption(dialog.getByLabel("收款平台"), { label: "Wise" });
  await fillDateControl(dialog.getByLabel("订单计入月份"), shanghaiDate().slice(0, 7));
  await dialog.getByLabel("备注").fill(note);
  await dialog.getByRole("button", { name: "保存订单" }).click();
  await expect(page.getByText("批发订单已保存。")).toBeVisible();
}

export async function settleOrderFromPage(page: Page, note: string) {
  await page.goto("/admin/wholesale/orders");
  await page.getByLabel("搜索订单").fill(note);
  // 备注属于完整字段；展开后再用该唯一备注定位新建的订单。
  await page.getByRole("button", { name: "查看全部字段" }).click();
  const row = page.getByRole("row").filter({ hasText: note });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "登记结汇" }).click();
  const dialog = page.getByRole("dialog", { name: "确认结汇" });
  await dialog.getByLabel("本次结汇金额").fill("200");
  await fillDateControl(dialog.getByLabel("结汇日期"), shanghaiDate());
  await dialog.getByRole("button", { name: "保存结汇记录" }).click();
  await expect(page.getByText("结汇记录已保存。")).toBeVisible();
}
