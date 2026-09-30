"use client";

import * as FormControls from "@/components/ui/form-controls";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import type {
  CustomerInventoryCreditApplication,
  CustomerInventoryOrder,
} from "@/lib/customer-inventory-types";

import type { CreditDecision } from "./customer-inventory-credit-dialog-types";
import {
  createInitialCreditDecisions,
  CustomerInventoryCreditReviewCard,
} from "./customer-inventory-credit-review-card";
import { formatInventoryMoney } from "./customer-inventory-display";
import {
  callRpc,
  numberValue,
  optionalValue,
} from "./customer-inventory-dialog-utils";
import type { RunInventoryAction } from "./use-customer-inventory-actions";

export function CustomerInventoryCreditReviewDialog({
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
  const [decisions, setDecisions] = useState<CreditDecision[]>(() =>
    createInitialCreditDecisions(credits),
  );
  const actionKey = `review:${order.id}`;
  const formId = `inventory-credit-review-${order.id}`;
  const actualPayment = useMemo(
    () =>
      getSuggestedActualPayment({
        credits,
        decisions,
        order,
        rate: usdToCurrencyRates[order.currency],
      }),
    [credits, decisions, order, usdToCurrencyRates],
  );
  const rateMissing =
    decisions.some((decision) => decision.decision === "approve") &&
    usdToCurrencyRates[order.currency] == null;

  async function handleSubmit(formData: FormData) {
    const success = await runAction(
      actionKey,
      t("feedback.reviewSuccess"),
      async (supabase) => {
        await callRpc(
          supabase.rpc("review_customer_inventory_credit_batch", {
            p_actual_payment_amount: numberValue(formData, "actualPayment"),
            p_decisions: decisions.map((decision) => ({
              application_id: decision.applicationId,
              approved_amount_usd:
                decision.decision === "approve"
                  ? Number(decision.approvedAmountUsd || 0)
                  : null,
              decision: decision.decision,
              review_note: decision.reviewNote || null,
            })),
            p_expected_revision: order.revision,
            p_order_id: order.id,
            p_review_note: optionalValue(formData, "notes"),
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
            disabled={pendingKey === actionKey || rateMissing}
            loading={pendingKey === actionKey}
            form={formId}
            type="submit"
          >
            {pendingKey === actionKey
              ? t("common.saving")
              : t("creditDialogs.reviewSubmit")}
          </Button>
        </>
      }
      description={t("creditDialogs.reviewDescription")}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t("creditDialogs.reviewTitle")}
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
          {t("creditDialogs.reviewBalance", {
            amount: formatInventoryMoney(
              order.purchase_amount,
              order.currency,
            ),
          })}
        </p>
        <p className="text-sm leading-7 text-content-muted">
          {usdToCurrencyRates[order.currency] == null
            ? t("creditDialogs.rateMissing")
            : t("creditDialogs.ratePreview", {
                currency: order.currency,
                rate: Number(usdToCurrencyRates[order.currency]),
              })}
        </p>
        {credits.map((credit) => {
          const decision = decisions.find(
            (item) => item.applicationId === credit.id,
          );
          if (!decision) return null;
          return (
            <CustomerInventoryCreditReviewCard
              credit={credit}
              decision={decision}
              key={credit.id}
              onChange={(nextDecision) =>
                setDecisions((current) =>
                  current.map((item) =>
                    item.applicationId === credit.id ? nextDecision : item,
                  ),
                )
              }
            />
          );
        })}
        <FormControls.Field
          hint={t("creditDialogs.actualPaymentHint")}
          label={t("fields.actualPayment")}
          required
        >
          <FormControls.Input
            defaultValue={actualPayment}
            key={actualPayment}
            min="0"
            name="actualPayment"
            required
            step="0.01"
            type="number"
          />
        </FormControls.Field>
        <FormControls.Field label={t("fields.notes")}>
          <FormControls.Textarea className="min-h-28 py-3" name="notes" />
        </FormControls.Field>
      </form>
    </DashboardDialog>
  );
}

function getSuggestedActualPayment({
  credits,
  decisions,
  order,
  rate,
}: {
  credits: CustomerInventoryCreditApplication[];
  decisions: CreditDecision[];
  order: CustomerInventoryOrder;
  rate: number | null | undefined;
}) {
  if (rate == null) return 0;
  const approvedUsd = decisions.reduce((sum, decision) => {
    if (decision.decision !== "approve") return sum;
    const credit = credits.find(
      (item) => item.id === decision.applicationId,
    );
    const amount =
      credit?.tier === "fixed_200_usd"
        ? 200
        : Number(decision.approvedAmountUsd || 0);
    return sum + amount;
  }, 0);
  return Math.max(
    Math.round((order.purchase_amount - approvedUsd * rate) * 100) / 100,
    0,
  );
}
