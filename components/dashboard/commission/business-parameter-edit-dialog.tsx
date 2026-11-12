"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import {
  DashboardFormField,
  DashboardFormTextarea,
} from "@/components/dashboard/dashboard-form-dialog";
import { FeedbackNotice } from "@/components/dashboard/dashboard-shared-ui";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { ChoiceField, Input } from "@/components/ui/form-controls";
import type { CommissionRuleConfig } from "@/lib/commission-settings";

import { ParameterValueList } from "./admin-commission-settings-ui";
import { previewBusinessParameterDraft } from "./business-parameter-draft";
import type { BusinessParameterEditor } from "./use-business-parameter-settings-view-model";

export function BusinessParameterEditDialog({
  editor,
  errorMessage,
  locale,
  onClose,
  onPublish,
  onUpdate,
  pending,
}: {
  editor: BusinessParameterEditor | null;
  errorMessage?: string;
  locale: string;
  onClose: () => void;
  onPublish: () => void;
  onUpdate: (patch: Partial<BusinessParameterEditor>) => void;
  pending: boolean;
}) {
  const t = useTranslations("Commission.settings");
  const ruleText = useTranslations("Commission");
  if (!editor) return null;

  const monthlyOnly =
    editor.setting.parameterCode === "wholesale_referral_waybill_bonus";
  const previewConfig = previewBusinessParameterDraft(editor.definition, editor.draft);

  return (
    <DashboardDialog
      actions={
        <>
          {/* 错误放在固定底栏，手机滑到确认按钮时仍能看到修改原因。 */}
          {errorMessage ? (
            <div className="w-full">
              <FeedbackNotice tone="error">{errorMessage}</FeedbackNotice>
            </div>
          ) : null}
          <Button
            disabled={pending}
            onClick={onClose}
            type="button"
            variant="outline"
            wrap
          >
            {t("actions.cancel")}
          </Button>
          <Button
            data-testid="business-parameter-review-publish"
            disabled={pending}
            onClick={onPublish}
            type="button"
            wrap
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {t("actions.reviewPublish")}
          </Button>
        </>
      }
      description={t("editor.description")}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
      open
      title={t("editor.title", { name: ruleText(editor.definition.labelKey) })}
    >
      <div className="grid min-w-0 gap-6">
        <section className="grid min-w-0 gap-4 sm:grid-cols-2">
          {editor.definition.fields.map((field) => (
            <DashboardFormField
              controlId={`business-parameter-${field.configKey}`}
              hint={field.kind === "rate" ? t("editor.rateHint") : undefined}
              key={field.configKey}
              label={ruleText(field.labelKey)}
              required
            >
              <Input
                data-testid={`business-parameter-input-${field.configKey}`}
                id={`business-parameter-${field.configKey}`}
                inputMode={field.kind === "count" ? "numeric" : "decimal"}
                onChange={(event) =>
                  onUpdate({
                    draft: {
                      ...editor.draft,
                      [field.configKey]: event.target.value,
                    },
                  })
                }
                value={editor.draft[field.configKey] ?? ""}
              />
            </DashboardFormField>
          ))}
        </section>

        <section className="grid gap-3 rounded-surface-card border border-border-subtle bg-surface-inset p-4">
          <h4 className="text-sm font-semibold text-content-strong">
            {t("effective.title")}
          </h4>
          {monthlyOnly ? (
            <p className="text-sm leading-6 text-content-muted">
              {t("effective.monthlyOnly")}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <TimingChoice
                checked={editor.effectiveMode === "immediate"}
                label={t("effective.immediate")}
                onChange={() => onUpdate({ effectiveMode: "immediate" })}
                value="immediate"
              />
              <TimingChoice
                checked={editor.effectiveMode === "scheduled"}
                label={t("effective.scheduled")}
                onChange={() => onUpdate({ effectiveMode: "scheduled" })}
                value="scheduled"
              />
            </div>
          )}
          {editor.effectiveMode === "scheduled" ? (
            <DashboardFormField
              controlId="business-parameter-effective-time"
              label={t("effective.time")}
              hint={
                monthlyOnly
                  ? t("effective.monthlyHint")
                  : t("effective.scheduleHint")
              }
              required
            >
              <DatePicker
                data-testid="business-parameter-effective-time"
                id="business-parameter-effective-time"
                mode="datetime-local"
                onValueChange={(value) => onUpdate({ effectiveLocal: value })}
                readOnly={monthlyOnly}
                value={editor.effectiveLocal}
              />
            </DashboardFormField>
          ) : null}
        </section>

        <DashboardFormField
          controlId="business-parameter-change-reason"
          hint={t("editor.reasonHint")}
          label={t("editor.reason")}
          required
        >
          <DashboardFormTextarea
            data-testid="business-parameter-change-reason"
            id="business-parameter-change-reason"
            maxLength={500}
            onChange={(event) => onUpdate({ reason: event.target.value })}
            rows={3}
            value={editor.reason}
          />
        </DashboardFormField>

        <section className="grid min-w-0 gap-4 rounded-surface-card border border-border-subtle p-4 sm:grid-cols-2">
          <DiffColumn label={t("editor.before")}>
            <ParameterValueList
              config={editor.setting.currentVersion.config}
              definition={editor.definition}
              locale={locale}
            />
          </DiffColumn>
          <DiffColumn label={t("editor.after")}>
            <ParameterValueList
              config={previewConfig}
              definition={editor.definition}
              locale={locale}
            />
          </DiffColumn>
        </section>
        <p className="break-words rounded-surface-card bg-accent-subtle px-4 py-3 text-sm leading-6 text-content-muted [overflow-wrap:anywhere]">
          {ruleText(
            editor.definition.calculationKey,
            calculationValues(previewConfig, locale, t("table.missing")),
          )}
        </p>
      </div>
    </DashboardDialog>
  );
}

function TimingChoice({
  checked,
  label,
  onChange,
  value,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
  value: string;
}) {
  return (
    <ChoiceField
      checked={checked}
      label={label}
      name="effective-mode"
      onChange={onChange}
      type="radio"
      value={value}
    />
  );
}

function DiffColumn({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-3 text-xs font-semibold tracking-wide text-content-muted uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

function calculationValues(
  config: CommissionRuleConfig,
  locale: string,
  missing: string,
) {
  const value = (key: string, options?: Intl.NumberFormatOptions) => {
    const numberValue = config[key];
    return Number.isFinite(numberValue)
      ? new Intl.NumberFormat(locale, options).format(numberValue)
      : missing;
  };
  const percent = { style: "percent", maximumFractionDigits: 2 } satisfies Intl.NumberFormatOptions;
  return {
    bonusUsd: value("bonus_usd", { currency: "USD", style: "currency" }),
    rate: value("rate", percent),
    tier1BonusUsd: value("tier_1_bonus_usd", {
      currency: "USD",
      style: "currency",
    }),
    tier1Count: value("tier_1_threshold"),
    existingCustomerRate: value("existing_customer_rate", percent),
    newCustomerServiceFeeRate: value("new_customer_service_fee_rate", percent),
    tier2BonusUsd: value("tier_2_bonus_usd", {
      currency: "USD",
      style: "currency",
    }),
    tier2Count: value("tier_2_threshold"),
    tier3BonusUsd: value("tier_3_bonus_usd", {
      currency: "USD",
      style: "currency",
    }),
    tier3Count: value("tier_3_threshold"),
  };
}
