"use client";

import { ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import type {
  WholesaleLinked1688Order,
  WholesaleProfile,
} from "@/lib/wholesale";

import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  getProfileName,
} from "./wholesale-display";
import {
  WholesaleDetailGrid,
  type WholesaleDetailGridRow,
} from "./wholesale-detail-grid";

export function LinkedPurchaseOrders({
  canViewInternalFields,
  profilesById,
  purchaseOrders,
}: {
  canViewInternalFields: boolean;
  profilesById: Map<string, WholesaleProfile>;
  purchaseOrders: WholesaleLinked1688Order[];
}) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_order_linked_records",
  );
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] =
    useState<WholesaleLinked1688Order | null>(null);

  if (purchaseOrders.length === 0) {
    return <span className="text-content-muted">{uiText("text001")}</span>;
  }

  if (!canViewInternalFields) {
    // 客户只看关联采购单号；采购明细和内部认领资料不再经浏览器接口提供。
    return <div className="flex flex-wrap gap-2">{purchaseOrders.map((purchaseOrder) =>
      <span className="break-all rounded-control-default border border-border-subtle px-2 py-1 text-sm" key={purchaseOrder.id}>
        {purchaseOrder.external_order_number}
      </span>,
    )}</div>;
  }

  return (
    <>
      <div className="max-h-24 space-y-2 overflow-y-auto pr-1">
        {purchaseOrders.map((purchaseOrder) => (
          <Button
            size="default"
            className="w-full justify-start"
            key={purchaseOrder.id}
            onClick={() => setSelectedPurchaseOrder(purchaseOrder)}
            type="button"
            variant="outline"
            wrap
          >
            <ShoppingCart className="size-3.5 shrink-0" />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">
              {purchaseOrder.external_order_number}
            </span>
          </Button>
        ))}
      </div>
      <DashboardDialog
        description={uiText("attribute001")}
        onOpenChange={(open) => {
          if (!open) setSelectedPurchaseOrder(null);
        }}
        open={selectedPurchaseOrder !== null}
        title={uiText("attribute002")}
      >
        {selectedPurchaseOrder ? (
          <WholesaleDetailGrid
            rows={getLinkedPurchaseOrderDetailRows(
              selectedPurchaseOrder,
              profilesById,
              canViewInternalFields,
            )}
          />
        ) : null}
      </DashboardDialog>
    </>
  );
}

function getLinkedPurchaseOrderDetailRows(
  purchaseOrder: WholesaleLinked1688Order,
  profilesById: Map<string, WholesaleProfile>,
  canViewInternalFields: boolean,
): WholesaleDetailGridRow[] {
  return [
    { label: "1688 订单号", value: purchaseOrder.external_order_number },
    { label: "供应商", value: purchaseOrder.seller_name ?? "未记录" },
    { label: "商品", value: purchaseOrder.item_summary ?? "未记录" },
    { label: "数量", value: formatNumber(purchaseOrder.quantity) },
    ...(canViewInternalFields
      ? [
          {
            label: "采购金额",
            value: formatCurrency(purchaseOrder.purchase_amount),
          },
        ]
      : []),
    { label: "订单状态", value: purchaseOrder.order_status ?? "未记录" },
    { label: "采购时间", value: formatDateTime(purchaseOrder.purchased_at) },
    { label: "收件人", value: purchaseOrder.recipient_name ?? "未记录" },
    {
      label: "认领业务员",
      value: purchaseOrder.claimed_by_user_id
        ? getProfileName(profilesById, purchaseOrder.claimed_by_user_id)
        : "未认领",
    },
    { label: "认领时间", value: formatDateTime(purchaseOrder.claimed_at) },
    {
      label: "导入人",
      value: purchaseOrder.imported_by_user_id
        ? getProfileName(profilesById, purchaseOrder.imported_by_user_id)
        : "未记录",
    },
    { label: "创建时间", value: formatDateTime(purchaseOrder.created_at) },
  ];
}
