"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { WholesaleOrderListItem } from "@/lib/wholesale";

import { formatCurrency, formatDateTime, getCustomerName, getProfileName } from "./wholesale-display";
import { WholesaleOrderDetailsDialog } from "./wholesale-order-details-dialog";
import type { WholesaleOrdersTableProps } from "./wholesale-orders-table";
import { WholesaleTable, WholesaleTd, WholesaleTh } from "./wholesale-ui";

/** 常查字段保持在一屏内；费用、采购和附件仍可从每行详情查看。 */
export function WholesaleOrdersCompactTable(props: WholesaleOrdersTableProps) {
  const t = useTranslations("WholesaleBusiness.ordersUi");
  const [selectedOrder, setSelectedOrder] = useState<WholesaleOrderListItem | null>(null);
  return (
    <>
      <WholesaleTable minWidth={1060}>
        <thead>
          <tr>
            <WholesaleTh>{t("compactColumns.order")}</WholesaleTh>
            <WholesaleTh>{t("compactColumns.customer")}</WholesaleTh>
            <WholesaleTh>{t("compactColumns.orderedAt")}</WholesaleTh>
            <WholesaleTh>{t("compactColumns.payment")}</WholesaleTh>
            <WholesaleTh>{t("compactColumns.courier")}</WholesaleTh>
            <WholesaleTh>{t("compactColumns.settlement")}</WholesaleTh>
            <WholesaleTh>{t("compactColumns.actions")}</WholesaleTh>
          </tr>
        </thead>
        <tbody>
          {props.orders.map((order) => (
            <tr data-testid={`wholesale-order-row-${order.id}`} key={order.id}>
              <WholesaleTd className="font-semibold">{order.order_number}</WholesaleTd>
              <WholesaleTd className="max-w-[160px] truncate">
                {getCustomerName(props.customersById, order.customer_id)}
              </WholesaleTd>
              <WholesaleTd>{formatDateTime(order.ordered_at)}</WholesaleTd>
              <WholesaleTd>
                {formatCurrency(order.customer_payment_amount, order.customer_payment_currency)}
              </WholesaleTd>
              <WholesaleTd>{order.courier_company ?? t("fallbacks.notRecorded")}</WholesaleTd>
              <WholesaleTd>{t(`statuses.${order.status}`)}</WholesaleTd>
              <WholesaleTd>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setSelectedOrder(order)} size="compact" type="button" variant="outline">
                    {t("compactColumns.details")}
                  </Button>
                  {props.getOrderEditAction(order) ? (
                    <Button onClick={() => props.onOpenOrderEdit(order)} size="compact" type="button" variant="outline">
                      {props.getOrderEditAction(order)?.label}
                    </Button>
                  ) : null}
                  {props.canMarkOrderSettled(order) ? (
                    <Button
                      data-testid={`wholesale-order-settle-${order.id}`}
                      onClick={() => props.onOpenOrderSettlement(order)}
                      size="compact"
                      type="button"
                      variant="outline"
                    >
                      {t("compactColumns.markSettled")}
                    </Button>
                  ) : null}
                </div>
              </WholesaleTd>
            </tr>
          ))}
        </tbody>
      </WholesaleTable>
      {selectedOrder ? (
        <WholesaleOrderDetailsDialog
          canMarkOrderSettled={props.canMarkOrderSettled(selectedOrder)}
          canManageOrderListAttachments={props.canManageOrderListAttachments(selectedOrder)}
          canViewInternalFields
          customerName={getCustomerName(props.customersById, selectedOrder.customer_id)}
          editAction={props.getOrderEditAction(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
          onDeleteOrderListAttachment={props.onDeleteOrderListAttachment}
          onOpenOrderEdit={() => {
            setSelectedOrder(null);
            props.onOpenOrderEdit(selectedOrder);
          }}
          onOpenOrderSettlement={() => {
            setSelectedOrder(null);
            props.onOpenOrderSettlement(selectedOrder);
          }}
          onUploadOrderListAttachments={(files) => props.onUploadOrderListAttachments(selectedOrder, files)}
          open
          order={selectedOrder}
          orderListAttachments={props.orderListAttachmentsByOrderId.get(selectedOrder.id) ?? []}
          pendingKey={props.pendingKey}
          purchaseOrders={props.purchaseOrdersByOrderId.get(selectedOrder.id) ?? []}
          salesName={getProfileName(props.profilesById, selectedOrder.sales_user_id)}
          settlements={props.orderSettlementsByOrderId.get(selectedOrder.id) ?? []}
        />
      ) : null}
    </>
  );
}
