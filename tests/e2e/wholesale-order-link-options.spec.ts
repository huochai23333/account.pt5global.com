import { expect, test } from "@playwright/test";

import {
  formatWholesaleOrderLinkOption,
  sortWholesaleOrderLinkOptionsNewestFirst,
} from "../../components/dashboard/wholesale/wholesale-order-link-options";
import type { WholesaleOrderLinkOption } from "../../lib/wholesale";

// 本文件直接测试真实显示/排序纯函数，不登录或访问数据库；列表权限与写入终态由其他用例验证。
test.describe("批发订单关联选项", () => {
  test("统一显示订单编号和原币金额", () => {
    const order = buildOption({
      amount: 1234.5,
      currency: "USD",
      id: "00000000-0000-4000-8000-000000000001",
      orderNumber: "WH-LINK-001",
      orderedAt: "2026-07-10T08:00:00.000Z",
    });

    expect(formatWholesaleOrderLinkOption(order)).toBe(
      "WH-LINK-001 · US$1,234.50",
    );
  });

  test("按下单时间倒序并用订单 ID 稳定处理同一时间", () => {
    const options = [
      buildOption({
        id: "00000000-0000-4000-8000-000000000001",
        orderNumber: "WH-OLDER",
        orderedAt: "2026-07-10T08:00:00.000Z",
      }),
      buildOption({
        id: "00000000-0000-4000-8000-000000000002",
        orderNumber: "WH-SAME-LOWER-ID",
        orderedAt: "2026-07-12T08:00:00.000Z",
      }),
      buildOption({
        id: "00000000-0000-4000-8000-000000000003",
        orderNumber: "WH-SAME-HIGHER-ID",
        orderedAt: "2026-07-12T08:00:00.000Z",
      }),
    ];

    expect(
      sortWholesaleOrderLinkOptionsNewestFirst(options).map(
        (order) => order.order_number,
      ),
    ).toEqual(["WH-SAME-HIGHER-ID", "WH-SAME-LOWER-ID", "WH-OLDER"]);
    // 排序函数不能改变父组件原数组，否则其他列表也会被无意重排。
    expect(options.map((order) => order.order_number)).toEqual([
      "WH-OLDER",
      "WH-SAME-LOWER-ID",
      "WH-SAME-HIGHER-ID",
    ]);
  });
});

function buildOption({
  amount = 100,
  currency = "CNY",
  id,
  orderNumber,
  orderedAt,
}: {
  amount?: number;
  currency?: string;
  id: string;
  orderNumber: string;
  orderedAt: string;
}): WholesaleOrderLinkOption {
  return {
    customer_id: "00000000-0000-4000-8000-000000000010",
    customer_payment_amount: amount,
    customer_payment_currency: currency,
    id,
    order_number: orderNumber,
    ordered_at: orderedAt,
  };
}
