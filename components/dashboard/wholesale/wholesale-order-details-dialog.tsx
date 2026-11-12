"use client";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { CheckCircle2, PencilLine } from "lucide-react";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import type {
  WholesaleOrderListItem,
  WholesaleOrderSettlement,
} from "@/lib/wholesale";
import type { WholesaleOrderListAttachment } from "@/lib/wholesale-order-list-attachments";
import {
  formatCurrency,
  formatDate,
  formatRate,
} from "./wholesale-display";
import { WholesaleDetailGrid } from "./wholesale-detail-grid";
import { buildWholesaleOrderBasicRows, buildWholesaleOrderCostRows } from "./wholesale-order-detail-rows";
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
          // 窄屏允许整颗按钮换行，按钮内的长译文也要能在操作区内折行。
          <div className="flex min-w-0 max-w-full flex-wrap gap-2">
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
                className="max-w-full"
                variant="primary"
                size="default"
                onClick={onOpenOrderSettlement}
                type="button"
                wrap
              >
                <CheckCircle2 className="size-4" />
                <span className="min-w-0">
                  <UiMessage id="components_dashboard_wholesale_wholesale_order_details_dialog.text001" />
                </span>
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
      title={t("detailFields.title", { number: order.order_number })}
    >
      <div className="space-y-6">
        <DetailGroup title={uiText("attribute002")}>
          <WholesaleDetailGrid rows={buildWholesaleOrderBasicRows({
            canViewInternalFields, customerName, order, salesName, t,
          })} />
        </DetailGroup>

        {canViewInternalFields ? (
          <DetailGroup title={uiText("attribute003")}>
            <WholesaleDetailGrid rows={buildWholesaleOrderCostRows(order, t)} />
          </DetailGroup>
        ) : null}

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
            {order.notes ?? t("detailFields.noNotes")}
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
