"use client";

import { useCallback, useEffect, useState } from "react";

import { useTranslations } from "next-intl";

import { markBrowserCloudSyncActivity } from "@/lib/browser-sync-recovery";
import {
  addExchangeRateSyncPair,
  getExchangeRateSyncState,
  normalizeCurrencyCode,
  removeExchangeRateSyncPair,
  setExchangeRateAutoSyncEnabled,
  type ExchangeRatesPageData,
  type ExchangeRateSyncState,
} from "@/lib/exchange-rates";
import { getBrowserSupabaseClient } from "@/lib/supabase";

import { type FeedbackTone } from "../dashboard-shared-ui";
import { useExchangeRateCurrentFetch } from "./use-exchange-rate-current-fetch";

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
  const [feedback, setFeedback] = useState<SyncFeedback>(null);
  const [settingsPending, setSettingsPending] = useState(false);
  const [addPairPending, setAddPairPending] = useState(false);
  const [removePairPendingId, setRemovePairPendingId] = useState<string | null>(
    null,
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

  // 当天报价完成后，用同一次读回更新目录与自动获取设置。
  const applyRefreshedPage = useCallback((pageData: ExchangeRatesPageData) => {
    onPageDataLoaded(pageData);
    setSyncState(pageData.syncState);
  }, [onPageDataLoaded]);
  const currentFetch = useExchangeRateCurrentFetch({
    canManage,
    formatError,
    onPageDataLoaded: applyRefreshedPage,
    setFeedback,
    supabase,
  });

  return {
    ...currentFetch,
    addPairPending,
    feedback,
    handleAddPair,
    handleAutoSyncChange,
    handleRemovePair,
    pairInput,
    removePairPendingId,
    setPairInput,
    settingsPending,
    syncState,
  };
}
