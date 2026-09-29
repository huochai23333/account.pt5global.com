"use client";

import { useCallback, useEffect, useState } from "react";

import { useTranslations } from "next-intl";

import { markBrowserCloudSyncActivity } from "@/lib/browser-sync-recovery";
import {
  addExchangeRateSyncPair,
  getExchangeRateSyncState,
  getExchangeRatesPageData,
  normalizeCurrencyCode,
  removeExchangeRateSyncPair,
  setExchangeRateAutoSyncEnabled,
  triggerManualExchangeRateFetch,
  type ExchangeRatesPageData,
  type ExchangeRateSyncState,
  type ManualExchangeRateFetchItem,
} from "@/lib/exchange-rates";
import { getBrowserSupabaseClient } from "@/lib/supabase";

import { type FeedbackTone } from "../dashboard-shared-ui";

type SyncFeedback = {
  message: string;
  tone: FeedbackTone;
} | null;

type UseExchangeRateSyncSettingsOptions = {
  canManage: boolean;
  formatError: (error: unknown) => string;
  initialState: ExchangeRateSyncState | null;
  onPageDataLoaded: (pageData: ExchangeRatesPageData) => void;
  supabase: ReturnType<typeof getBrowserSupabaseClient>;
};

export function useExchangeRateSyncSettings({
  canManage,
  formatError,
  initialState,
  onPageDataLoaded,
  supabase,
}: UseExchangeRateSyncSettingsOptions) {
  const t = useTranslations("ExchangeRates");
  const [syncState, setSyncState] = useState<ExchangeRateSyncState | null>(
    initialState,
  );
  const [pairInput, setPairInput] = useState("");
  const [manualCurrencies, setManualCurrencies] = useState(["USD"]);
  const [feedback, setFeedback] = useState<SyncFeedback>(null);
  const [settingsPending, setSettingsPending] = useState(false);
  const [addPairPending, setAddPairPending] = useState(false);
  const [removePairPendingId, setRemovePairPendingId] = useState<string | null>(
    null,
  );
  const [manualFetchPending, setManualFetchPending] = useState(false);
  const [manualResults, setManualResults] = useState<ManualExchangeRateFetchItem[]>(
    [],
  );

  useEffect(() => {
    setSyncState(initialState);
  }, [initialState]);

  const refreshSyncState = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const nextState = await getExchangeRateSyncState(supabase);
    setSyncState(nextState);
  }, [supabase]);

  const handleAutoSyncChange = useCallback(
    async (enabled: boolean) => {
      if (!supabase || !canManage || settingsPending) {
        return;
      }

      setSettingsPending(true);
      setFeedback(null);

      try {
        await setExchangeRateAutoSyncEnabled(supabase, enabled);
        await refreshSyncState();
        markBrowserCloudSyncActivity();
        setFeedback({
          tone: "success",
          message: enabled ? t("sync.feedback.enabled") : t("sync.feedback.disabled"),
        });
      } catch (error) {
        setFeedback({
          tone: "error",
          message: formatError(error),
        });
      } finally {
        setSettingsPending(false);
      }
    },
    [canManage, formatError, refreshSyncState, settingsPending, supabase, t],
  );

  const handleAddPair = useCallback(async () => {
    if (!supabase || !canManage || addPairPending) {
      return;
    }

    const normalizedPairInput = normalizeCurrencyCode(pairInput);

    if (!normalizedPairInput) {
      setFeedback({
        tone: "error",
        message: t("sync.feedback.currencyRequired"),
      });
      return;
    }

    setAddPairPending(true);
    setFeedback(null);

    try {
      await addExchangeRateSyncPair(supabase, normalizedPairInput);
      await refreshSyncState();
      markBrowserCloudSyncActivity();
      setPairInput("");
      setFeedback({
        tone: "success",
        message: t("sync.feedback.pairAdded", { currency: normalizedPairInput }),
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: formatError(error),
      });
    } finally {
      setAddPairPending(false);
    }
  }, [
    addPairPending,
    canManage,
    formatError,
    pairInput,
    refreshSyncState,
    supabase,
    t,
  ]);

  const handleRemovePair = useCallback(
    async (pairId: string, currency: string) => {
      if (!supabase || !canManage || removePairPendingId) {
        return;
      }

      setRemovePairPendingId(pairId);
      setFeedback(null);

      try {
        await removeExchangeRateSyncPair(supabase, pairId);
        await refreshSyncState();
        markBrowserCloudSyncActivity();
        setFeedback({
          tone: "success",
          message: t("sync.feedback.pairRemoved", { currency }),
        });
      } catch (error) {
        setFeedback({
          tone: "error",
          message: formatError(error),
        });
      } finally {
        setRemovePairPendingId(null);
      }
    },
    [
      canManage,
      formatError,
      refreshSyncState,
      removePairPendingId,
      supabase,
      t,
    ],
  );

  const handleManualCurrencyChange = useCallback((index: number, value: string) => {
    setManualResults([]);
    setManualCurrencies((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  }, []);

  const handleAddManualCurrency = useCallback(() => {
    setManualResults([]);
    setManualCurrencies((current) => [...current, ""]);
  }, []);

  const handleRemoveManualCurrency = useCallback((index: number) => {
    setManualResults([]);
    setManualCurrencies((current) => {
      const nextCurrencies = current.filter((_, itemIndex) => itemIndex !== index);
      return nextCurrencies.length > 0 ? nextCurrencies : ["USD"];
    });
  }, []);

  const handleManualFetch = useCallback(async () => {
    if (!supabase || !canManage || manualFetchPending) {
      return;
    }

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
      setSyncState(pageData.syncState);
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
      setManualFetchPending(false);
    }
  }, [
    canManage,
    formatError,
    manualCurrencies,
    manualFetchPending,
    onPageDataLoaded,
    supabase,
    t,
  ]);

  return {
    addPairPending,
    feedback,
    handleAddManualCurrency,
    handleAddPair,
    handleAutoSyncChange,
    handleManualCurrencyChange,
    handleManualFetch,
    handleRemoveManualCurrency,
    handleRemovePair,
    manualCurrencies,
    manualFetchPending,
    manualResults,
    pairInput,
    removePairPendingId,
    setPairInput,
    settingsPending,
    syncState,
  };
}
