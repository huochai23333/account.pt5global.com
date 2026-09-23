"use client";
import { UiMessage } from "@/components/i18n/ui-message";
import { CheckCircle2, LoaderCircle, PencilLine } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  MOTION_DURATION,
  MOTION_EASING,
  getMotionStaggerDelay,
} from "@/lib/motion-tokens";
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
  formatDate,
  formatDateTime,
  formatNumber,
  formatOptionalCurrency,
  formatPercent,
  formatRate,
  getCustomerName,
  getProfileName,
} from "./wholesale-display";
import { LinkedPurchaseOrders } from "./wholesale-order-linked-records";
import { WholesaleOrderListAttachments } from "./wholesale-order-list-attachments";
import { WholesaleOrderSettlementRecordsCell } from "./wholesale-order-settlement-records-cell";
import {
  WholesaleTable,
  WholesaleTd,
  WholesaleTh,
  wholesaleStickyFirstTdClassName,
  wholesaleStickyFirstThClassName,
} from "./wholesale-ui";
export type WholesaleOrderEditAction = {
  label: string;
};
export type WholesaleOrdersTableProps = {
  canMarkOrderSettled: (order: WholesaleOrderListItem) => boolean;
  canManageOrderListAttachments: (order: WholesaleOrderListItem) => boolean;
  canViewInternalFields: boolean;
  customersById: Map<string, WholesaleCustomer>;
  getOrderEditAction: (
    order: WholesaleOrderListItem,
  ) => WholesaleOrderEditAction | null;
  orderSettlementsByOrderId: Map<string, WholesaleOrderSettlement[]>;
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
  pendingKey: string | null;
  profilesById: Map<string, WholesaleProfile>;
  purchaseOrdersByOrderId: Map<string, WholesaleLinked1688Order[]>;
};
export function WholesaleOrdersTable({
  canMarkOrderSettled,
  canManageOrderListAttachments,
  canViewInternalFields,
  customersById,
  getOrderEditAction,
  onDeleteOrderListAttachment,
  orderSettlementsByOrderId,
  onOpenOrderEdit,
  onOpenOrderSettlement,
  onUploadOrderListAttachments,
  orderListAttachmentsByOrderId,
  orders,
  pendingKey,
  profilesById,
  purchaseOrdersByOrderId,
}: WholesaleOrdersTableProps) {
  const t = useTranslations("WholesaleBusiness.ordersUi");
  return (
    <WholesaleTable minWidth={canViewInternalFields ? 3540 : 2460}>
      <thead>
        <tr>
          <WholesaleTh className={wholesaleStickyFirstThClassName}>
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text001" />
          </WholesaleTh>
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text002" />
          </WholesaleTh>
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text003" />
          </WholesaleTh>
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text004" />
          </WholesaleTh>
          {canViewInternalFields ? (
            <WholesaleTh>
              <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text005" />
            </WholesaleTh>
          ) : null}
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text006" />
          </WholesaleTh>
          {canViewInternalFields ? (
            <>
              <WholesaleTh>
                <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text007" />
              </WholesaleTh>
              <WholesaleTh>
                <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text008" />
              </WholesaleTh>
              <WholesaleTh>
                <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text009" />
              </WholesaleTh>
            </>
          ) : null}
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text010" />
          </WholesaleTh>
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text011" />
          </WholesaleTh>
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text012" />
          </WholesaleTh>
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text013" />
          </WholesaleTh>
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text014" />
          </WholesaleTh>
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text015" />
          </WholesaleTh>
          {canViewInternalFields ? (
            <WholesaleTh>
              <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text016" />
            </WholesaleTh>
          ) : null}
          {canViewInternalFields ? <>
            <WholesaleTh><UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text017" /></WholesaleTh>
            <WholesaleTh><UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text018" /></WholesaleTh>
            <WholesaleTh><UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text019" /></WholesaleTh>
          </> : null}
          {canViewInternalFields ? (
            <WholesaleTh>
              <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text020" />
            </WholesaleTh>
          ) : null}
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text021" />
          </WholesaleTh>
          <WholesaleTh>
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text022" />
          </WholesaleTh>
          <WholesaleTh className="min-w-[300px] whitespace-normal">
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text023" />
          </WholesaleTh>
          <WholesaleTh className="min-w-[320px] whitespace-normal">
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text024" />
          </WholesaleTh>
          <WholesaleTh className="min-w-[260px] whitespace-normal">
            {t("orderList.title")}
          </WholesaleTh>
          <WholesaleTh className="min-w-[240px] whitespace-normal">
            <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text026" />
          </WholesaleTh>
        </tr>
      </thead>
      <tbody>
        <AnimatePresence initial={false}>
          {orders.map((order, index) => {
            const editAction = getOrderEditAction(order);
            const settlements = orderSettlementsByOrderId.get(order.id) ?? [];
            const settledAmount = settlements.reduce(
              (sum, settlement) => sum + Number(settlement.settlement_amount),
              0,
            );
            const remainingAmount = Math.max(
              Number(order.customer_payment_amount) - settledAmount,
              0,
            );
            return (
              <motion.tr
                animate={{ opacity: 1, y: 0 }}
                className="group"
                data-testid={`wholesale-order-row-${order.id}`}
                exit={{ opacity: 0, y: -4 }}
                initial={{ opacity: 0, y: 8 }}
                key={order.id}
                layout="position"
                transition={{
                  delay: getMotionStaggerDelay(index),
                  duration: MOTION_DURATION.standard,
                  ease: MOTION_EASING.enter,
                }}
              >
                <WholesaleTd
                  className={`${wholesaleStickyFirstTdClassName} min-w-[230px] px-4 py-3`}
                >
                  <div className="space-y-2">
                    <div className="font-semibold [overflow-wrap:anywhere]">
                      {order.order_number}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {editAction ? (
                        <Button
                          onClick={() => onOpenOrderEdit(order)}
                          size="compact"
                          type="button"
                          variant="outline"
                        >
                          <PencilLine className="size-3.5" />
                          {editAction.label}
                        </Button>
                      ) : null}
                      {canMarkOrderSettled(order) ? (
                        <Button
                          variant="primary"
                          size="compact"
                          data-testid={`wholesale-order-settle-${order.id}`}
                          disabled={pendingKey === `order:settle:${order.id}`}
                          onClick={() => onOpenOrderSettlement(order)}
                          type="button"
                        >
                          {pendingKey === `order:settle:${order.id}` ? (
                            <LoaderCircle className="size-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-3.5" />
                          )}
                          <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text027" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </WholesaleTd>
                <WholesaleTd className="min-w-[160px] whitespace-normal">
                  {getCustomerName(customersById, order.customer_id)}
                </WholesaleTd>
                <WholesaleTd className="min-w-[150px] whitespace-normal">
                  {getProfileName(profilesById, order.sales_user_id)}
                </WholesaleTd>
                <WholesaleTd>
                  {formatNumber(order.small_order_count)}
                </WholesaleTd>
                {canViewInternalFields ? (
                  <WholesaleTd>
                    {formatCurrency(order.product_purchase_amount)}
                  </WholesaleTd>
                ) : null}
                <WholesaleTd>{formatCurrency(order.packing_fee)}</WholesaleTd>
                {canViewInternalFields ? (
                  <>
                    <WholesaleTd>
                      {formatCurrency(order.international_shipping_fee)}
                    </WholesaleTd>
                    <WholesaleTd>{formatCurrency(order.other_fee)}</WholesaleTd>
                    <WholesaleTd>
                      {formatCurrency(order.referral_commission_fee)}
                    </WholesaleTd>
                  </>
                ) : null}
                <WholesaleTd className="min-w-[140px] whitespace-normal">
                  {order.courier_company ?? t("fallbacks.notRecorded")}
                </WholesaleTd>
                <WholesaleTd className="min-w-[160px] whitespace-normal">
                  <div>
                    <p>
                      <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text028" />
                      {formatCurrency(
                        settledAmount,
                        order.customer_payment_currency,
                      )}
                    </p>
                    <p className="mt-1 text-xs text-content-muted">
                      <UiMessage id="components_dashboard_wholesale_wholesale_orders_table.text029" />
                      {formatCurrency(
                        remainingAmount,
                        order.customer_payment_currency,
                      )}
                    </p>
                  </div>
                </WholesaleTd>
                <WholesaleTd>
                  {order.settlement_exchange_rate === null ||
                  order.settlement_exchange_rate === undefined
                    ? t("fallbacks.unsettled")
                    : formatRate(order.settlement_exchange_rate)}
                </WholesaleTd>
                <WholesaleTd>{order.customer_payment_currency}</WholesaleTd>
                <WholesaleTd>
                  {formatCurrency(
                    order.customer_payment_amount,
                    order.customer_payment_currency,
                  )}
                </WholesaleTd>
                <WholesaleTd>
                  {formatOptionalCurrency(
                    order.customer_payment_rmb_amount,
                    t("fallbacks.afterSettlement"),
                  )}
                </WholesaleTd>
                {canViewInternalFields ? (
                  <WholesaleTd className="min-w-[140px] whitespace-normal">
                    {order.payment_platform ?? t("fallbacks.notRecorded")}
                  </WholesaleTd>
                ) : null}
                {canViewInternalFields ? <>
                  <WholesaleTd>{formatOptionalCurrency(order.gross_profit, t("fallbacks.afterSettlement"))}</WholesaleTd>
                  <WholesaleTd>{formatPercent(order.gross_margin, t("fallbacks.notGenerated"))}</WholesaleTd>
                  <WholesaleTd>{formatOptionalCurrency(order.unit_gross_profit, t("fallbacks.afterSettlement"))}</WholesaleTd>
                </> : null}
                {canViewInternalFields ? (
                  <WholesaleTd>{formatDate(order.order_month)}</WholesaleTd>
                ) : null}
                <WholesaleTd>{formatDateTime(order.ordered_at)}</WholesaleTd>
                <WholesaleTd>
                  {order.settled_at
                    ? formatDateTime(order.settled_at)
                    : t("fallbacks.unsettled")}
                </WholesaleTd>
                <WholesaleTd className="min-w-[300px] whitespace-normal">
                  <WholesaleOrderSettlementRecordsCell
                    currency={order.customer_payment_currency}
                    settlements={settlements}
                  />
                </WholesaleTd>
                <WholesaleTd className="min-w-[320px] whitespace-normal">
                  <LinkedPurchaseOrders
                    canViewInternalFields={canViewInternalFields}
                    profilesById={profilesById}
                    purchaseOrders={purchaseOrdersByOrderId.get(order.id) ?? []}
                  />
                </WholesaleTd>
                <WholesaleTd className="min-w-[260px] whitespace-normal">
                  <WholesaleOrderListAttachments
                    attachments={
                      orderListAttachmentsByOrderId.get(order.id) ?? []
                    }
                    canManage={canManageOrderListAttachments(order)}
                    compact
                    onDelete={onDeleteOrderListAttachment}
                    onUpload={(files) =>
                      onUploadOrderListAttachments(order, files)
                    }
                    orderId={order.id}
                    orderNumber={order.order_number}
                    pendingKey={pendingKey}
                  />
                </WholesaleTd>
                <WholesaleTd className="min-w-[240px] whitespace-normal">
                  {order.notes ?? t("fallbacks.notRecorded")}
                </WholesaleTd>
              </motion.tr>
            );
          })}
        </AnimatePresence>
      </tbody>
    </WholesaleTable>
  );
}
