"use client";

import { Select } from "@/components/ui/select";
import * as FormControls from "@/components/ui/form-controls";

import { LoaderCircle, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import type { SalesmanCustomerRow, SalesmanCustomerType } from "@/lib/salesman-people-contract";

import {
  getSalesmanCustomerContact,
  getSalesmanCustomerName,
  getSalesmanCustomerTypeLabel,
} from "./salesman-people-display";
import type { useSalesmanPeopleViewModel } from "./use-salesman-people-view-model";

type SalesmanPeopleViewModel = ReturnType<typeof useSalesmanPeopleViewModel>;

export function SalesmanCustomerTypeDialog({
  canSave,
  customer,
  customerTypeLabels,
  customerTypeOptions,
  draftType,
  onClose,
  onDraftTypeChange,
  onSave,
  open,
  saving,
}: {
  canSave: boolean;
  customer: SalesmanCustomerRow | null;
  customerTypeLabels: SalesmanPeopleViewModel["customerTypeLabels"];
  customerTypeOptions: SalesmanPeopleViewModel["customerTypeOptions"];
  draftType: SalesmanCustomerType | "";
  onClose: () => void;
  onDraftTypeChange: (value: string) => void;
  onSave: () => void;
  open: boolean;
  saving: boolean;
}) {
  const t = useTranslations("SalesmanPeople");
  const fallback = t("fallback.notProvided");

  return (
    <DashboardDialog
      actions={
        <>
          <Button
            variant="outline"
            size="compact"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            {t("actions.cancel")}
          </Button>
          <Button
            variant="primary"
            size="compact"
            disabled={!canSave}
            onClick={onSave}
            type="button"
          >
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {saving ? t("actions.saving") : t("actions.save")}
          </Button>
        </>
      }
      description={t("dialog.description")}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      open={open}
      title={t("dialog.title", {
        name: customer
          ? getSalesmanCustomerName(customer, t("fallback.unnamedCustomer"))
          : t("fallback.unnamedCustomer"),
      })}
    >
      {customer ? (
        <div className="space-y-5">
          <div className="rounded-control-large border border-border-subtle bg-surface-interactive p-5">
            <p className="text-lg font-semibold text-content-strong">
              {getSalesmanCustomerName(customer, t("fallback.unnamedCustomer"))}
            </p>
            <p className="mt-1 break-all text-sm text-content-muted">
              {getSalesmanCustomerContact(customer, fallback)}
            </p>
            <div className="mt-4 rounded-record-card bg-surface-inset px-4 py-3">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-content-subtle uppercase">
                {t("dialog.currentType")}
              </p>
              <p className="mt-1 text-sm font-semibold text-content-strong">
                {getSalesmanCustomerTypeLabel(
                  customer.customer_type,
                  customerTypeLabels,
                  t("fallback.unmarked"),
                )}
              </p>
            </div>
          </div>

          <FormControls.Field label={t("dialog.nextType")} required>
            <Select
              disabled={saving}
              onValueChange={onDraftTypeChange}
              options={[
                { label: t("dialog.typePlaceholder"), value: "" },
                ...customerTypeOptions.map((customerType) => ({
                  label: customerTypeLabels[customerType],
                  value: customerType,
                })),
              ]}
              value={draftType}
            />
          </FormControls.Field>
        </div>
      ) : null}
    </DashboardDialog>
  );
}
