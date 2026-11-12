"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { useDashboardConfirm } from "@/components/dashboard/dashboard-confirm-provider";

import { markBrowserCloudSyncActivity } from "@/lib/browser-sync-recovery";
import {
  deleteCompanyExpense,
  getCompanyExpensesPageData,
  sortCompanyExpenses,
  type CompanyExpenseCategory,
  type CompanyExpensesPageData,
  type CompanyExpenseRow,
} from "@/lib/company-expenses";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { normalizeSearchText } from "@/lib/value-normalizers";

import type { FeedbackTone } from "../dashboard-shared-ui";
import { useWorkspaceSyncEffect } from "../workspace-session-provider";
import { getCompanyExpenseMonthValue } from "./company-expenses-display";
import { toCompanyExpenseErrorMessage } from "./company-expenses-form";
import { useCompanyExpenseEditor } from "./use-company-expense-editor";

type Feedback = { tone: FeedbackTone; message: string } | null;
type PendingAction = { id: string; type: "delete" } | null;

type CompanyExpensesViewModelCopy = {
  createSuccess: string;
  createDifferent: string;
  createUnconfirmed: string;
  deleteConfirm: (title: string) => string;
  deleteSuccess: string;
  invalidAmount: string;
  invalidMonth: string;
  missingAmount: string;
  missingTitle: string;
  notFoundError: string;
  permissionError: string;
  unknownError: string;
  updateSuccess: string;
};

type UseCompanyExpensesViewModelOptions = {
  copy: CompanyExpensesViewModelCopy;
  initialData: CompanyExpensesPageData;
};

export function useCompanyExpensesViewModel({
  copy,
  initialData,
}: UseCompanyExpensesViewModelOptions) {
  const confirm = useDashboardConfirm();
  const confirmT = useTranslations("DashboardFramework.confirm");
  const supabase = getBrowserSupabaseClient();
  const [expenses, setExpenses] = useState(initialData.expenses);
  const [hasPermission, setHasPermission] = useState(initialData.hasPermission);
  const [pageFeedback, setPageFeedback] = useState<Feedback>(null);
  const [monthFilter, setMonthFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] =
    useState<CompanyExpenseCategory | "all">("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const applyPageData = useCallback((pageData: CompanyExpensesPageData) => {
    setHasPermission(pageData.hasPermission);
    setExpenses(sortCompanyExpenses(pageData.expenses));
  }, []);

  const refreshCompanyExpenses = useCallback(
    async ({ isMounted }: { isMounted: () => boolean }) => {
      if (!supabase) {
        return;
      }

      try {
        const pageData = await getCompanyExpensesPageData(supabase);

        if (!isMounted()) {
          return;
        }

        applyPageData(pageData);
      } catch (error) {
        if (!isMounted()) {
          return;
        }

        setPageFeedback({
          tone: "error",
          message: toCompanyExpenseErrorMessage(error, copy),
        });
      }
    },
    [applyPageData, copy, supabase],
  );

  useWorkspaceSyncEffect(refreshCompanyExpenses);

  const monthOptions = useMemo(() => {
    return Array.from(new Set(expenses.map(getCompanyExpenseMonthValue))).sort(
      (left, right) => right.localeCompare(left),
    );
  }, [expenses]);

  const currencyOptions = useMemo(() => {
    return Array.from(new Set(expenses.map((row) => row.currency_code))).sort();
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);

    return expenses.filter((expense) => {
      const monthMatches =
        monthFilter === "all" ||
        getCompanyExpenseMonthValue(expense) === monthFilter;
      const categoryMatches =
        categoryFilter === "all" || expense.category === categoryFilter;
      const currencyMatches =
        currencyFilter === "all" || expense.currency_code === currencyFilter;
      const searchText = normalizeSearchText(
        [
          expense.title,
          expense.payee,
          expense.note,
          expense.currency_code,
          expense.category,
        ]
          .filter(Boolean)
          .join(" "),
      );
      const searchMatches =
        !normalizedQuery || searchText.includes(normalizedQuery);

      return (
        monthMatches &&
        categoryMatches &&
        currencyMatches &&
        searchMatches
      );
    });
  }, [categoryFilter, currencyFilter, expenses, monthFilter, searchQuery]);

  const resetFilters = useCallback(() => {
    setCategoryFilter("all");
    setCurrencyFilter("all");
    setMonthFilter("all");
    setSearchQuery("");
  }, []);

  const editor = useCompanyExpenseEditor(supabase, copy, (saved, editing) => {
    markBrowserCloudSyncActivity();
    setExpenses((current) => sortCompanyExpenses(editing
      ? current.map((item) => item.id === saved.id ? saved : item)
      : [saved, ...current.filter((item) => item.id !== saved.id)],
    ));
    setPageFeedback({ tone: "success", message: editing ? copy.updateSuccess : copy.createSuccess });
  });

  const handleDelete = useCallback(
    async (expense: CompanyExpenseRow) => {
      if (!supabase || pendingAction) {
        return;
      }

      if (
        !(await confirm({
          description: copy.deleteConfirm(expense.title),
          title: confirmT("title"),
          tone: "danger",
        }))
      ) {
        return;
      }

      setPendingAction({ id: expense.id, type: "delete" });
      setPageFeedback(null);

      try {
        await deleteCompanyExpense(supabase, expense.id);

        markBrowserCloudSyncActivity();
        setExpenses((current) =>
          current.filter((item) => item.id !== expense.id),
        );
        setPageFeedback({ tone: "success", message: copy.deleteSuccess });
      } catch (error) {
        setPageFeedback({
          tone: "error",
          message: toCompanyExpenseErrorMessage(error, copy),
        });
      } finally {
        setPendingAction(null);
      }
    },
    [confirm, confirmT, copy, pendingAction, supabase],
  );

  return {
    ...editor,
    categoryFilter,
    currencyFilter,
    currencyOptions,
    filteredExpenses,
    hasPermission,
    handleDelete,
    monthFilter,
    monthOptions,
    pageFeedback,
    pendingAction,
    resetFilters,
    searchQuery,
    setCategoryFilter,
    setCurrencyFilter,
    setMonthFilter,
    setSearchQuery,
  };
}
