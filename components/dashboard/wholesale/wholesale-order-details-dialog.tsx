"use client";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { CheckCircle2, PencilLine } from "lucide-react";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import type {
  WholesaleLinked1688Order,
  WholesaleOrderListItem,
  WholesaleOrderSettlement,
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
  WHOLESALE_ORDER_STATUS_LABELS,
} from "./wholesale-display";
import { WholesaleDetailGrid } from "./wholesale-detail-grid";
import type { WholesaleOrderEditAction } from "./wholesale-orders-table";
import { WholesaleOrderListAttachments } from "./wholesale-order-list-attachments";
type WholesaleOrderDetailsDialogProps = {
  canMarkOrderSettled: boolean;
  canManageOrderListAttachments: boolean;
  canViewInternalFields: boolean;
  customerName: string;
  editAction: WholesaleOrderEditAction | null;
  onClose: () => void;
  onDeleteOrderListAttachment: (
    attachment: WholesaleOrderListAttachment,
  ) => void | Promise<void>;
  onOpenOrderEdit: () => void;
  onOpenOrderSettlement: () => void;
  onUploadOrderListAttachments: (files: File[]) => Promise<boolean>;
  open: boolean;
  order: WholesaleOrderListItem;
  orderListAttachments: WholesaleOrderListAttachment[];
  pendingKey: string | null;
  purchaseOrders: WholesaleLinked1688Order[];
  salesName: string;
  settlements: WholesaleOrderSettlement[];
};
export function WholesaleOrderDetailsDialog({
  canMarkOrderSettled,
  canManageOrderListAttachments,
  canViewInternalFields,
  customerName,
  editAction,
  onClose,
  onDeleteOrderListAttachment,
  onOpenOrderEdit,
  onOpenOrderSettlement,
  onUploadOrderListAttachments,
  open,
  order,
  orderListAttachments,
  pendingKey,
  purchaseOrders,
  salesName,
  settlements,
}: WholesaleOrderDetailsDialogProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_order_details_dialog",
  );
  const t = useTranslations("WholesaleBusiness.ordersUi");
  const orderListText = useTranslations("WholesaleBusiness.ordersUi.orderList");
  const settledAmount = settlements.reduce(
    (sum, settlement) => sum + Number(settlement.settlement_amount),
    0,
  );
  return (
    <DashboardDialog
      actions={
        editAction || canMarkOrderSettled ? (
          <div className="flex flex-wrap gap-2">
            {editAction ? (
              <Button
                size="default"
                onClick={onOpenOrderEdit}
                type="button"
                variant="outline"
              >
                <PencilLine className="size-4" />
                {editAction.label}
              </Button>
            ) : null}
            {canMarkOrderSettled ? (
              <Button
                variant="primary"
                size="default"
                onClick={onOpenOrderSettlement}
                type="button"
              >
                <CheckCircle2 className="size-4" />
                <UiMessage id="components_dashboard_wholesale_wholesale_order_details_dialog.text001" />
              </Button>
            ) : null}
          </div>
        ) : null
      }
      description={canViewInternalFields ? uiText("attribute001") : t("clientDetailDescription")}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      open={open}
      title={`订单 ${order.order_number}`}
    >
      <div className="space-y-6">
        <DetailGroup title={uiText("attribute002")}>
          <WholesaleDetailGrid
            rows={[
              { label: "客户", value: customerName },
              { label: "业务员", value: salesName },
              ...(canViewInternalFields ? [{
                label: "状态",
                value: WHOLESALE_ORDER_STATUS_LABELS[order.status],
              }] : [{
                label: t("clientColumns.courier"),
                value: order.courier_company ?? t("fallbacks.notRecorded"),
              }]),
              { label: "下单时间", value: formatDateTime(order.ordered_at) },
              {
                label: "客户支付",
                value: formatCurrency(
                  order.customer_payment_amount,
                  order.customer_payment_currency,
                ),
              },
              ...(canViewInternalFields
                ? [
                    {
                      label: "收款平台",
                      value: order.payment_platform ?? "未记录",
                    },
                  ]
                : []),
            ]}
          />
        </DetailGroup>

        {canViewInternalFields ? <DetailGroup title={uiText("attribute003")}>
          <WholesaleDetailGrid
            rows={[
              {
                label: "小单数量",
                value: formatNumber(order.small_order_count),
              },
              ...(canViewInternalFields
                ? [
                    {
                      label: "产品采购金额",
                      value: formatCurrency(order.product_purchase_amount),
                    },
                  ]
                : []),
              { label: "打包费", value: formatCurrency(order.packing_fee) },
              ...(canViewInternalFields
                ? [
                    {
                      label: "国际运费",
                      value: formatCurrency(order.international_shipping_fee),
                    },
                    {
                      label: "其他费用",
                      value: formatCurrency(order.other_fee),
                    },
                    {
                      label: "推荐佣金费用",
                      value: formatCurrency(order.referral_commission_fee),
                    },
                  ]
                : []),
              {
                label: "毛利",
                value: formatOptionalCurrency(order.gross_profit),
              },
              { label: "毛利率", value: formatPercent(order.gross_margin) },
              {
                label: "单位毛利",
                value: formatOptionalCurrency(order.unit_gross_profit),
              },
            ]}
          />
        </DetailGroup> : null}

        {canViewInternalFields ? <DetailGroup title={uiText("attribute004")}>
          <p className="mb-3 text-sm text-content-muted">
            <UiMessage id="components_dashboard_wholesale_wholesale_order_details_dialog.text002" />
            {formatCurrency(settledAmount, order.customer_payment_currency)}
            <UiMessage id="components_dashboard_wholesale_wholesale_order_details_dialog.text003" />{" "}
            {formatCurrency(
              Math.max(order.customer_payment_amount - settledAmount, 0),
              order.customer_payment_currency,
            )}
          </p>
          {settlements.length > 0 ? (
            <div className="grid gap-2">
              {settlements.map((settlement) => (
                <div
                  className="rounded-control-default bg-surface-inset p-3 text-sm text-content-muted"
                  key={settlement.id}
                >
                  <p className="font-semibold text-content-muted">
                    {formatDate(settlement.settled_on)}
                  </p>
                  <p className="mt-1">
                    {formatCurrency(
                      settlement.settlement_amount,
                      order.customer_payment_currency,
                    )}{" "}
                    <UiMessage id="components_dashboard_wholesale_wholesale_order_details_dialog.text004" />
                    {formatRate(settlement.settlement_exchange_rate)} ·{" "}
                    {formatCurrency(settlement.settlement_rmb_amount)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-content-muted">
              <UiMessage id="components_dashboard_wholesale_wholesale_order_details_dialog.text005" />
            </p>
          )}
        </DetailGroup> : null}

        {canViewInternalFields ? <DetailGroup title={uiText("attribute005")}>
          <RecordLabels
            emptyText={uiText("attribute006")}
            labels={purchaseOrders.map((item) => item.external_order_number)}
          />
        </DetailGroup> : null}

        <DetailGroup title={orderListText("title")}>
          <WholesaleOrderListAttachments
            attachments={orderListAttachments}
            canManage={canManageOrderListAttachments}
            onDelete={onDeleteOrderListAttachment}
            onUpload={onUploadOrderListAttachments}
            orderId={order.id}
            orderNumber={order.order_number}
            pendingKey={pendingKey}
          />
        </DetailGroup>

        <DetailGroup title={uiText("attribute008")}>
          <p className="break-words text-sm leading-6 text-content-muted [overflow-wrap:anywhere]">
            {order.notes ?? "未记录备注。"}
          </p>
        </DetailGroup>
      </div>
    </DashboardDialog>
  );
}
function DetailGroup({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-content-muted">{title}</h3>
      {children}
    </section>
  );
}
function RecordLabels({
  emptyText,
  labels,
}: {
  emptyText: string;
  labels: string[];
}) {
  if (labels.length === 0) {
    return <p className="text-sm text-content-muted">{emptyText}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => (
        <span
          className="max-w-full break-words rounded-full bg-status-info-soft px-3 py-1.5 text-xs font-semibold text-primary [overflow-wrap:anywhere]"
          key={label}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
