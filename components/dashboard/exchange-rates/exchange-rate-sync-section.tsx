"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";

import * as FormControls from "@/components/ui/form-controls";

import { memo } from "react";

import { useTranslations } from "next-intl";
import {
  CalendarRange,
  Clock3,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import {
  normalizeCurrencyCode,
  type ExchangeRateSyncState,
  type ManualExchangeRateFetchItem,
} from "@/lib/exchange-rates";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/i18n/locale-provider";
import { formatExchangeRateQuoteTime } from "./exchange-rates-utils";

import { Button } from "../../ui/button";
import {
  DashboardFilterField,
  DashboardListSection,
  dashboardFilterInputClassName,
} from "../dashboard-section-panel";
import { FeedbackNotice, type FeedbackTone } from "../dashboard-shared-ui";

type SyncFeedback = {
  message: string;
  tone: FeedbackTone;
} | null;

type ExchangeRateSyncSectionProps = {
  addPairPending: boolean;
  feedback: SyncFeedback;
  manualCurrencies: string[];
  manualFetchPending: boolean;
  manualResults: ManualExchangeRateFetchItem[];
  onAddManualCurrency: () => void;
  onAddPair: () => void;
  onAutoSyncChange: (enabled: boolean) => void;
  onManualCurrencyChange: (index: number, value: string) => void;
  onManualFetch: () => void;
  onOpenHistoricalFetch: () => void;
  onPairInputChange: (value: string) => void;
  onRemoveManualCurrency: (index: number) => void;
  onRemovePair: (pairId: string, currency: string) => void;
  pairInput: string;
  removePairPendingId: string | null;
  settingsPending: boolean;
  syncState: ExchangeRateSyncState | null;
};

export const ExchangeRateSyncSection = memo(function ExchangeRateSyncSection({
  addPairPending,
  feedback,
  manualCurrencies,
  manualFetchPending,
  manualResults,
  onAddManualCurrency,
  onAddPair,
  onAutoSyncChange,
  onManualCurrencyChange,
  onManualFetch,
  onOpenHistoricalFetch,
  onPairInputChange,
  onRemoveManualCurrency,
  onRemovePair,
  pairInput,
  removePairPendingId,
  settingsPending,
  syncState,
}: ExchangeRateSyncSectionProps) {
  const t = useTranslations("ExchangeRates");
  const { locale } = useLocale();
  const isEnabled = syncState?.settings.is_enabled ?? false;
  const pairs = syncState?.pairs ?? [];

  return (
    <DashboardListSection
      actions={
        <div className="inline-flex items-center gap-2 rounded-full bg-surface-inset px-4 py-2 text-sm text-content-muted">
          <Clock3 className="size-4" />
          {t("sync.schedule")}
        </div>
      }
      description={t("sync.description")}
      eyebrow={t("sync.eyebrow")}
      title={t("sync.title")}
    >
      <div className="space-y-5">
        {feedback ? (
          <FeedbackNotice tone={feedback.tone}>
            {feedback.message}
          </FeedbackNotice>
        ) : null}

        <div className="flex flex-col gap-4 border-b border-border-subtle pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-content-strong">
              {t("sync.autoFetchTitle")}
            </p>
            <p className="mt-1 text-sm leading-6 text-content-muted">
              {isEnabled
                ? t("sync.autoFetchEnabled")
                : t("sync.autoFetchDisabled")}
            </p>
          </div>
          <FormControls.ChoiceField
            checked={isEnabled}
            disabled={settingsPending}
            label={
              settingsPending
                ? t("sync.switchPending")
                : isEnabled
                  ? t("sync.switchOn")
                  : t("sync.switchOff")
            }
            onChange={(event) => onAutoSyncChange(event.target.checked)}
            type="toggle"
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-content-strong">
                {t("sync.pairsTitle")}
              </p>
              <p className="mt-1 text-sm leading-6 text-content-muted">
                {t("sync.pairsDescription")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {pairs.length === 0 ? (
                <span className="rounded-full bg-surface-inset px-3 py-2 text-sm text-content-muted">
                  {t("sync.noPairs")}
                </span>
              ) : (
                pairs.map((pair) => {
                  const currency = normalizeCurrencyCode(pair.base_currency);
                  const removing = removePairPendingId === pair.id;

                  return (
                    <span
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border-subtle bg-surface-interactive px-3 text-sm font-medium text-content-muted"
                      key={pair.id}
                    >
                      {currency} {" -> "} CNY
                      <DesignButton
                        aria-label={t("sync.removePair", { currency })}
                        className="inline-flex size-7 items-center justify-center rounded-full text-content-muted transition-colors hover:bg-surface-inset"
                        disabled={removing}
                        onClick={() => onRemovePair(pair.id, currency)}
                        type="button"
                      >
                        {removing ? (
                          <LoaderCircle className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </DesignButton>
                    </span>
                  );
                })
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <DashboardFilterField label={t("sync.addPairLabel")}>
                <FormControls.Input
                  className={dashboardFilterInputClassName}
                  onChange={(event) => onPairInputChange(event.target.value)}
                  placeholder={t("sync.currencyPlaceholder")}
                  type="text"
                  value={pairInput}
                />
              </DashboardFilterField>
              <div className="flex items-end">
                <Button
                  variant="primary"
                  size="default"
                  disabled={addPairPending}
                  onClick={onAddPair}
                  type="button"
                >
                  {addPairPending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {t("sync.addPair")}
                </Button>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-content-strong">
                {t("sync.manualTitle")}
              </p>
              <p className="mt-1 text-sm leading-6 text-content-muted">
                {t("sync.manualDescription")}
              </p>
            </div>

            <div className="space-y-3">
              {manualCurrencies.map((currency, index) => (
                <div
                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                  key={`${index}-${manualCurrencies.length}`}
                >
                  <FormControls.Input
                    className={dashboardFilterInputClassName}
                    onChange={(event) =>
                      onManualCurrencyChange(index, event.target.value)
                    }
                    placeholder={t("sync.currencyPlaceholder")}
                    type="text"
                    value={currency}
                  />
                  <Button
                    aria-label={t("sync.removeManualCurrency")}
                    disabled={
                      manualFetchPending || manualCurrencies.length === 1
                    }
                    onClick={() => onRemoveManualCurrency(index)}
                    type="button"
                    variant="outline"
                    size="icon-compact"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                disabled={manualFetchPending}
                onClick={onAddManualCurrency}
                type="button"
                variant="outline"
                size="compact"
              >
                <Plus className="size-4" />
                {t("sync.addManualCurrency")}
              </Button>
              <Button
                variant="primary"
                size="default"
                disabled={manualFetchPending}
                onClick={onManualFetch}
                type="button"
              >
                {manualFetchPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {t("sync.fetchNow")}
              </Button>
              <Button
                disabled={manualFetchPending}
                onClick={onOpenHistoricalFetch}
                type="button"
                variant="outline"
                size="default"
              >
                <CalendarRange className="size-4" />
                {t("sync.fetchHistorical")}
              </Button>
            </div>

            {manualResults.length > 0 ? (
              <div className="space-y-2">
                {manualResults.map((result) => (
                  <p
                    className={cn(
                      "text-sm",
                      result.ok ? "text-content-muted" : "text-content-muted",
                    )}
                    key={`${result.baseCurrency}-${result.targetCurrency}`}
                  >
                    {result.ok
                      ? t("sync.resultSuccess", {
                          currency: result.baseCurrency,
                          rate: result.rate ?? "",
                        })
                      : t("sync.resultFailed", {
                          currency: result.baseCurrency,
                        })}
                    {result.ok && result.rateRecordId ? <span className="mt-1 block break-all text-xs">
                      {t("sync.resultProof", { id: result.rateRecordId, time: formatExchangeRateQuoteTime(result.quotedAt, locale) })}
                    </span> : null}
                  </p>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </DashboardListSection>
  );
});
