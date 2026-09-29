"use client";

import * as FormControls from "@/components/ui/form-controls";
import { DatePicker } from "@/components/ui/date-picker";

import { useTranslations } from "next-intl";

import {
  FormDialog,
  DashboardFormField,
} from "@/components/dashboard/dashboard-form-dialog";
import type { FeedbackTone } from "@/components/dashboard/dashboard-shared-ui";

import type { ExchangeRateFormState } from "./exchange-rates-utils";

type ExchangeRateFormDialogProps = {
  feedback?: { tone: FeedbackTone; message: string } | null;
  formState: ExchangeRateFormState;
  mode: "create" | "edit";
  open: boolean;
  pending: boolean;
  onFieldChange: <Key extends keyof ExchangeRateFormState>(
    key: Key,
    value: ExchangeRateFormState[Key],
  ) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
};

export function ExchangeRateFormDialog({
  feedback,
  formState,
  mode,
  open,
  pending,
  onFieldChange,
  onOpenChange,
  onSubmit,
}: ExchangeRateFormDialogProps) {
  const t = useTranslations("ExchangeRates");

  return (
    <FormDialog
      cancelLabel={t("dialogs.cancel")}
      description={
        mode === "create"
          ? t("dialogs.create.description")
          : t("dialogs.edit.description")
      }
      feedback={feedback}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open={open}
      pending={pending}
      submitLabel={
        mode === "create"
          ? t("dialogs.create.submit")
          : t("dialogs.edit.submit")
      }
      title={
        mode === "create" ? t("dialogs.create.title") : t("dialogs.edit.title")
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <DashboardFormField
          label={t("dialogs.fields.originalCurrency")}
          required
        >
          <FormControls.Input
            disabled={pending}
            onChange={(event) =>
              onFieldChange("originalCurrency", event.target.value)
            }
            placeholder={t("dialogs.placeholders.originalCurrency")}
            type="text"
            value={formState.originalCurrency}
          />
        </DashboardFormField>

        <DashboardFormField label={t("dialogs.fields.targetCurrency")} required>
          <FormControls.Input
            disabled={pending}
            onChange={(event) =>
              onFieldChange("targetCurrency", event.target.value)
            }
            placeholder={t("dialogs.placeholders.targetCurrency")}
            type="text"
            value={formState.targetCurrency}
          />
        </DashboardFormField>

        <DashboardFormField
          label={t("dialogs.fields.dailyExchangeRate")}
          required
        >
          <FormControls.Input
            disabled={pending}
            min="0"
            onChange={(event) =>
              onFieldChange("dailyExchangeRate", event.target.value)
            }
            placeholder={t("dialogs.placeholders.dailyExchangeRate")}
            step="0.000001"
            type="number"
            value={formState.dailyExchangeRate}
          />
        </DashboardFormField>

        <div className="rounded-control-large border border-border-subtle bg-surface-inset px-4 py-4 text-sm leading-7 text-content-muted">
          {t("dialogs.currencyHint")}
        </div>
        <DashboardFormField label={t("dialogs.fields.quotedAt")} required>
          <DatePicker
            disabled={pending}
            onValueChange={(value) => onFieldChange("quotedAt", `${value}T${formState.quotedAt.split("T")[1] ?? ""}`)}
            value={formState.quotedAt.slice(0, 10)}
          />
        </DashboardFormField>
        {/* 银行时间精确到秒；日期选择器管日期，时间文本保留银行发布的秒数。 */}
        <DashboardFormField label={t("dialogs.fields.quoteTime")} required>
          <FormControls.Input
            disabled={pending}
            onChange={(event) => onFieldChange("quotedAt", `${formState.quotedAt.slice(0, 10)}T${event.target.value}`)}
            placeholder={t("dialogs.placeholders.quoteTime")}
            value={formState.quotedAt.split("T")[1] ?? ""}
          />
        </DashboardFormField>
      </div>
    </FormDialog>
  );
}
