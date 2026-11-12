import type { WholesaleOrderListItem } from "@/lib/wholesale";

import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatOptionalCurrency,
  formatPercent,
} from "./wholesale-display";

type Translate = (key: string) => string;

export function buildWholesaleOrderBasicRows({
  canViewInternalFields,
  customerName,
  order,
  salesName,
  t,
}: {
  canViewInternalFields: boolean;
  customerName: string;
  order: WholesaleOrderListItem;
  salesName: string;
  t: Translate;
}) {
  const notRecorded = t("fallbacks.notRecorded");
  return [
    { label: t("compactColumns.customer"), value: customerName },
    { label: t("detailFields.salesperson"), value: salesName },
    // 客户模式只拿到安全投影，不能从缺失的内部字段推测订单状态。
    canViewInternalFields
      ? { label: t("detailFields.status"), value: t(`statuses.${order.status}`) }
      : { label: t("clientColumns.courier"), value: order.courier_company ?? notRecorded },
    { label: t("clientColumns.orderedAt"), value: formatDateTime(order.ordered_at, notRecorded) },
    {
      label: t("detailFields.payment"),
      value: formatCurrency(order.customer_payment_amount, order.customer_payment_currency),
    },
    ...(canViewInternalFields
      ? [{ label: t("detailFields.platform"), value: order.payment_platform ?? notRecorded }]
      : []),
  ];
}

// 费用明细直接展示已保存字段。预览与权威金额的计算各有入口，详情不重复计算。
export function buildWholesaleOrderCostRows(order: WholesaleOrderListItem, t: Translate) {
  return [
    { label: t("detailFields.smallOrderCount"), value: formatNumber(order.small_order_count) },
    { label: t("detailFields.purchase"), value: formatCurrency(order.product_purchase_amount) },
    { label: t("detailFields.packing"), value: formatCurrency(order.packing_fee) },
    { label: t("detailFields.shipping"), value: formatCurrency(order.international_shipping_fee) },
    { label: t("fees.serviceFee"), value: formatCurrency(order.service_fee) },
    { label: t("fees.cnTaxFee"), value: formatCurrency(order.cn_tax_fee) },
    { label: t("fees.paymentProcessingFee"), value: formatCurrency(order.payment_processing_fee) },
    { label: t("detailFields.otherFee"), value: formatCurrency(order.other_fee) },
    { label: t("detailFields.referralFee"), value: formatCurrency(order.referral_commission_fee) },
    {
      label: t("detailFields.profit"),
      value: formatOptionalCurrency(order.gross_profit, t("fallbacks.afterSettlement")),
    },
    {
      label: t("detailFields.margin"),
      value: formatPercent(order.gross_margin, t("fallbacks.notGenerated")),
    },
  ];
}
