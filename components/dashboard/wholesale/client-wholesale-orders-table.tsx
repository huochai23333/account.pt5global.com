"use client";

import { useTranslations } from "next-intl";

import type { WholesaleOrderListItem, WholesaleProfile } from "@/lib/wholesale";
import type { WholesaleOrderListAttachment } from "@/lib/wholesale-order-list-attachments";

import { formatCurrency, formatDateTime, getProfileName } from "./wholesale-display";
import { WholesaleOrderListAttachments } from "./wholesale-order-list-attachments";
import { WholesaleTable, WholesaleTd, WholesaleTh } from "./wholesale-ui";

/** 客户只看到履约所需的订单资料；内部结汇和采购列由独立的后台表格展示。 */
export function ClientWholesaleOrdersTable({
  orders,
  orderListAttachmentsByOrderId,
  profilesById,
}: {
  orders: WholesaleOrderListItem[];
  orderListAttachmentsByOrderId: Map<string, WholesaleOrderListAttachment[]>;
  profilesById: Map<string, WholesaleProfile>;
}) {
  const t = useTranslations("WholesaleBusiness.ordersUi");
  return (
    <WholesaleTable minWidth={930}>
      <thead>
        <tr>
          <WholesaleTh>{t("clientColumns.orderNumber")}</WholesaleTh>
          <WholesaleTh>{t("clientColumns.orderedAt")}</WholesaleTh>
          <WholesaleTh>{t("clientColumns.payment")}</WholesaleTh>
          <WholesaleTh>{t("clientColumns.courier")}</WholesaleTh>
          <WholesaleTh>{t("clientColumns.contact")}</WholesaleTh>
          <WholesaleTh>{t("orderList.title")}</WholesaleTh>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr data-testid={`wholesale-order-row-${order.id}`} key={order.id}>
            <WholesaleTd className="font-semibold">{order.order_number}</WholesaleTd>
            <WholesaleTd>{formatDateTime(order.ordered_at)}</WholesaleTd>
            <WholesaleTd>
              {formatCurrency(order.customer_payment_amount, order.customer_payment_currency)}
            </WholesaleTd>
            <WholesaleTd>{order.courier_company ?? t("fallbacks.notRecorded")}</WholesaleTd>
            <WholesaleTd>{getProfileName(profilesById, order.sales_user_id)}</WholesaleTd>
            <WholesaleTd className="min-w-[220px] whitespace-normal">
              <WholesaleOrderListAttachments
                attachments={orderListAttachmentsByOrderId.get(order.id) ?? []}
                canManage={false}
                compact
                onDelete={() => undefined}
                onUpload={async () => false}
                orderId={order.id}
                orderNumber={order.order_number}
                pendingKey={null}
              />
            </WholesaleTd>
          </tr>
        ))}
      </tbody>
    </WholesaleTable>
  );
}
