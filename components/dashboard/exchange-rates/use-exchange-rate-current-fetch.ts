"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { markBrowserCloudSyncActivity } from "@/lib/browser-sync-recovery";
import {
  getExchangeRatesPageData,
  triggerManualExchangeRateFetch,
  type ExchangeRatesPageData,
  type ManualExchangeRateFetchItem,
} from "@/lib/exchange-rates";
import type { getBrowserSupabaseClient } from "@/lib/supabase";
import type { FeedbackTone } from "../dashboard-shared-ui";

type Feedback = { message: string; tone: FeedbackTone } | null;

/** 当天报价的币种输入、请求和回执属于同一表单，自动获取配置由另一个 Hook 管理。 */
export function useExchangeRateCurrentFetch({
  canManage,
  formatError,
  onPageDataLoaded,
  setFeedback,
  supabase,
}: {
  canManage: boolean;
  formatError: (error: unknown) => string;
  onPageDataLoaded: (pageData: ExchangeRatesPageData) => void;
  setFeedback: (feedback: Feedback) => void;
  supabase: ReturnType<typeof getBrowserSupabaseClient>;
}) {
  const t = useTranslations("ExchangeRates");
  const inFlight = useRef(false);
  const [manualCurrencies, setManualCurrencies] = useState(["USD"]);
  const [manualFetchPending, setManualFetchPending] = useState(false);
  const [manualResults, setManualResults] = useState<ManualExchangeRateFetchItem[]>([]);

  const handleManualCurrencyChange = useCallback((index: number, value: string) => {
    if (inFlight.current) return;
    setManualResults([]);
    setManualCurrencies((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }, []);

  const handleAddManualCurrency = useCallback(() => {
    if (inFlight.current) return;
    setManualResults([]);
    setManualCurrencies((current) => [...current, ""]);
  }, []);

  const handleRemoveManualCurrency = useCallback((index: number) => {
    if (inFlight.current) return;
    setManualResults([]);
    setManualCurrencies((current) => {
      const nextCurrencies = current.filter((_, itemIndex) => itemIndex !== index);
      return nextCurrencies.length > 0 ? nextCurrencies : ["USD"];
    });
  }, []);

  const handleManualFetch = useCallback(async () => {
    if (!supabase || !canManage || inFlight.current) {
      return;
    }

    // ref 在 React 重新渲染之前生效，避免同一轮点击发出两次请求。
    inFlight.current = true;
    setManualFetchPending(true);
    setFeedback(null);
    setManualResults([]);

    try {
      const result = await triggerManualExchangeRateFetch(
        supabase,
        manualCurrencies,
      );
      const pageData = await getExchangeRatesPageData(supabase, "manage");

      onPageDataLoaded(pageData);
      markBrowserCloudSyncActivity();
      setManualResults(result.results);
      setFeedback({
        tone: result.failedCount > 0 || result.successCount === 0 ? "error" : "success",
        message: result.failedCount > 0 || result.successCount === 0
          ? t("sync.feedback.manualPartial", { count: result.successCount, failed: result.failedCount })
          : t("sync.feedback.manualFetched", { count: result.successCount }),
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: formatError(error),
      });
    } finally {
      inFlight.current = false;
      setManualFetchPending(false);
    }
  }, [
    canManage,
    formatError,
    manualCurrencies,
    onPageDataLoaded,
    setFeedback,
    supabase,
    t,
  ]);

  return {
    handleAddManualCurrency,
    handleManualCurrencyChange,
    handleManualFetch,
    handleRemoveManualCurrency,
    manualCurrencies,
    manualFetchPending,
    manualResults,
  };
}
