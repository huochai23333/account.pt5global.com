"use client";

import * as FormControls from "@/components/ui/form-controls";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type {
  CustomerInventoryCreditApplication,
  CustomerInventoryCreditTier,
  CustomerInventoryOrder,
} from "@/lib/customer-inventory-types";

import type { DirectCreditDecision } from "./customer-inventory-credit-dialog-types";
import {
  formatInventoryMoney,
  inventoryTierOrder,
} from "./customer-inventory-display";
import {
  callRpc,
  numberValue,
  optionalValue,
} from "./customer-inventory-dialog-utils";
import type { RunInventoryAction } from "./use-customer-inventory-actions";

export function CustomerInventoryCreditManageDialog({
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
  const pendingByTier = new Map(
    credits
      .filter(
        (credit) =>
          credit.order_id === order.id && credit.status === "pending",
      )
      .map((credit) => [credit.tier, credit]),
  );
  const unavailableTiers = new Set(
    credits
      .filter(
        (credit) =>
          credit.customer_id === order.customer_id &&
          ["pending", "active"].includes(credit.status) &&
          credit.order_id !== order.id,
      )
      .map((credit) => credit.tier),
  );
  const [decisions, setDecisions] = useState<DirectCreditDecision[]>(() =>
    inventoryTierOrder.map((tier) => ({
      approvedAmountUsd: tier === "fixed_200_usd" ? "200" : "",
      decision: pendingByTier.has(tier) ? "approve" : "skip",
      reviewNote: "",
      tier,
    })),
  );
  const rate = usdToCurrencyRates[order.currency];
  const suggestedActualPayment = useMemo(
    () => getDirectActualPayment(order, decisions, rate),
    [decisions, order, rate],
  );
  const hasApproval = decisions.some(
    (decision) => decision.decision === "approve",
  );
  const hasWork = decisions.some(
    (decision) =>
      decision.decision === "approve" ||
      (decision.decision === "reject" && pendingByTier.has(decision.tier)),
  );
  const rateMissing = hasApproval && rate == null;
  const actionKey = `manage:${order.id}`;
  const formId = `inventory-credit-manage-${order.id}`;

  function updateDecision(
    tier: CustomerInventoryCreditTier,
    changes: Partial<DirectCreditDecision>,
  ) {
    setDecisions((current) =>
      current.map((decision) =>
        decision.tier === tier ? { ...decision, ...changes } : decision,
      ),
    );
  }

  async function handleSubmit(formData: FormData) {
    const success = await runAction(
      actionKey,
      t("feedback.manageSuccess"),
      async (supabase) => {
        await callRpc(
          supabase.rpc("manage_customer_inventory_order_credit", {
            p_actual_payment_amount: numberValue(formData, "actualPayment"),
            p_expected_revision: order.revision,
            p_note: optionalValue(formData, "notes"),
            p_order_id: order.id,
            p_tier_decisions: decisions.map((decision) => ({
              approved_amount_usd:
                decision.decision === "approve"
                  ? Number(decision.approvedAmountUsd || 0)
                  : null,
              decision: decision.decision,
              review_note: decision.reviewNote || null,
              tier: decision.tier,
            })),
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
              pendingKey === actionKey || rateMissing || !hasWork
            }
            loading={pendingKey === actionKey}
            form={formId}
            type="submit"
          >
            {pendingKey === actionKey
              ? t("common.saving")
              : t("creditDialogs.manageSubmit")}
          </Button>
        </>
      }
      description={t("creditDialogs.manageDescription")}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t("creditDialogs.manageTitle")}
    >
      <form
        className="grid min-w-0 gap-5"
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(new FormData(event.currentTarget));
        }}
      >
        <div className="grid gap-1 text-sm leading-7 text-content-muted">
          <p>
            {t("creditDialogs.manageOrder", {
              amount: formatInventoryMoney(
                order.purchase_amount,
                order.currency,
              ),
              number: order.order_number,
            })}
          </p>
          <p>
            {rate == null
              ? t("creditDialogs.rateMissing")
              : t("creditDialogs.ratePreview", {
                  currency: order.currency,
                  rate: Number(rate),
                })}
          </p>
        </div>

        {decisions.map((decision) => {
          const pendingCredit = pendingByTier.get(decision.tier);
          const unavailable = unavailableTiers.has(decision.tier);
          return (
            <section
              className="grid min-w-0 gap-4 rounded-record-card border border-border-subtle bg-surface-inset p-4"
              key={decision.tier}
            >
              <div>
                <p className="font-semibold text-content-strong">
                  {t(`tiers.${decision.tier}`)}
                </p>
                {/* 新名称用于识别档位，原名称作为常驻说明，状态提示另起一行。 */}
                <p className="mt-1 text-xs leading-5 text-content-muted">
                  {t(`tierDescriptions.${decision.tier}`)}
                </p>
                <p className="mt-1 text-xs leading-5 text-content-muted">
                  {unavailable
                    ? t("creditDialogs.tierUsedElsewhere")
                    : pendingCredit
                      ? t("creditDialogs.customerRequested")
                      : t("creditDialogs.staffCanActivate")}
                </p>
              </div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <FormControls.Field
                  label={t("fields.creditUsageDecision")}
                  required
                >
                  <Select
                    disabled={unavailable}
                    onValueChange={(value) =>
                      updateDecision(decision.tier, {
                        decision: value as DirectCreditDecision["decision"],
                      })
                    }
                    options={
                      pendingCredit
                        ? [
                            {
                              label: t("decisions.approve"),
                              value: "approve",
                            },
                            {
                              label: t("decisions.reject"),
                              value: "reject",
                            },
                          ]
                        : [
                            {
                              label: t("decisions.skip"),
                              value: "skip",
                            },
                            {
                              label: t("decisions.activate"),
                              value: "approve",
                            },
                          ]
                    }
                    value={unavailable ? "skip" : decision.decision}
                  />
                </FormControls.Field>
                <FormControls.Field
                  hint={
                    decision.tier === "fixed_200_usd"
                      ? t("creditDialogs.fixedAmountHint")
                      : t("creditDialogs.manualAmountHint")
                  }
                  label={t("fields.approvedAmountUsd")}
                  required={
                    decision.decision === "approve" &&
                    decision.tier !== "fixed_200_usd"
                  }
                >
                  <FormControls.Input
                    disabled={
                      decision.decision !== "approve" ||
                      decision.tier === "fixed_200_usd"
                    }
                    min="0.01"
                    onChange={(event) =>
                      updateDecision(decision.tier, {
                        approvedAmountUsd: event.currentTarget.value,
                      })
                    }
                    required={
                      decision.decision === "approve" &&
                      decision.tier !== "fixed_200_usd"
                    }
                    step="0.01"
                    type="number"
                    value={decision.approvedAmountUsd}
                  />
                </FormControls.Field>
              </div>
            </section>
          );
        })}

        <FormControls.Field
          hint={t("creditDialogs.manageActualPaymentHint")}
          label={t("fields.actualPayment")}
          required
        >
          <FormControls.Input
            defaultValue={suggestedActualPayment}
            key={suggestedActualPayment}
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

function getDirectActualPayment(
  order: CustomerInventoryOrder,
  decisions: DirectCreditDecision[],
  rate: number | null | undefined,
) {
  if (rate == null) return 0;
  const approvedUsd = decisions.reduce((sum, decision) => {
    if (decision.decision !== "approve") return sum;
    return sum +
      (decision.tier === "fixed_200_usd"
        ? 200
        : Number(decision.approvedAmountUsd || 0));
  }, 0);
  return Math.max(
    Math.round((order.purchase_amount - approvedUsd * rate) * 100) / 100,
    0,
  );
}
