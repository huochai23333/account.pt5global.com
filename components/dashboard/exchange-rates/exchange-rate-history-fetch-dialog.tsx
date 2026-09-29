"use client";

import { CalendarRange, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocale } from "@/components/i18n/locale-provider";
import { formatExchangeRateQuoteTime } from "./exchange-rates-utils";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import * as FormControls from "@/components/ui/form-controls";
import type { HistoricalExchangeRateFetchResult } from "@/lib/exchange-rates";
import { DashboardFormField, FormDialog } from "../dashboard-form-dialog";
import { dashboardFilterInputClassName } from "../dashboard-section-panel";

import type { HistoricalExchangeRateFormState } from "./use-exchange-rate-history-fetch";

type ExchangeRateHistoryFetchDialogProps = {
  canAddCurrency: boolean;
  dayCount: number;
  feedback: { message: string; tone: "error" | "info" | "success" } | null;
  formState: HistoricalExchangeRateFormState;
  maxDate: string;
  onAddCurrency: () => void;
  onCurrencyChange: (index: number, value: string) => void;
  onDateChange: (key: "fromDate" | "toDate", value: string) => void;
  onOpenChange: (open: boolean) => void;
  onRemoveCurrency: (index: number) => void;
  onSubmit: () => void;
  open: boolean;
  pending: boolean;
  result: HistoricalExchangeRateFetchResult | null;
};

export function ExchangeRateHistoryFetchDialog({
  canAddCurrency,
  dayCount,
  feedback,
  formState,
  maxDate,
  onAddCurrency,
  onCurrencyChange,
  onDateChange,
  onOpenChange,
  onRemoveCurrency,
  onSubmit,
  open,
  pending,
  result,
}: ExchangeRateHistoryFetchDialogProps) {
  const t = useTranslations("ExchangeRates.historicalFetch");
  const { locale } = useLocale();
  const failedResults = result?.results.filter((item) => item.status === "failed") ?? [];
  const completedResults = result?.results.filter((item) => item.status !== "failed") ?? [];
  const currencyCount = new Set(
    formState.currencies
      .map((currency) => currency.trim().toUpperCase())
      .filter(Boolean),
  ).size;

  return (
    <FormDialog
      cancelLabel={t("cancel")}
      description={t("description")}
      feedback={feedback}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open={open}
      pending={pending}
      submitLabel={pending ? t("pending") : t("submit")}
      title={t("title")}
    >
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <DashboardFormField label={t("fromDate")} required>
          <DatePicker
            disabled={pending}
            max={maxDate}
            onValueChange={(value) => onDateChange("fromDate", value)}
            value={formState.fromDate}
          />
        </DashboardFormField>
        <DashboardFormField label={t("toDate")} required>
          <DatePicker
            disabled={pending}
            max={maxDate}
            onValueChange={(value) => onDateChange("toDate", value)}
            value={formState.toDate}
          />
        </DashboardFormField>
      </div>

      <section className="space-y-3" aria-labelledby="historical-currencies-title">
        <div>
          <h3
            className="text-sm font-semibold text-content-strong"
            id="historical-currencies-title"
          >
            {t("currencies")}
          </h3>
          <p className="mt-1 text-sm leading-6 text-content-muted">
            {t("currenciesHint")}
          </p>
        </div>

        <div className="space-y-2">
          {formState.currencies.map((currency, index) => (
            <div
              className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
              key={`historical-currency-${index}`}
            >
              <FormControls.Input
                aria-label={t("currencyLabel", { index: index + 1 })}
                className={dashboardFilterInputClassName}
                disabled={pending}
                maxLength={3}
                onChange={(event) => onCurrencyChange(index, event.target.value)}
                placeholder={t("currencyPlaceholder")}
                value={currency}
              />
              <Button
                aria-label={t("removeCurrency", { index: index + 1 })}
                disabled={pending || formState.currencies.length === 1}
                onClick={() => onRemoveCurrency(index)}
                size="icon-compact"
                type="button"
                variant="outline"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          disabled={pending || !canAddCurrency}
          onClick={onAddCurrency}
          size="compact"
          type="button"
          variant="outline"
        >
          <Plus className="size-4" />
          {t("addCurrency")}
        </Button>
      </section>

      <div className="flex min-w-0 items-start gap-3 rounded-surface-inset bg-surface-inset px-4 py-3 text-sm leading-6 text-content-muted">
        <CalendarRange className="mt-1 size-4 shrink-0" />
        <p className="min-w-0 break-words [overflow-wrap:anywhere]">
          {t("estimate", {
            currencies: currencyCount,
            days: dayCount,
            total: dayCount * currencyCount,
          })}
        </p>
      </div>

      {completedResults.length > 0 ? <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("completedTitle")}</h3>
        <div className="max-h-40 space-y-2 overflow-y-auto rounded-surface-inset bg-surface-inset p-3">
          {completedResults.map(item => <p key={`${item.baseCurrency}-${item.rateDate}`} className="break-all text-xs leading-6">
            {t("completedItem", { currency: item.baseCurrency, date: item.rateDate, rate: item.rate ?? "", id: item.rateRecordId ?? "", time: formatExchangeRateQuoteTime(item.quotedAt, locale) })}
          </p>)}
        </div>
      </section> : null}
      {failedResults.length > 0 ? (
        <section className="space-y-2" aria-labelledby="historical-failures-title">
          <h3
            className="text-sm font-semibold text-content-strong"
            id="historical-failures-title"
          >
            {t("failedTitle")}
          </h3>
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-surface-inset bg-surface-inset p-3">
            {failedResults.map((item) => (
              <p
                className="break-words text-sm leading-6 text-content-muted [overflow-wrap:anywhere]"
                key={`${item.baseCurrency}-${item.rateDate}`}
              >
                {t("failedItem", {
                  currency: item.baseCurrency,
                  date: item.rateDate,
                })}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </FormDialog>
  );
}
