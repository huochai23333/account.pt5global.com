"use client";

import * as FormControls from "@/components/ui/form-controls";

import { useTranslations } from "next-intl";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { getCustomerInventoryInterest } from "@/lib/customer-inventory-types";

import type { InventoryCreditDialogState } from "./customer-inventory-credit-dialog-types";
import {
  formatInventoryDate,
  formatInventoryMoney,
} from "./customer-inventory-display";
import {
  callRpc,
  numberValue,
  optionalValue,
  requiredValue,
} from "./customer-inventory-dialog-utils";
import type { RunInventoryAction } from "./use-customer-inventory-actions";

type LifecycleDialog = Extract<
  NonNullable<InventoryCreditDialogState>,
  { kind: "extend" | "reviewExtension" | "repay" }
>;

export function CustomerInventoryCreditLifecycleDialog({
  currentBusinessDate,
  dialog,
  onClose,
  pendingKey,
  runAction,
}: {
  currentBusinessDate: string;
  dialog: LifecycleDialog;
  onClose: () => void;
  pendingKey: string | null;
  runAction: RunInventoryAction;
}) {
  const t = useTranslations("CustomerInventory");
  const actionKey = `${dialog.kind}:${dialog.credit.id}`;
  const formId = `inventory-credit-${dialog.kind}-${dialog.credit.id}`;

  async function handleSubmit(formData: FormData) {
    const success = await runAction(
      actionKey,
      t(`feedback.${dialog.kind}Success`),
      async (supabase) => {
        if (dialog.kind === "extend") {
          await callRpc(
            supabase.rpc("submit_customer_inventory_credit_extension", {
              p_credit_application_id: dialog.credit.id,
              p_extension_months: numberValue(formData, "months"),
              p_request_note: optionalValue(formData, "notes"),
            }),
          );
          return;
        }
        if (dialog.kind === "reviewExtension") {
          await callRpc(
            supabase.rpc("review_customer_inventory_credit_extension", {
              p_decision: requiredValue(formData, "decision"),
              p_extension_request_id: dialog.extension.id,
              p_review_note: optionalValue(formData, "notes"),
            }),
          );
          return;
        }
        await callRpc(
          supabase.rpc("record_customer_inventory_credit_repayment", {
            p_credit_application_id: dialog.credit.id,
            p_note: optionalValue(formData, "notes"),
            p_paid_on: requiredValue(formData, "paidOn"),
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
            disabled={pendingKey === actionKey}
            loading={pendingKey === actionKey}
            form={formId}
            type="submit"
          >
            {pendingKey === actionKey
              ? t("common.saving")
              : t(`creditDialogs.${dialog.kind}Submit`)}
          </Button>
        </>
      }
      description={t(`creditDialogs.${dialog.kind}Description`)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t(`creditDialogs.${dialog.kind}Title`)}
    >
      <form
        className="grid min-w-0 gap-5"
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(new FormData(event.currentTarget));
        }}
      >
        {dialog.kind === "extend" ? (
          <>
            <p className="text-sm leading-7 text-content-muted">
              {t("creditDialogs.extendDue", {
                date: formatInventoryDate(dialog.credit.due_on),
              })}
            </p>
            <FormControls.Field label={t("fields.extensionMonths")} required>
              <Select
                name="months"
                options={[1, 2, 3].map((month) => ({
                  label: t("creditDialogs.months", { count: month }),
                  value: String(month),
                }))}
                required
              />
            </FormControls.Field>
          </>
        ) : null}

        {dialog.kind === "reviewExtension" ? (
          <>
            <p className="text-sm leading-7 text-content-muted">
              {t("creditDialogs.extensionRequestSummary", {
                count: dialog.extension.extension_months,
                date: formatInventoryDate(dialog.credit.due_on),
              })}
            </p>
            <FormControls.Field label={t("fields.reviewDecision")} required>
              <Select
                name="decision"
                options={[
                  { label: t("decisions.approve"), value: "approve" },
                  { label: t("decisions.reject"), value: "reject" },
                ]}
                required
              />
            </FormControls.Field>
          </>
        ) : null}

        {dialog.kind === "repay" ? (
          <>
            <div className="rounded-record-card border border-border-subtle bg-surface-inset p-4 text-sm">
              <p className="font-semibold text-content-strong">
                {t("creditDialogs.repayPrincipal", {
                  amount: formatInventoryMoney(
                    dialog.credit.approved_amount_usd,
                    "USD",
                  ),
                })}
              </p>
              <p className="mt-2 text-content-muted">
                {t("creditDialogs.repayInterest", {
                  amount: formatInventoryMoney(
                    getCustomerInventoryInterest(
                      dialog.credit,
                      currentBusinessDate,
                    ),
                    "USD",
                  ),
                })}
              </p>
            </div>
            <FormControls.Field label={t("fields.repaidOn")} required>
              <DatePicker
                defaultValue={currentBusinessDate}
                max={currentBusinessDate}
                min={dialog.credit.used_on ?? undefined}
                name="paidOn"
                required
              />
            </FormControls.Field>
          </>
        ) : null}

        <FormControls.Field label={t("fields.notes")}>
          <FormControls.Textarea className="min-h-28 py-3" name="notes" />
        </FormControls.Field>
      </form>
    </DashboardDialog>
  );
}
