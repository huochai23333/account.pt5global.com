"use client";

import * as FormControls from "@/components/ui/form-controls";

import { useTranslations } from "next-intl";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type {
  CustomerInventoryOrder,
  CustomerInventoryOrderItem,
  CustomerInventoryPageData,
} from "@/lib/customer-inventory-types";

import { CustomerInventoryOrderItemEditor } from "./customer-inventory-order-item-editor";
import type { RunInventoryAction } from "./use-customer-inventory-actions";
import {
  callRpc,
  numberValue,
  optionalValue,
  requiredValue,
} from "./customer-inventory-dialog-utils";

export type InventoryOrderDialogState =
  | { kind: "create" }
  | { kind: "edit"; order: CustomerInventoryOrder }
  | { kind: "notes"; order: CustomerInventoryOrder }
  | { kind: "pay"; order: CustomerInventoryOrder }
  | { kind: "cancel"; order: CustomerInventoryOrder }
  | null;

export function CustomerInventoryOrderDialogs({
  data,
  dialog,
  onClose,
  pendingKey,
  runAction,
}: {
  data: CustomerInventoryPageData;
  dialog: InventoryOrderDialogState;
  onClose: () => void;
  pendingKey: string | null;
  runAction: RunInventoryAction;
}) {
  const t = useTranslations("CustomerInventory");

  if (!dialog) return null;

  const activeDialog = dialog as NonNullable<InventoryOrderDialogState>;
  const formId = `inventory-order-${dialog.kind}-form`;
  const order = dialog.kind === "create" ? null : dialog.order;
  const actionKey = `${dialog.kind}:${order?.id ?? "new"}`;
  const customerOptions = data.customers.map((customer) => ({
    label: customer.unique_name,
    value: customer.id,
  }));
  const salesOptions = data.profiles
    .filter((profile) =>
      ["administrator", "salesman"].includes(profile.role ?? ""),
    )
    .map((profile) => ({
      label: profile.name ?? profile.email ?? profile.user_id,
      value: profile.user_id,
    }));

  async function handleSubmit(formData: FormData) {
    const currentDialog = activeDialog;
    const success = await runAction(
      actionKey,
      getSuccessMessage(currentDialog.kind, t),
      async (supabase) => {
        if (currentDialog.kind === "create") {
          await callRpc(
            supabase.rpc("create_customer_inventory_order", {
              p_currency: requiredValue(formData, "currency"),
              p_customer_id: requiredValue(formData, "customerId"),
              p_items: parseInventoryItems(formData),
              p_notes: optionalValue(formData, "notes"),
              p_paid_in_full: formData.get("paidInFull") === "on",
              p_purchase_amount: numberValue(formData, "purchaseAmount"),
              p_sales_user_id: requiredValue(formData, "salesUserId"),
            }),
          );
          return;
        }

        if (currentDialog.kind === "edit") {
          await callRpc(
            supabase.rpc("update_customer_inventory_order", {
              p_currency: requiredValue(formData, "currency"),
              p_customer_id: requiredValue(formData, "customerId"),
              p_expected_revision: currentDialog.order.revision,
              p_items: parseInventoryItems(formData),
              p_notes: optionalValue(formData, "notes"),
              p_order_id: currentDialog.order.id,
              p_purchase_amount: numberValue(formData, "purchaseAmount"),
              p_sales_user_id: requiredValue(formData, "salesUserId"),
            }),
          );
          return;
        }

        if (currentDialog.kind === "notes") {
          await callRpc(
            supabase.rpc("update_customer_inventory_order_notes", {
              p_expected_revision: currentDialog.order.revision,
              p_notes: optionalValue(formData, "notes"),
              p_order_id: currentDialog.order.id,
            }),
          );
          return;
        }

        if (currentDialog.kind === "pay") {
          await callRpc(
            supabase.rpc("mark_customer_inventory_order_paid_in_full", {
              p_expected_revision: currentDialog.order.revision,
              p_order_id: currentDialog.order.id,
            }),
          );
          return;
        }

        await callRpc(
          supabase.rpc("cancel_customer_inventory_order", {
            p_expected_revision: currentDialog.order.revision,
            p_note: optionalValue(formData, "notes"),
            p_order_id: currentDialog.order.id,
          }),
        );
      },
    );

    if (success) onClose();
  }

  const isSimpleConfirm = dialog.kind === "pay" || dialog.kind === "cancel";

  return (
    <DashboardDialog
      actions={
        <>
          <Button onClick={onClose} type="button" variant="secondary">
            {t("common.cancel")}
          </Button>
          <Button
            disabled={pendingKey === actionKey}
            loading={pendingKey === actionKey}
            form={formId}
            type="submit"
            variant={dialog.kind === "cancel" ? "danger" : "primary"}
          >
            {pendingKey === actionKey
              ? t("common.saving")
              : getSubmitLabel(dialog.kind, t)}
          </Button>
        </>
      }
      description={
        isSimpleConfirm
          ? t(`orderDialogs.${dialog.kind}Description`, {
              number: order?.order_number ?? "",
            })
          : t(`orderDialogs.${dialog.kind}Description`)
      }
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t(`orderDialogs.${dialog.kind}Title`)}
    >
      <form
        className="grid min-w-0 gap-5 sm:grid-cols-2"
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(new FormData(event.currentTarget));
        }}
      >
        {dialog.kind === "create" || dialog.kind === "edit" ? (
          <>
            <FormControls.Field label={t("fields.customer")} required>
              <Select
                defaultValue={order?.customer_id ?? customerOptions[0]?.value}
                name="customerId"
                options={customerOptions}
                placeholder={t("placeholders.customer")}
                required
              />
            </FormControls.Field>
            <FormControls.Field label={t("fields.salesman")} required>
              <Select
                defaultValue={
                  order?.sales_user_id ??
                  data.currentUserId ??
                  salesOptions[0]?.value
                }
                name="salesUserId"
                options={salesOptions}
                placeholder={t("placeholders.salesman")}
                required
              />
            </FormControls.Field>
            <FormControls.Field label={t("fields.purchaseAmount")} required>
              <FormControls.Input
                defaultValue={order?.purchase_amount}
                min="0.01"
                name="purchaseAmount"
                required
                step="0.01"
                type="number"
              />
            </FormControls.Field>
            <FormControls.Field label={t("fields.currency")} required>
              <Select
                defaultValue={order?.currency ?? "USD"}
                name="currency"
                options={data.currencyOptions.map((currency) => ({
                  label: currency,
                  value: currency,
                }))}
                required
              />
            </FormControls.Field>
            <CustomerInventoryOrderItemEditor
              initialItems={data.items
                .filter((item) => item.order_id === order?.id)
                .sort((left, right) => left.sort_order - right.sort_order)}
            />
            {dialog.kind === "create" ? (
              <FormControls.ChoiceField
                description={t("orderDialogs.paidInFullHint")}
                label={t("orderDialogs.paidInFull")}
                name="paidInFull"
                rootClassName="sm:col-span-2"
              />
            ) : null}
          </>
        ) : null}
        {dialog.kind === "notes" ||
        dialog.kind === "cancel" ||
        dialog.kind === "create" ||
        dialog.kind === "edit" ? (
          <FormControls.Field
            className="sm:col-span-2"
            label={
              dialog.kind === "cancel"
                ? t("fields.cancelReason")
                : t("fields.notes")
            }
          >
            <FormControls.Textarea
              className="min-h-28 py-3"
              defaultValue={order?.notes ?? ""}
              name="notes"
            />
          </FormControls.Field>
        ) : null}
        {dialog.kind === "pay" ? (
          <p className="sm:col-span-2 text-sm leading-7 text-content-muted">
            {t("orderDialogs.payHint")}
          </p>
        ) : null}
      </form>
    </DashboardDialog>
  );
}

function parseInventoryItems(formData: FormData) {
  const raw = String(formData.get("items") ?? "[]");
  const parsed = JSON.parse(raw) as Array<
    Pick<
      CustomerInventoryOrderItem,
      "product_name" | "quantity" | "source_url"
    >
  >;

  // 浏览器原生 required 先给出就近反馈；这里仍检查整体结构，
  // 避免脚本请求把非数组内容传给数据库。
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 100) {
    throw new Error("customer_inventory_items_count_invalid");
  }
  return parsed;
}

function getSubmitLabel(
  kind: NonNullable<InventoryOrderDialogState>["kind"],
  t: ReturnType<typeof useTranslations>,
) {
  return t(`orderDialogs.${kind}Submit`);
}

function getSuccessMessage(
  kind: NonNullable<InventoryOrderDialogState>["kind"],
  t: ReturnType<typeof useTranslations>,
) {
  return t(`feedback.${kind}Success`);
}
