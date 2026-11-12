"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  buildExchangeRateLatestRows,
  getExchangeRatesPageData,
  normalizeCurrencyCode,
  type ExchangeRateRow,
  type ExchangeRatesPageData,
} from "@/lib/exchange-rates";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { useDashboardPagination } from "@/lib/use-dashboard-pagination";
import { normalizeSearchText, type FeedbackTone } from "@/components/dashboard/dashboard-shared-ui";
import { useWorkspaceSyncEffect } from "@/components/dashboard/workspace-session-provider";

import {
  createExchangeRateCopy,
  isExchangeRatePermissionMessage,
  toExchangeRateErrorMessage,
} from "./exchange-rates-utils";
import { useExchangeRateSyncSettings } from "./use-exchange-rate-sync-settings";
import { useExchangeRateManualEditor } from "./use-exchange-rate-manual-editor";
import { useExchangeRateHistoryFetch } from "./use-exchange-rate-history-fetch";

type FilterState = {
  originalCurrency: string;
  targetCurrency: string;
};

type PageFeedback = { tone: FeedbackTone; message: string } | null;

// 视图模型组合目录数据、筛选和各个编辑器，具体提交逻辑留在对应 Hook。
export function useExchangeRatesViewModel({
  initialData,
  mode,
}: {
  initialData: ExchangeRatesPageData;
  mode: "manage" | "readonly";
}) {
  const supabase = getBrowserSupabaseClient();
  const t = useTranslations("ExchangeRates");
  const copy = useMemo(() => createExchangeRateCopy(t), [t]);
  const [hasPermission, setHasPermission] = useState(initialData.hasPermission);
  const [pageFeedback, setPageFeedback] = useState<PageFeedback>(null);
  const [rates, setRates] = useState<ExchangeRateRow[]>(initialData.rates);
  const [filters, setFilters] = useState<FilterState>({
    originalCurrency: "",
    targetCurrency: "",
  });
  const applyPageData = useCallback((pageData: ExchangeRatesPageData) => {
    setHasPermission(pageData.hasPermission);
    setRates(pageData.rates);
  }, []);

  useEffect(() => applyPageData(initialData), [applyPageData, initialData]);

  const refreshExchangeRates = useCallback(
    async ({ isMounted }: { isMounted: () => boolean }) => {
      if (!supabase) return;

      try {
        const nextPageData = await getExchangeRatesPageData(supabase, mode);
        if (!isMounted()) return;
        applyPageData(nextPageData);
        setPageFeedback(null);
      } catch (error) {
        if (!isMounted()) return;
        const message = toExchangeRateErrorMessage(error, copy);
        if (isExchangeRatePermissionMessage(message, copy.errors.permission)) {
          setHasPermission(false);
          setRates([]);
          setPageFeedback(null);
          return;
        }
        setPageFeedback({ tone: "error", message });
      }
    },
    [applyPageData, copy, mode, supabase],
  );

  useWorkspaceSyncEffect(refreshExchangeRates);

  const canManage = mode === "manage" && hasPermission === true;
  const manualEditor = useExchangeRateManualEditor({ canManage, copy, setPageFeedback, setRates, supabase });
  const syncSettings = useExchangeRateSyncSettings({
    canManage,
    formatError: (error) => toExchangeRateErrorMessage(error, copy),
    initialState: initialData.syncState,
    onPageDataLoaded: applyPageData,
    supabase,
  });
  const historyFetch = useExchangeRateHistoryFetch({
    canManage,
    onPageDataLoaded: applyPageData,
    syncPairs: syncSettings.syncState?.pairs ?? [],
  });
  const latestRows = useMemo(() => buildExchangeRateLatestRows(rates), [rates]);
  const normalizedFilters = useMemo(
    () => ({
      originalCurrency: normalizeSearchText(normalizeCurrencyCode(filters.originalCurrency)),
      targetCurrency: normalizeSearchText(normalizeCurrencyCode(filters.targetCurrency)),
    }),
    [filters.originalCurrency, filters.targetCurrency],
  );
  const filteredLatestRows = useMemo(
    () =>
      latestRows.filter(
        (row) =>
          normalizeSearchText(normalizeCurrencyCode(row.original_currency)).includes(
            normalizedFilters.originalCurrency,
          ) &&
          normalizeSearchText(normalizeCurrencyCode(row.target_currency)).includes(
            normalizedFilters.targetCurrency,
          ),
      ),
    [latestRows, normalizedFilters],
  );
  const filteredHistoryRows = useMemo(
    () =>
      rates.filter(
        (row) =>
          normalizeSearchText(normalizeCurrencyCode(row.original_currency)).includes(
            normalizedFilters.originalCurrency,
          ) &&
          normalizeSearchText(normalizeCurrencyCode(row.target_currency)).includes(
            normalizedFilters.targetCurrency,
          ),
      ),
    [normalizedFilters, rates],
  );
  const latestPagination = useDashboardPagination(filteredLatestRows, 20, JSON.stringify(normalizedFilters));
  const historyPagination = useDashboardPagination(filteredHistoryRows, 20, JSON.stringify(normalizedFilters));

  return {
    ...manualEditor,
    canManage,
    clearFilters: () => setFilters({ originalCurrency: "", targetCurrency: "" }),
    filteredHistoryRows,
    filteredLatestRows,
    filters,
    hasActiveFilters: Boolean(filters.originalCurrency || filters.targetCurrency),
    hasPermission,
    historyFetch,
    historyPagination,
    latestPagination,
    latestRows,
    pageFeedback,
    rates,
    setOriginalCurrency: (value: string) =>
      setFilters((current) => ({ ...current, originalCurrency: value })),
    setTargetCurrency: (value: string) =>
      setFilters((current) => ({ ...current, targetCurrency: value })),
    syncSettings,
  };
}
