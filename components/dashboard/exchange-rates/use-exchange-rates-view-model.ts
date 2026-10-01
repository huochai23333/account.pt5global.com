"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { markBrowserCloudSyncActivity } from "@/lib/browser-sync-recovery";
import {
  buildExchangeRateLatestRows,
  createExchangeRate,
  deleteExchangeRate,
  getExchangeRatePairLabel,
  getExchangeRatesPageData,
  normalizeCurrencyCode,
  sortExchangeRateRows,
  updateExchangeRate,
  type ExchangeRateRow,
  type ExchangeRatesPageData,
} from "@/lib/exchange-rates";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { useDashboardPagination } from "@/lib/use-dashboard-pagination";
import { normalizeSearchText, type FeedbackTone } from "@/components/dashboard/dashboard-shared-ui";
import { useWorkspaceSyncEffect } from "@/components/dashboard/workspace-session-provider";
import { useDashboardConfirm } from "@/components/dashboard/dashboard-confirm-provider";

import {
  createExchangeRateCopy,
  createExchangeRateFormState,
  createExchangeRateFormStateFromRow,
  isExchangeRatePermissionMessage,
  parseExchangeRateForm,
  toExchangeRateErrorMessage,
  type ExchangeRateFormState,
} from "./exchange-rates-utils";
import { useExchangeRateSyncSettings } from "./use-exchange-rate-sync-settings";
import { useExchangeRateHistoryFetch } from "./use-exchange-rate-history-fetch";

type FilterState = {
  originalCurrency: string;
  targetCurrency: string;
};

type PageFeedback = { tone: FeedbackTone; message: string } | null;

// 汇率页面的查询、筛选和写入状态集中在 view-model，页面组件只负责组合可见区块。
export function useExchangeRatesViewModel({
  initialData,
  mode,
}: {
  initialData: ExchangeRatesPageData;
  mode: "manage" | "readonly";
}) {
  const confirm = useDashboardConfirm();
  const confirmT = useTranslations("DashboardFramework.confirm");
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [createDialogFeedback, setCreateDialogFeedback] = useState<PageFeedback>(null);
  const [createFormState, setCreateFormState] = useState<ExchangeRateFormState>(() =>
    createExchangeRateFormState(),
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPending, setEditPending] = useState(false);
  const [editDialogFeedback, setEditDialogFeedback] = useState<PageFeedback>(null);
  const [editFormState, setEditFormState] = useState<ExchangeRateFormState>(() =>
    createExchangeRateFormState(),
  );
  const [editingRate, setEditingRate] = useState<ExchangeRateRow | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);

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

  const openCreateDialog = useCallback(() => {
    if (!canManage) return;
    setPageFeedback(null);
    setCreateDialogFeedback(null);
    setCreateFormState(createExchangeRateFormState());
    setCreateDialogOpen(true);
  }, [canManage]);

  const openEditDialog = useCallback(
    (row: ExchangeRateRow) => {
      if (!canManage) return;
      setPageFeedback(null);
      setEditDialogFeedback(null);
      setEditingRate(row);
      setEditFormState(createExchangeRateFormStateFromRow(row));
      setEditDialogOpen(true);
    },
    [canManage],
  );

  const updateCreateFormField = useCallback(
    <Key extends keyof ExchangeRateFormState>(key: Key, value: ExchangeRateFormState[Key]) => {
      setCreateDialogFeedback(null);
      setCreateFormState((current) => ({ ...current, [key]: value }));
    },
    [],
  );
  const updateEditFormField = useCallback(
    <Key extends keyof ExchangeRateFormState>(key: Key, value: ExchangeRateFormState[Key]) => {
      setEditDialogFeedback(null);
      setEditFormState((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const handleCreateRate = useCallback(async () => {
    if (!supabase || !canManage || createPending) return;
    const parsed = parseExchangeRateForm(createFormState, copy);
    if (!parsed.ok) {
      setCreateDialogFeedback({ tone: "error", message: parsed.message });
      return;
    }

    setCreatePending(true);
    setCreateDialogFeedback(null);
    setPageFeedback(null);
    try {
      const createdRate = await createExchangeRate(supabase, parsed.payload);
      const pairLabel = getExchangeRatePairLabel(
        createdRate.original_currency,
        createdRate.target_currency,
      );
      markBrowserCloudSyncActivity();
      setRates((current) => [createdRate, ...current]);
      setCreateDialogOpen(false);
      setCreateFormState(createExchangeRateFormState());
      setPageFeedback({ tone: "success", message: t("feedback.created", { pairLabel }) });
    } catch (error) {
      setCreateDialogFeedback({ tone: "error", message: toExchangeRateErrorMessage(error, copy) });
    } finally {
      setCreatePending(false);
    }
  }, [canManage, copy, createFormState, createPending, supabase, t]);

  const handleEditRate = useCallback(async () => {
    if (!supabase || !canManage || editPending || !editingRate) return;
    const parsed = parseExchangeRateForm(editFormState, copy);
    if (!parsed.ok) {
      setEditDialogFeedback({ tone: "error", message: parsed.message });
      return;
    }

    setEditPending(true);
    setEditDialogFeedback(null);
    setPageFeedback(null);
    try {
      const updatedRate = await updateExchangeRate(supabase, editingRate.id, parsed.payload);
      const pairLabel = getExchangeRatePairLabel(
        updatedRate.original_currency,
        updatedRate.target_currency,
      );
      markBrowserCloudSyncActivity();
      setRates((current) =>
        sortExchangeRateRows(current.map((row) => (row.id === updatedRate.id ? updatedRate : row))),
      );
      setEditDialogOpen(false);
      setEditingRate(null);
      setPageFeedback({ tone: "success", message: t("feedback.updated", { pairLabel }) });
    } catch (error) {
      setEditDialogFeedback({ tone: "error", message: toExchangeRateErrorMessage(error, copy) });
    } finally {
      setEditPending(false);
    }
  }, [canManage, copy, editFormState, editPending, editingRate, supabase, t]);

  const handleDeleteRate = useCallback(
    async (row: ExchangeRateRow) => {
      if (!supabase || !canManage || deletePendingId) return;
      const pairLabel = getExchangeRatePairLabel(row.original_currency, row.target_currency);
      if (!(await confirm({
        description: t("feedback.deleteConfirm", { pairLabel }),
        title: confirmT("title"),
        tone: "danger",
      }))) {
        return;
      }

      setDeletePendingId(row.id);
      setPageFeedback(null);
      try {
        await deleteExchangeRate(supabase, row.id);
        markBrowserCloudSyncActivity();
        setRates((current) => current.filter((item) => item.id !== row.id));
        setPageFeedback({ tone: "success", message: t("feedback.deleted", { pairLabel }) });
      } catch (error) {
        setPageFeedback({ tone: "error", message: toExchangeRateErrorMessage(error, copy) });
      } finally {
        setDeletePendingId(null);
      }
    },
    [canManage, confirm, confirmT, copy, deletePendingId, supabase, t],
  );

  const setCreateDialogVisibility = useCallback(
    (open: boolean) => {
      if (!open && createPending) return;
      if (!open) setCreateDialogFeedback(null);
      setCreateDialogOpen(open);
    },
    [createPending],
  );
  const setEditDialogVisibility = useCallback(
    (open: boolean) => {
      if (!open && editPending) return;
      if (!open) {
        setEditingRate(null);
        setEditDialogFeedback(null);
      }
      setEditDialogOpen(open);
    },
    [editPending],
  );

  return {
    canManage,
    clearFilters: () => setFilters({ originalCurrency: "", targetCurrency: "" }),
    createDialogFeedback,
    createDialogOpen,
    createFormState,
    createPending,
    deletePendingId,
    editDialogFeedback,
    editDialogOpen,
    editFormState,
    editPending,
    filteredHistoryRows,
    filteredLatestRows,
    filters,
    handleCreateRate,
    handleDeleteRow: (row: ExchangeRateRow) => void handleDeleteRate(row),
    handleEditRate,
    hasActiveFilters: Boolean(filters.originalCurrency || filters.targetCurrency),
    hasPermission,
    historyFetch,
    historyPagination,
    latestPagination,
    latestRows,
    openCreateDialog,
    openEditDialog,
    pageFeedback,
    rates,
    setCreateDialogVisibility,
    setEditDialogVisibility,
    setOriginalCurrency: (value: string) =>
      setFilters((current) => ({ ...current, originalCurrency: value })),
    setTargetCurrency: (value: string) =>
      setFilters((current) => ({ ...current, targetCurrency: value })),
    syncSettings,
    updateCreateFormField,
    updateEditFormField,
  };
}
