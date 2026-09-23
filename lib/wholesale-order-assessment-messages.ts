import type { ChatCompletionMessageParam } from "@/lib/ai-assistant/deepseek-client";
import { getCompanyText } from "@/lib/company-config";
import type { WholesaleOrder } from "@/lib/wholesale";

import type {
  WholesaleOrderAssessmentData,
  WholesaleOrderAssessmentFilters,
} from "./wholesale-order-assessment-types";

const ALL = "all";
const MAX_ORDER_EXAMPLES = 24;

/**
 * 把筛选后的业务数据压缩成汇总、主要客户和少量订单样例。
 * 这样既能给评估模型足够上下文，也不会把整张业务表直接塞进提示词。
 */
export function buildWholesaleOrderAssessmentMessages({
  data,
  filters,
  orders,
}: {
  data: WholesaleOrderAssessmentData;
  filters: WholesaleOrderAssessmentFilters;
  orders: WholesaleOrder[];
}): ChatCompletionMessageParam[] {
  const customersById = new Map(
    data.customers.map((customer) => [customer.id, customer]),
  );
  const profilesById = new Map(
    data.profiles.map((profile) => [profile.user_id, profile]),
  );
  const purchaseOrderCount = countLinkedRecords(
    data.orderPage?.purchaseOrders ?? [],
    orders,
  );
  const summary = buildOrderSummary({
    fullSummary: data.orderPage?.summary ?? null,
    orders,
    purchaseOrderCount,
  });
  const topCustomers = buildTopCustomerSummaries(orders, customersById);
  const examples = orders.slice(0, MAX_ORDER_EXAMPLES).map((order) => {
    const customerName =
      customersById.get(order.customer_id)?.unique_name ?? "未归属客户";
    const salesProfile = order.sales_user_id
      ? profilesById.get(order.sales_user_id)
      : null;
    const salesName = salesProfile?.name || salesProfile?.email || "未分配";
    return {
      "业务员": salesName,
      "下单时间": formatDateTimeForPrompt(order.ordered_at),
      "人民币金额": roundMoney(order.customer_payment_rmb_amount),
      "客户": customerName,
      "毛利": roundMoney(order.gross_profit),
      "毛利率": formatPercentForPrompt(order.gross_margin),
      "状态": getStatusLabel(order.status),
      "订单编号": order.order_number,
    };
  });
  const companyText = getCompanyText("zh");

  return [
    {
      role: "system",
      content: [
        `你是${companyText.productName}里的批发业务订单评估助手。`,
        "你只基于用户当前可见的批发订单统计做评估，不要编造未提供的数据。",
        "用简体中文，口吻直接、务实，面向业务负责人。",
        "不要提数据库、接口、模型、JSON、字段名、token、权限系统等技术词。",
        "输出只能使用普通中文段落和短句换行，不要使用星号、井号、反引号、Markdown 标记、符号列表或表格。",
        "评估必须覆盖：订单数量、状态分布、各类总金额、毛利表现、明显风险点、下一步建议。",
        "如果订单数量为 0，直接说明当前范围没有订单，无法评估金额和状态。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "请评估以下批发业务订单范围：",
        "",
        `筛选范围：${buildFilterDescription(filters, customersById, profilesById)}`,
        "",
        "汇总数据：",
        JSON.stringify(summary, null, 2),
        "",
        "主要客户：",
        JSON.stringify(topCustomers, null, 2),
        "",
        "订单样例：",
        JSON.stringify(examples, null, 2),
      ].join("\n"),
    },
  ];
}

function buildOrderSummary({
  fullSummary,
  orders,
  purchaseOrderCount,
}: {
  fullSummary: WholesaleOrderAssessmentData["orderPage"] extends infer Page
    ? Page extends { summary: infer Summary }
      ? Summary | null
      : null
    : null;
  orders: WholesaleOrder[];
  purchaseOrderCount: number;
}) {
  const totalPayment =
    fullSummary?.customerPaymentRmbAmount ??
    sumOrders(orders, "customer_payment_rmb_amount");
  const totalProfit =
    fullSummary?.grossProfitAmount ?? sumOrders(orders, "gross_profit");
  const settledCount =
    fullSummary?.settledCount ??
    orders.filter((order) => order.status === "settled").length;
  const partialSettledCount =
    fullSummary?.partialSettledCount ??
    orders.filter((order) => order.status === "partial_settled").length;
  const unsettledCount =
    fullSummary?.unsettledCount ??
    orders.length - settledCount - partialSettledCount;

  return {
    "其他费用合计": roundMoney(
      fullSummary?.otherFeeAmount ?? sumOrders(orders, "other_fee"),
    ),
    "国际运费合计": roundMoney(
      fullSummary?.internationalShippingFeeAmount ??
        sumOrders(orders, "international_shipping_fee"),
    ),
    "客户支付人民币合计": roundMoney(totalPayment),
    "已结汇订单": settledCount,
    "部分结汇订单": partialSettledCount,
    "平均毛利率": formatPercentForPrompt(
      fullSummary?.averageMargin ??
        (totalPayment > 0 ? totalProfit / totalPayment : null),
    ),
    "总毛利": roundMoney(totalProfit),
    "打包费合计": roundMoney(
      fullSummary?.packingFeeAmount ?? sumOrders(orders, "packing_fee"),
    ),
    "推荐佣金费用合计": roundMoney(
      fullSummary?.referralCommissionFeeAmount ??
        sumOrders(orders, "referral_commission_fee"),
    ),
    "未结汇订单": unsettledCount,
    "订单数量": fullSummary?.orderCount ?? orders.length,
    "采购订单数量": purchaseOrderCount,
    "产品采购金额合计": roundMoney(
      fullSummary?.productPurchaseAmount ??
        sumOrders(orders, "product_purchase_amount"),
    ),
  };
}

function buildTopCustomerSummaries(
  orders: WholesaleOrder[],
  customersById: Map<string, { unique_name: string }>,
) {
  const rows = new Map<
    string,
    { count: number; name: string; payment: number; profit: number }
  >();

  for (const order of orders) {
    const current = rows.get(order.customer_id) ?? {
      count: 0,
      name: customersById.get(order.customer_id)?.unique_name ?? "未归属客户",
      payment: 0,
      profit: 0,
    };
    current.count += 1;
    current.payment += Number(order.customer_payment_rmb_amount ?? 0);
    current.profit += Number(order.gross_profit ?? 0);
    rows.set(order.customer_id, current);
  }

  return [...rows.values()]
    .sort((left, right) => right.payment - left.payment)
    .slice(0, 5)
    .map((row) => ({
      "客户": row.name,
      "毛利": roundMoney(row.profit),
      "订单数": row.count,
      "客户支付人民币": roundMoney(row.payment),
    }));
}

function countLinkedRecords<Row extends { wholesale_order_id: string | null }>(
  rows: Row[],
  orders: WholesaleOrder[],
) {
  const orderIds = new Set(orders.map((order) => order.id));
  return rows.filter(
    (row) => row.wholesale_order_id && orderIds.has(row.wholesale_order_id),
  ).length;
}

function sumOrders(orders: WholesaleOrder[], key: keyof WholesaleOrder) {
  return orders.reduce((sum, order) => sum + Number(order[key] ?? 0), 0);
}

function buildFilterDescription(
  filters: WholesaleOrderAssessmentFilters,
  customersById: Map<string, { unique_name: string }>,
  profilesById: Map<string, { email: string | null; name: string | null }>,
) {
  const parts = [
    `下单日期：${formatDateRange(filters.orderedFromDate, filters.orderedToDate)}`,
    `计入月份：${filters.orderMonth || "全部月份"}`,
    `状态：${formatStatusFilter(filters.status)}`,
    `客户：${formatCustomerFilter(filters.customerId, customersById)}`,
    `业务员：${formatSalesFilter(filters.salesUserId, profilesById)}`,
  ];
  if (filters.searchText) parts.push(`搜索：${filters.searchText}`);
  return parts.join("；");
}

function formatDateRange(fromDate: string, toDate: string) {
  if (fromDate && toDate) return `${fromDate} 至 ${toDate}`;
  if (fromDate) return `${fromDate} 之后`;
  if (toDate) return `${toDate} 之前`;
  return "全部日期";
}

function formatStatusFilter(status: string) {
  return status === "settled" ||
    status === "partial_settled" ||
    status === "unsettled"
    ? getStatusLabel(status)
    : "全部状态";
}

function getStatusLabel(status: WholesaleOrder["status"]) {
  switch (status) {
    case "settled":
      return "已结汇";
    case "partial_settled":
      return "部分结汇";
    case "unsettled":
      return "未结汇";
  }
}

function formatCustomerFilter(
  customerId: string,
  customersById: Map<string, { unique_name: string }>,
) {
  return customerId === ALL
    ? "全部客户"
    : (customersById.get(customerId)?.unique_name ?? "指定客户");
}

function formatSalesFilter(
  salesUserId: string,
  profilesById: Map<string, { email: string | null; name: string | null }>,
) {
  if (salesUserId === ALL) return "全部业务员";
  const profile = profilesById.get(salesUserId);
  return profile?.name || profile?.email || "指定业务员";
}

function roundMoney(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
}

function formatPercentForPrompt(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "未产生";
  }
  return `${(value * 100).toFixed(2)}%`;
}

function formatDateTimeForPrompt(value: string | null | undefined) {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未记录";
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
