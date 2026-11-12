"use client";

import { useMemo } from "react";

import { LoaderCircle, PencilLine, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import type { AdminOrderRow } from "@/lib/admin-orders";
import { useLocale } from "@/components/i18n/locale-provider";
import { getBrowserSupabaseClient } from "@/lib/supabase";

import {
  createDashboardSharedCopy,
  formatDateTime,
} from "../dashboard-shared-ui";
import { DashboardDialog } from "../dashboard-dialog";
import { Button } from "../../ui/button";
import {
  createOrdersUiCopy,
  formatCurrencyCode,
  formatMoneyValue,
  formatRateValue,
  getOrderTypeMetaFromCategory,
  getStatusLabel,
  resolveOrderTypeMeta,
  resolveOrderUserLabel,
} from "./admin-orders-utils";
import { OrderDetailCard } from "./admin-orders-dialog-ui";
import { OrderServiceFeeSummaryCard } from "./admin-orders-service-fee-preview";
import { OrderSupplementaryDetailsSection } from "./admin-orders-supplementary-details";
import { useAdminOrderSupplementaryDetail } from "./use-admin-order-supplementary-detail";

export function OrderDetailsDialog({
  canDelete,
  canEdit,
  canViewCost,
  showOrderEntryUser = true,
  showOrderingUser = true,
  order,
  userLabelById,
  orderTypeMetaById,
  supabase,
  onEdit,
  onDelete,
  deletePending,
  onForceDelete,
  forceDeletePending,
  onOpenChange,
}: {
  canDelete: boolean;
  canEdit: boolean;
  canViewCost: boolean;
  showOrderEntryUser?: boolean;
  showOrderingUser?: boolean;
  order: AdminOrderRow | null;
  userLabelById: Map<string, string>;
  orderTypeMetaById: Map<
    string,
    ReturnType<typeof getOrderTypeMetaFromCategory>
  >;
  supabase: ReturnType<typeof getBrowserSupabaseClient>;
  onEdit: (order: AdminOrderRow) => void;
  onDelete: () => void;
  deletePending: boolean;
  onForceDelete: () => void;
  forceDeletePending: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { locale } = useLocale();
  const t = useTranslations("OrdersUI");
  const sharedT = useTranslations("DashboardShared");
  const orderUiCopy = useMemo(() => createOrdersUiCopy(t), [t]);
  const sharedCopy = useMemo(
    () => createDashboardSharedCopy(sharedT),
    [sharedT],
  );
  const typeMeta = resolveOrderTypeMeta(
    order?.order_type ?? null,
    orderTypeMetaById,
    orderUiCopy,
  );
  const orderNumber = order?.order_number ?? null;
  const { supplementaryLoading, supplementaryDetail, supplementaryError } =
    useAdminOrderSupplementaryDetail({ orderNumber, orderUiCopy, sharedCopy, supabase });
  const deleteActionPending = deletePending || forceDeletePending;

  return (
    <DashboardDialog
      actions={
        order ? (
          <>
            {canEdit ? (
              <Button
                onClick={() => onEdit(order)}
                type="button"
                variant="outline"
              >
                <PencilLine className="size-4" />
                {t("details.editOrder")}
              </Button>
            ) : null}
            {canDelete ? (
              <>
                <Button
                  size="default"
                  disabled={deleteActionPending}
                  onClick={onDelete}
                  type="button"
                  variant="danger"
                >
                  {deletePending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  {t("details.softDeleteOrder")}
                </Button>
                <Button
                  variant="danger"
                  size="default"
                  disabled={deleteActionPending}
                  onClick={onForceDelete}
                  type="button"
                >
                  {forceDeletePending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  {t("details.forceDeleteOrder")}
                </Button>
              </>
            ) : null}
          </>
        ) : null
      }
      description={order ? t("details.description") : undefined}
      onOpenChange={onOpenChange}
      open={order !== null}
      title={
        order
          ? t("details.titleWithOrderNumber", {
              orderNumber: order.order_number,
            })
          : t("details.title")
      }
    >
      {order ? (
        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <OrderDetailCard
              label={t("details.fields.orderNumber")}
              value={order.order_number}
            />
            <OrderDetailCard
              label={t("details.fields.orderStatus")}
              value={getStatusLabel(order.order_status, orderUiCopy)}
            />
            <OrderDetailCard
              label={t("details.fields.orderType")}
              value={typeMeta.label}
            />
            <OrderDetailCard
              label={t("details.fields.originalCurrency")}
              value={formatCurrencyCode(order.original_currency)}
            />
            <OrderDetailCard
              label={t("details.fields.amount")}
              value={formatMoneyValue(order.amount, locale)}
            />
            <OrderDetailCard
              label={t("details.fields.rmbAmount")}
              value={formatMoneyValue(order.rmb_amount, locale)}
            />
            {order.service_fee_type_id ? (
              <OrderServiceFeeSummaryCard
                amount={order.service_fee_amount}
                className="md:col-span-2"
                description={t("serviceFeePreview.savedHint")}
                rate={order.service_fee_ratio}
                tier={order.service_fee_type_name}
                title={t("details.fields.serviceFee")}
              />
            ) : null}
            {canViewCost ? (
              <OrderDetailCard
                label={t("details.fields.costAmount")}
                value={formatMoneyValue(order.cost_amount, locale)}
              />
            ) : null}
            <OrderDetailCard
              label={t("details.fields.dailyExchangeRate")}
              value={formatRateValue(order.daily_exchange_rate, locale)}
            />
            <OrderDetailCard
              label={t("details.fields.transactionRate")}
              value={formatRateValue(order.transaction_rate, locale)}
            />
            {showOrderEntryUser ? (
              <OrderDetailCard
                label={t("details.fields.orderEntryUser")}
                value={resolveOrderUserLabel(
                  order.order_entry_user,
                  userLabelById,
                )}
              />
            ) : null}
            {showOrderingUser ? (
              <OrderDetailCard
                label={t("details.fields.orderingUser")}
                value={resolveOrderUserLabel(
                  order.ordering_user,
                  userLabelById,
                )}
              />
            ) : null}
            <OrderDetailCard
              label={t("details.fields.createdAt")}
              value={formatDateTime(order.created_at, locale)}
            />
            <OrderDetailCard
              label={t("details.fields.updatedAt")}
              value={formatDateTime(order.reviewed_at, locale)}
            />
          </div>

          <OrderSupplementaryDetailsSection
            detail={supplementaryDetail}
            error={supplementaryError}
            loading={supplementaryLoading}
            orderUiCopy={orderUiCopy}
          />
        </div>
      ) : null}
    </DashboardDialog>
  );
}
