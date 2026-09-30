"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import type {
  CustomerInventoryOrder,
  CustomerInventoryOrderItem,
} from "@/lib/customer-inventory-types";

import {
  CustomerInventoryOrderItemEditor,
  type EditableInventoryOrderItem,
} from "./customer-inventory-order-item-editor";
import { callRpc } from "./customer-inventory-dialog-utils";
import type { RunInventoryAction } from "./use-customer-inventory-actions";

/**
 * 同一个商品弹窗根据角色切换为“维护”或“只读”。
 * 客户和财务只会收到展示内容，不渲染任何输入框或写入按钮。
 */
export function CustomerInventoryItemsDialog({
  canWrite,
  items,
  onClose,
  order,
  pendingKey,
  runAction,
}: {
  canWrite: boolean;
  items: CustomerInventoryOrderItem[];
  onClose: () => void;
  order: CustomerInventoryOrder | null;
  pendingKey: string | null;
  runAction: RunInventoryAction;
}) {
  const t = useTranslations("CustomerInventory");
  if (!order) return null;

  const actionKey = `items:${order.id}`;
  const sortedItems = [...items].sort(
    (left, right) => left.sort_order - right.sort_order,
  );
  const formId = `inventory-items-${order.id}`;

  async function handleSubmit(formData: FormData) {
    const raw = String(formData.get("items") ?? "[]");
    const nextItems = JSON.parse(raw) as EditableInventoryOrderItem[];
    const success = await runAction(
      actionKey,
      t("feedback.itemsSuccess"),
      async (supabase) => {
        await callRpc(
          supabase.rpc("replace_customer_inventory_order_items", {
            p_expected_revision: order?.revision,
            p_items: nextItems,
            p_order_id: order?.id,
          }),
        );
      },
    );
    if (success) onClose();
  }

  return (
    <DashboardDialog
      actions={
        canWrite ? (
          <>
            <Button onClick={onClose} type="button" variant="secondary">
              {t("common.cancel")}
            </Button>
            <Button
              disabled={pendingKey === actionKey}
              loading={pendingKey === actionKey}
              form={formId}
              type="submit"
            >
              {pendingKey === actionKey
                ? t("common.saving")
                : t("items.save")}
            </Button>
          </>
        ) : (
          <Button onClick={onClose} type="button" variant="secondary">
            {t("common.close")}
          </Button>
        )
      }
      description={
        canWrite ? t("items.manageDescription") : t("items.readDescription")
      }
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t("items.dialogTitle", { number: order.order_number })}
    >
      {canWrite ? (
        <form
          className="grid min-w-0 gap-5"
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit(new FormData(event.currentTarget));
          }}
        >
          <CustomerInventoryOrderItemEditor initialItems={sortedItems} />
        </form>
      ) : (
        <div className="grid min-w-0 gap-3">
          {sortedItems.map((item, index) => (
            <article
              className="min-w-0 rounded-record-card border border-border-subtle bg-surface-inset p-4"
              key={item.id}
            >
              <div className="flex min-w-0 items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="break-words font-semibold text-content-strong">
                    {index + 1}. {item.product_name}
                  </p>
                  <p className="mt-1 text-sm text-content-muted">
                    {t("items.quantityValue", { count: item.quantity })}
                  </p>
                </div>
                {item.source_url ? (
                  <a
                    className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control-compact border border-control-border px-3 text-sm font-semibold text-primary hover:bg-surface-interactive focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
                    href={item.source_url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <ExternalLink aria-hidden="true" className="size-4" />
                    {t("items.openLink")}
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardDialog>
  );
}
