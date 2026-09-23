"use client";

import { StatusBadge } from "@/components/ui/status-badge";

import { InteractiveButton as DesignButton } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type {
  WholesaleLinked1688Order,
  WholesaleCustomer,
  WholesaleOrderListItem,
  WholesaleOrderSettlement,
  WholesaleProfile,
} from "@/lib/wholesale";
import type { WholesaleOrderListAttachment } from "@/lib/wholesale-order-list-attachments";
import {
  formatCurrency,
  formatDateTime,
  getCustomerName,
  getProfileName,
} from "./wholesale-display";
import { WholesaleOrderDetailsDialog } from "./wholesale-order-details-dialog";
import type { WholesaleOrderEditAction } from "./wholesale-orders-table";
type WholesaleOrdersMobileListProps = {
  canMarkOrderSettled: (order: WholesaleOrderListItem) => boolean;
  canManageOrderListAttachments: (order: WholesaleOrderListItem) => boolean;
  canViewInternalFields: boolean;
  customersById: Map<string, WholesaleCustomer>;
  getOrderEditAction: (
    order: WholesaleOrderListItem,
  ) => WholesaleOrderEditAction | null;
  onDeleteOrderListAttachment: (
    attachment: WholesaleOrderListAttachment,
  ) => void | Promise<void>;
  onOpenOrderEdit: (order: WholesaleOrderListItem) => void;
  onOpenOrderSettlement: (order: WholesaleOrderListItem) => void;
  onUploadOrderListAttachments: (
    order: WholesaleOrderListItem,
    files: File[],
  ) => Promise<boolean>;
  orderListAttachmentsByOrderId: Map<string, WholesaleOrderListAttachment[]>;
  orders: WholesaleOrderListItem[];
  orderSettlementsByOrderId: Map<string, WholesaleOrderSettlement[]>;
  profilesById: Map<string, WholesaleProfile>;
  purchaseOrdersByOrderId: Map<string, WholesaleLinked1688Order[]>;
  pendingKey: string | null;
};
export function WholesaleOrdersMobileList({
  canMarkOrderSettled,
  canManageOrderListAttachments,
  canViewInternalFields,
  customersById,
  getOrderEditAction,
  onDeleteOrderListAttachment,
  onOpenOrderEdit,
  onOpenOrderSettlement,
  onUploadOrderListAttachments,
  orderListAttachmentsByOrderId,
  orders,
  orderSettlementsByOrderId,
  profilesById,
  purchaseOrdersByOrderId,
  pendingKey,
}: WholesaleOrdersMobileListProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_orders_mobile_list",
  );
  const t = useTranslations("WholesaleBusiness.ordersUi");
  const [selectedOrder, setSelectedOrder] =
    useState<WholesaleOrderListItem | null>(null);
  return (
    <div className="grid gap-3">
      {orders.map((order) => {
        const settlements = orderSettlementsByOrderId.get(order.id) ?? [];
        const settledAmount = settlements.reduce(
          (sum, settlement) => sum + Number(settlement.settlement_amount),
          0,
        );
        return (
          <DesignButton
            className="min-w-0 rounded-control-large border border-border-subtle bg-surface-interactive p-4 text-left shadow-sm transition active:scale-[0.99]"
            data-testid={`wholesale-order-card-${order.id}`}
            key={order.id}
            onClick={() => setSelectedOrder(order)}
            type="button"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-semibold text-content-muted [overflow-wrap:anywhere]">
                  {order.order_number}
                </p>
                <p className="mt-1 truncate text-sm text-content-muted">
                  {getCustomerName(customersById, order.customer_id)}
                </p>
              </div>
              {canViewInternalFields ? <StatusBadge
                tone={order.status === "settled" ? "success" : "warning"}
              >
                {t(`statuses.${order.status}`)}
              </StatusBadge> : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <MobileOrderValue
                label={uiText("attribute001")}
                value={formatCurrency(
                  order.customer_payment_amount,
                  order.customer_payment_currency,
                )}
              />
              {canViewInternalFields ? <MobileOrderValue
                label={uiText("attribute002")}
                value={`${formatCurrency(settledAmount, order.customer_payment_currency)} / ${formatCurrency(order.customer_payment_amount, order.customer_payment_currency)}`}
              /> : <MobileOrderValue
                label={t("clientColumns.courier")}
                value={order.courier_company ?? t("fallbacks.notRecorded")}
              />}
              <MobileOrderValue
                label={uiText("attribute003")}
                value={getProfileName(profilesById, order.sales_user_id)}
              />
              <MobileOrderValue
                label={uiText("attribute004")}
                value={formatDateTime(order.ordered_at)}
              />
            </div>
          </DesignButton>
        );
      })}

      {selectedOrder ? (
        <WholesaleOrderDetailsDialog
          canMarkOrderSettled={canMarkOrderSettled(selectedOrder)}
          canManageOrderListAttachments={canManageOrderListAttachments(
            selectedOrder,
          )}
          canViewInternalFields={canViewInternalFields}
          customerName={getCustomerName(
            customersById,
            selectedOrder.customer_id,
          )}
          editAction={getOrderEditAction(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
          onDeleteOrderListAttachment={onDeleteOrderListAttachment}
          onOpenOrderEdit={() => {
            setSelectedOrder(null);
            onOpenOrderEdit(selectedOrder);
          }}
          onOpenOrderSettlement={() => {
            setSelectedOrder(null);
            onOpenOrderSettlement(selectedOrder);
          }}
          onUploadOrderListAttachments={(files) =>
            onUploadOrderListAttachments(selectedOrder, files)
          }
          open
          order={selectedOrder}
          orderListAttachments={
            orderListAttachmentsByOrderId.get(selectedOrder.id) ?? []
          }
          pendingKey={pendingKey}
          purchaseOrders={purchaseOrdersByOrderId.get(selectedOrder.id) ?? []}
          salesName={getProfileName(profilesById, selectedOrder.sales_user_id)}
          settlements={orderSettlementsByOrderId.get(selectedOrder.id) ?? []}
        />
      ) : null}
    </div>
  );
}
function MobileOrderValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-control-compact bg-surface-inset px-3 py-2">
      <p className="text-xs text-content-muted">{label}</p>
      <p className="mt-1 break-words font-medium text-content-muted [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}
