"use client";

import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";

import { useDashboardConfirm } from "@/components/dashboard/dashboard-confirm-provider";
import type { FeedbackTone } from "@/components/dashboard/dashboard-shared-ui";
import { markBrowserCloudSyncActivity } from "@/lib/browser-sync-recovery";
import { createExchangeRate, deleteExchangeRate, updateExchangeRate } from "@/lib/exchange-rate-manual-mutations";
import { getExchangeRatePairLabel, sortExchangeRateRows } from "@/lib/exchange-rate-display";
import type { ExchangeRateRow } from "@/lib/exchange-rate-types";
import type { getBrowserSupabaseClient } from "@/lib/supabase";

import {
  createExchangeRateFormState,
  createExchangeRateFormStateFromRow,
  parseExchangeRateForm,
  type ExchangeRateFormState,
} from "./exchange-rate-form";
import { toExchangeRateErrorMessage, type ExchangeRateCopy } from "./exchange-rates-utils";

type Feedback = { tone: FeedbackTone; message: string } | null;

// 人工报价的表单、写入和独立回执集中管理，自动同步仍由自己的 Hook 处理。
export function useExchangeRateManualEditor({
  canManage,
  copy,
  setPageFeedback,
  setRates,
  supabase,
}: {
  canManage: boolean;
  copy: ExchangeRateCopy;
  setPageFeedback: (feedback: Feedback) => void;
  setRates: Dispatch<SetStateAction<ExchangeRateRow[]>>;
  supabase: ReturnType<typeof getBrowserSupabaseClient>;
}) {
  const confirm = useDashboardConfirm();
  const confirmT = useTranslations("DashboardFramework.confirm");
  const t = useTranslations("ExchangeRates");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [createDialogFeedback, setCreateDialogFeedback] = useState<Feedback>(null);
  const [createFormState, setCreateFormState] = useState<ExchangeRateFormState>(() =>
    createExchangeRateFormState(),
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPending, setEditPending] = useState(false);
  const [editDialogFeedback, setEditDialogFeedback] = useState<Feedback>(null);
  const [editFormState, setEditFormState] = useState<ExchangeRateFormState>(() =>
    createExchangeRateFormState(),
  );
  const [editingRate, setEditingRate] = useState<ExchangeRateRow | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);

  const openCreateDialog = useCallback(() => {
    if (!canManage) return;
    setPageFeedback(null);
    setCreateDialogFeedback(null);
    setCreateFormState(createExchangeRateFormState());
    setCreateDialogOpen(true);
  }, [canManage, setPageFeedback]);

  const openEditDialog = useCallback(
    (row: ExchangeRateRow) => {
      if (!canManage) return;
      setPageFeedback(null);
      setEditDialogFeedback(null);
      setEditingRate(row);
      setEditFormState(createExchangeRateFormStateFromRow(row));
      setEditDialogOpen(true);
    },
    [canManage, setPageFeedback],
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

  // 表单提交与禁用按钮之间隔着一次 React 渲染，同步锁防止这段时间重复提交。
  const formSaveInProgress = useRef(false);
  const handleCreateRate = useCallback(async () => {
    if (!supabase || !canManage || formSaveInProgress.current) return;
    const parsed = parseExchangeRateForm(createFormState, copy);
    if (!parsed.ok) {
      setCreateDialogFeedback({ tone: "error", message: parsed.message });
      return;
    }

    formSaveInProgress.current = true;
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
      formSaveInProgress.current = false;
      setCreatePending(false);
    }
  }, [canManage, copy, createFormState, setPageFeedback, setRates, supabase, t]);

  const handleEditRate = useCallback(async () => {
    if (!supabase || !canManage || formSaveInProgress.current || !editingRate) return;
    const parsed = parseExchangeRateForm(editFormState, copy);
    if (!parsed.ok) {
      setEditDialogFeedback({ tone: "error", message: parsed.message });
      return;
    }

    formSaveInProgress.current = true;
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
      formSaveInProgress.current = false;
      setEditPending(false);
    }
  }, [canManage, copy, editFormState, editingRate, setPageFeedback, setRates, supabase, t]);

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
    [canManage, confirm, confirmT, copy, deletePendingId, setPageFeedback, setRates, supabase, t],
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
    createDialogFeedback,
    createDialogOpen,
    createFormState,
    createPending,
    deletePendingId,
    editDialogFeedback,
    editDialogOpen,
    editFormState,
    editPending,
    handleCreateRate,
    handleDeleteRow: (row: ExchangeRateRow) => void handleDeleteRate(row),
    handleEditRate,
    openCreateDialog,
    openEditDialog,
    setCreateDialogVisibility,
    setEditDialogVisibility,
    updateCreateFormField,
    updateEditFormField,
  };
}
