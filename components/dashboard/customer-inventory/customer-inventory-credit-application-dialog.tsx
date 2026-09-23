"use client";

import * as FormControls from "@/components/ui/form-controls";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import type {
  CustomerInventoryCreditApplication,
  CustomerInventoryOrder,
} from "@/lib/customer-inventory-types";

import {
  formatInventoryMoney,
  inventoryTierOrder,
} from "./customer-inventory-display";
import { callRpc, optionalValue } from "./customer-inventory-dialog-utils";
import type { RunInventoryAction } from "./use-customer-inventory-actions";

export function CustomerInventoryCreditApplicationDialog({
  credits,
  onClose,
  order,
  pendingKey,
  runAction,
  usdToCurrencyRates,
}: {
  credits: CustomerInventoryCreditApplication[];
  onClose: () => void;
  order: CustomerInventoryOrder;
  pendingKey: string | null;
  runAction: RunInventoryAction;
  usdToCurrencyRates: Record<string, number | null>;
}) {
  const t = useTranslations("CustomerInventory");
  const actionKey = `apply:${order.id}`;
  const formId = `inventory-credit-apply-${order.id}`;
  const [selectedTiers, setSelectedTiers] = useState<Set<string>>(() => new Set());
  const customerCredits = credits.filter(
    (credit) => credit.customer_id === order.customer_id,
  );
  const fixedQualified = customerCredits.some(
    (credit) =>
      credit.tier === "fixed_200_usd" &&
      ["active", "repaid"].includes(credit.status),
  );
  const fixedCurrentlyOpen = customerCredits.some(
    (credit) =>
      credit.tier === "fixed_200_usd" &&
      ["pending", "active"].includes(credit.status),
  );
  const openTiers = new Set(
    customerCredits
      .filter((credit) => ["pending", "active"].includes(credit.status))
      .map((credit) => credit.tier),
  );
  const availableTiers = inventoryTierOrder.filter(
    (tier) => !(tier === "fixed_200_usd" && fixedQualified) &&
      !openTiers.has(tier),
  );
  const usdRate = order.currency === "USD" ? 1 : usdToCurrencyRates[order.currency];
  const halfOrderUsd = usdRate && usdRate > 0 ? Math.round(Number(order.purchase_amount) / usdRate * 50) / 100 : null;
  const estimatedUsd = (selectedTiers.has("fixed_200_usd") ? 200 : 0)
    + (selectedTiers.has("single_order_50") && halfOrderUsd !== null ? halfOrderUsd : 0);
  const estimateIncomplete = selectedTiers.has("all_orders_5")
    || (selectedTiers.has("single_order_50") && halfOrderUsd === null);

  async function handleSubmit(formData: FormData) {
    const tiers = availableTiers.filter(
      (tier) => formData.get(`tier:${tier}`) === "on",
    );
    const success = await runAction(
      actionKey,
      t("feedback.applySuccess"),
      async (supabase) => {
        await callRpc(
          supabase.rpc("submit_customer_inventory_credit_applications", {
            p_application_note: optionalValue(formData, "notes"),
            p_order_id: order.id,
            p_tiers: tiers,
          }),
        );
      },
    );
    if (success) onClose();
  }

  return (
    <DashboardDialog
      actions={
        <>
          <Button onClick={onClose} type="button" variant="secondary">
            {t("common.cancel")}
          </Button>
          <Button
            disabled={
              pendingKey === actionKey || availableTiers.length === 0
            }
            form={formId}
            type="submit"
          >
            {pendingKey === actionKey
              ? t("common.saving")
              : t("creditDialogs.applySubmit")}
          </Button>
        </>
      }
      description={t("creditDialogs.applyDescription")}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t("creditDialogs.applyTitle")}
    >
      <form
        className="grid min-w-0 gap-5"
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(new FormData(event.currentTarget));
        }}
      >
        <p className="text-sm leading-7 text-content-muted">
          {t("creditDialogs.applyOrder", {
            amount: formatInventoryMoney(
              order.purchase_amount,
              order.currency,
            ),
            number: order.order_number,
          })}
        </p>

        {fixedQualified ? (
          <div className="rounded-record-card border border-status-success-border bg-status-success-soft px-4 py-3 text-sm leading-6 text-status-success">
            {t(
              fixedCurrentlyOpen
                ? "creditDialogs.fixedInUse"
                : "creditDialogs.fixedQualification",
            )}
          </div>
        ) : null}

        {inventoryTierOrder.map((tier) => {
          if (tier === "fixed_200_usd" && fixedQualified) return null;
          const unavailable = openTiers.has(tier);
          return (
            <FormControls.ChoiceField
              checked={selectedTiers.has(tier)}
              description={
                unavailable
                  ? `${t(`tierDescriptions.${tier}`)} ${t("creditDialogs.tierAlreadyOpen")}`
                  : t(`tierDescriptions.${tier}`)
              }
              disabled={unavailable}
              key={tier}
              label={t(`tiers.${tier}`)}
              name={`tier:${tier}`}
              onChange={(event) => setSelectedTiers((current) => {
                const next = new Set(current);
                if (event.target.checked) next.add(tier); else next.delete(tier);
                return next;
              })}
            />
          );
        })}

        <div className="rounded-record-card border border-border-subtle bg-surface-inset px-4 py-3 text-sm leading-6 text-content-strong" aria-live="polite">
          <p className="font-semibold">{t("creditDialogs.estimateTitle")}</p>
          {selectedTiers.size === 0 ? <p className="text-content-muted">{t("creditDialogs.estimateChoose")}</p> : <>
            {selectedTiers.has("fixed_200_usd") ? <p>{t("creditDialogs.estimateFixed", { amount: formatInventoryMoney(200, "USD") })}</p> : null}
            {selectedTiers.has("single_order_50") ? <p>{halfOrderUsd === null ? t("creditDialogs.estimateExchangeMissing") : t("creditDialogs.estimateHalf", { amount: formatInventoryMoney(halfOrderUsd, "USD") })}</p> : null}
            {selectedTiers.has("all_orders_5") ? <p>{t("creditDialogs.estimateAllOrders")}</p> : null}
            {estimateIncomplete ? <p>{t("creditDialogs.estimateIncomplete")}</p> : <p className="font-semibold">{t("creditDialogs.estimateTotal", { amount: formatInventoryMoney(estimatedUsd, "USD") })}</p>}
          </>}
          <p className="mt-2 text-content-muted">{t("creditDialogs.estimateImpact")}</p>
        </div>

        <FormControls.Field label={t("fields.notes")}>
          <FormControls.Textarea className="min-h-28 py-3" name="notes" />
        </FormControls.Field>
      </form>
    </DashboardDialog>
  );
}
