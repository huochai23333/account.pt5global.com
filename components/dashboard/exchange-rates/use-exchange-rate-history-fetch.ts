"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { markBrowserCloudSyncActivity } from "@/lib/browser-sync-recovery";
import {
  getExchangeRatesPageData,
  normalizeCurrencyCode,
  triggerHistoricalExchangeRateFetch,
  type ExchangeRateSyncPairRow,
  type ExchangeRatesPageData,
  type HistoricalExchangeRateFetchResult,
} from "@/lib/exchange-rates";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import type { FeedbackTone } from "../dashboard-shared-ui";

import {
  getExchangeRateDateRangeDayCount,
  getHistoricalExchangeRateMaxDate,
} from "./exchange-rates-utils";

const MAX_CURRENCIES = 10;
const MAX_DAYS = 31;

export type HistoricalExchangeRateFormState = {
  currencies: string[];
  fromDate: string;
  toDate: string;
};

type DialogFeedback = { message: string; tone: FeedbackTone } | null;

function createInitialFormState(pairs: ExchangeRateSyncPairRow[]) {
  const configuredCurrencies = Array.from(
    new Set(
      pairs
        .filter((pair) => pair.is_enabled)
        .map((pair) => normalizeCurrencyCode(pair.base_currency))
        .filter(Boolean),
    ),
  ).slice(0, MAX_CURRENCIES);
  const maxDate = getHistoricalExchangeRateMaxDate();

  return {
    currencies: configuredCurrencies.length > 0 ? configuredCurrencies : ["USD"],
    fromDate: maxDate,
    toDate: maxDate,
  } satisfies HistoricalExchangeRateFormState;
}

/** 历史补充的表单、校验、请求和结果都留在独立 hook，页面 Client 只负责组装弹窗。 */
export function useExchangeRateHistoryFetch({
  canManage,
  onPageDataLoaded,
  syncPairs,
}: {
  canManage: boolean;
  onPageDataLoaded: (pageData: ExchangeRatesPageData) => void;
  syncPairs: ExchangeRateSyncPairRow[];
}) {
  const supabase = getBrowserSupabaseClient();
  const t = useTranslations("ExchangeRates.historicalFetch");
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<DialogFeedback>(null);
  const [result, setResult] = useState<HistoricalExchangeRateFetchResult | null>(
    null,
  );
  const [formState, setFormState] = useState<HistoricalExchangeRateFormState>(() =>
    createInitialFormState(syncPairs),
  );
  const maxDate = getHistoricalExchangeRateMaxDate();
  const dayCount = getExchangeRateDateRangeDayCount(
    formState.fromDate,
    formState.toDate,
  );
  const normalizedCurrencies = useMemo(
    () =>
      Array.from(
        new Set(formState.currencies.map(normalizeCurrencyCode).filter(Boolean)),
      ),
    [formState.currencies],
  );

  const clearResult = useCallback(() => {
    setFeedback(null);
    setResult(null);
  }, []);

  const openDialog = useCallback(() => {
    if (!canManage || inFlight.current) return;
    setFormState(createInitialFormState(syncPairs));
    setFeedback(null);
    setResult(null);
    setOpen(true);
  }, [canManage, syncPairs]);

  const setOpenState = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && inFlight.current) return;
      setOpen(nextOpen);
      if (!nextOpen) {
        setFeedback(null);
        setResult(null);
      }
    },
    [],
  );

  const updateDate = useCallback(
    (key: "fromDate" | "toDate", value: string) => {
      clearResult();
      setFormState((current) => ({ ...current, [key]: value }));
    },
    [clearResult],
  );

  const updateCurrency = useCallback(
    (index: number, value: string) => {
      clearResult();
      setFormState((current) => ({
        ...current,
        currencies: current.currencies.map((currency, currencyIndex) =>
          currencyIndex === index ? value : currency,
        ),
      }));
    },
    [clearResult],
  );

  const addCurrency = useCallback(() => {
    clearResult();
    setFormState((current) =>
      current.currencies.length >= MAX_CURRENCIES
        ? current
        : { ...current, currencies: [...current.currencies, ""] },
    );
  }, [clearResult]);

  const removeCurrency = useCallback(
    (index: number) => {
      clearResult();
      setFormState((current) => {
        const currencies = current.currencies.filter(
          (_, currencyIndex) => currencyIndex !== index,
        );
        return { ...current, currencies: currencies.length > 0 ? currencies : [""] };
      });
    },
    [clearResult],
  );

  const submit = useCallback(async () => {
    if (!supabase || !canManage || inFlight.current) return;

    const rawCurrencies = formState.currencies.map((currency) => currency.trim());
    if (rawCurrencies.some((currency) => !/^[A-Za-z]{3}$/.test(currency))) {
      setFeedback({ tone: "error", message: t("validation.currency") });
      return;
    }
    if (normalizedCurrencies.length === 0 || normalizedCurrencies.length > MAX_CURRENCIES) {
      setFeedback({ tone: "error", message: t("validation.currencyCount") });
      return;
    }
    if (!formState.fromDate || !formState.toDate) {
      setFeedback({ tone: "error", message: t("validation.datesRequired") });
      return;
    }
    if (formState.fromDate > formState.toDate) {
      setFeedback({ tone: "error", message: t("validation.dateOrder") });
      return;
    }
    if (formState.toDate > maxDate) {
      setFeedback({ tone: "error", message: t("validation.latestDate") });
      return;
    }
    if (dayCount <= 0 || dayCount > MAX_DAYS) {
      setFeedback({ tone: "error", message: t("validation.range") });
      return;
    }

    // 当次提交的币种和日期随请求一起固定，重复点击只保留一次提交。
    inFlight.current = true;
    setPending(true);
    setFeedback(null);
    setResult(null);
    setFormState((current) => ({ ...current, currencies: normalizedCurrencies }));

    try {
      const nextResult = await triggerHistoricalExchangeRateFetch(supabase, {
        baseCurrencies: normalizedCurrencies,
        fromDate: formState.fromDate,
        toDate: formState.toDate,
      });
      const pageData = await getExchangeRatesPageData(supabase, "manage");
      onPageDataLoaded(pageData);
      markBrowserCloudSyncActivity();
      setResult(nextResult);
      const completedCount = nextResult.insertedCount + nextResult.skippedCount;
      setFeedback({
        tone: nextResult.failedCount === 0 ? "success" : completedCount > 0 ? "info" : "error",
        message: t("feedback.complete", {
          failed: nextResult.failedCount,
          inserted: nextResult.insertedCount,
          skipped: nextResult.skippedCount,
        }),
      });
    } catch {
      setFeedback({
        tone: "error",
        message: t("feedback.failed"),
      });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, [
    canManage,
    dayCount,
    formState,
    maxDate,
    normalizedCurrencies,
    onPageDataLoaded,
    supabase,
    t,
  ]);

  return {
    addCurrency,
    canAddCurrency: formState.currencies.length < MAX_CURRENCIES,
    dayCount,
    feedback,
    formState,
    maxDate,
    open,
    openDialog,
    pending,
    removeCurrency,
    result,
    setOpen: setOpenState,
    submit,
    updateCurrency,
    updateDate,
  };
}
