import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getAdminOrderListData } from "../../lib/admin-orders-list-data";
import { getServiceOrderDetail } from "../../lib/admin-orders-service-detail";
import { calculateOrderServiceFeeAmount } from "../../lib/admin-orders-service-fees";
import { createOrdersUiCopy } from "../../components/dashboard/admin-orders/admin-orders-copy";
import { createOrderFormState } from "../../components/dashboard/admin-orders/admin-orders-form";
import { parseCreateOrderForm } from "../../components/dashboard/admin-orders/admin-orders-form-validation";

test("普通订单的空授权范围直接返回空页", async () => {
  // 空范围绝不能退化为无条件查询。客户端替身一旦访问任何表就立即失败。
  const client = { from: () => { throw new Error("不应查询数据库"); } } as unknown as SupabaseClient;
  const data = await getAdminOrderListData(client, {
    businessOrderTypeIds: [],
    canViewOrderCosts: false,
    filters: { createdFromDate: "2026-01-01", createdToDate: "2026-01-31", orderEntryUser: "", orderingUser: "", orderNumber: "", searchMode: "date_range" },
    pageSize: 20,
    requestedPage: 3,
    userOptions: [],
  });
  expect(data.orders).toEqual([]);
  expect(data.summary).toEqual({ pending: 0, completed: 0, total: 0 });
  expect(data.pagination).toMatchObject({ page: 1, pageSize: 20 });
});

test("创建与编辑共用的表单校验保留采购、服务和会员的提交结构", () => {
  const copy = createOrdersUiCopy((key) => key);
  const initialForm = {
    ...createOrderFormState({ originalCurrency: "USD", orderEntryUser: "staff", orderType: "type" }),
    orderingUser: "customer",
    amount: "100",
    dailyExchangeRate: "7",
    purchaseSubtype: "purchase-subtype",
    purchaseDetails: "收件人：测试",
    serviceSubtype: "service-subtype",
    serviceDiscount: "regular",
    servicePriceOption: "standard",
    vipScope: "retail",
  };
  const cases = [
    ["purchase", { kind: "purchase", subtypeId: "purchase-subtype", details: { 收件人: "测试" } }],
    ["service", { kind: "service", subtypeId: "service-subtype", discountId: "regular", priceOptionId: "standard", details: {} }],
    ["vip_recharge", { kind: "vip_recharge", vipScope: "retail", details: {} }],
  ] as const;
  // 只核对 Web 的提交结构与金额派生，数据库仍决定各类别能否保存。
  for (const [category, supplementary] of cases) {
    const result = parseCreateOrderForm(initialForm, new Map([["type", category]]), copy);
    expect(result).toMatchObject({ ok: true, payload: { orderType: "type", transactionRate: 6.93, rmbAmount: 693, supplementary } });
  }

  const missingPrice = parseCreateOrderForm({ ...initialForm, servicePriceOption: "" }, new Map([["type", "service"]]), copy);
  expect(missingPrice).toEqual({ ok: false, message: copy.validation.selectPrompt(copy.fields.servicePrice) });
});

test("服务订单详情沿用总单的费用规则，并与列表共用舍入口径", async () => {
  const rows: Record<string, unknown> = {
    service_order_type: { business_subcategory: "test-service" },
    order_discount_type: { discount_ratio: "0.95" },
    service_order_price_option: { display_name: "test-price", amount_usd: "20" },
    service_fee_type: { fee_ratio: "0.015" },
  };
  const queries: Array<[string, string]> = [];
  const client = {
    from: (table: string) => ({ select: () => ({ eq: (_column: string, id: string) => ({
      maybeSingle: () => {
        queries.push([table, id]);
        return Promise.resolve({ data: rows[table], error: null });
      },
    }) }) }),
  } as unknown as SupabaseClient;

  const result = await getServiceOrderDetail(client, {
    id: "overview", order_number: "TEST-001", rmb_amount: "101.24", service_fee_type: "confirmed-fee",
  }, {
    order_overview_id: "overview", order_type: "service", order_discount: "discount",
    price_option_id: "price", service_fee_type: "detail-fee", order_details: null,
  });
  expect(queries).toContainEqual(["service_fee_type", "confirmed-fee"]);
  expect(queries).not.toContainEqual(["service_fee_type", "detail-fee"]);
  expect(result).toMatchObject({ orderNumber: "TEST-001", serviceFeeTypeId: "confirmed-fee", serviceFeeAmount: 1.52 });
  expect(calculateOrderServiceFeeAmount("101.24", "0.015")).toBe(result.serviceFeeAmount);
  expect(calculateOrderServiceFeeAmount("101.24", null)).toBeNull();
});
