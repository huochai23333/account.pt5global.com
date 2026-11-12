"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";

import { useDashboardQueryPage } from "@/lib/use-dashboard-query-page";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import {
  getOrderDatePresetRange,
  isOrderDateValue,
  type OrderDatePreset,
} from "@/lib/order-date-range";
import {
  getInitialWholesaleLogisticsData,
  getWholesaleLogisticsPage,
  requestWholesaleLogisticsRefresh,
  type WholesaleLogisticsFilters,
  type WholesaleLogisticsPage,
  type WholesaleLogisticsStoreAssignment,
  type WholesaleLogisticsStoreOption,
} from "@/lib/wholesale-logistics-page";

import {
  assignWholesaleLogisticsStores,
  changeWholesaleLogisticsAssignment,
  endWholesaleLogisticsAssignment,
  type ChangeWholesaleLogisticsAssignmentInput,
} from "./wholesale-logistics-mutations";

type Feedback = {
  message: string;
  scope: "assignment" | "page";
  tone: "error" | "success";
} | null;

export function useWholesaleLogisticsPage({
  initialAssignments,
  initialFilters,
  initialPage,
  initialStoreOptions,
}: {
  initialAssignments: WholesaleLogisticsStoreAssignment[];
  initialFilters: WholesaleLogisticsFilters;
  initialPage: WholesaleLogisticsPage;
  initialStoreOptions: WholesaleLogisticsStoreOption[];
}) {
  const t = useTranslations("WholesaleBusiness.logisticsArchive");
  const sourceRefreshDeferred = t("sourceRefreshDeferred");
  const [filters, setFilters] = useState(initialFilters);
  const deferredSearchText = useDeferredValue(filters.searchText);
  const queryFilters = useMemo(
    () => ({
      ...filters,
      searchText:
        filters.searchMode === "exact_all_time"
          ? filters.searchText.trim()
          : deferredSearchText.trim(),
    }),
    [deferredSearchText, filters],
  );
  const query = useDashboardQueryPage({
    initialData: initialPage,
    queryKey: JSON.stringify(queryFilters),
    totalItems: (data) => data.totalCount,
    errorMessage: t("loadFailed"),
    queryPage: (pageNumber) => getWholesaleLogisticsPage(requireBrowserClient(), queryFilters, pageNumber),
  });
  const page = query.data ?? initialPage;
  const reloadPage = query.refresh;
  const [assignments, setAssignments] = useState(initialAssignments);
  const [storeOptions, setStoreOptions] = useState(initialStoreOptions);
  const [updatingSource, setUpdatingSource] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const didRequestSourceRefresh = useRef(false);
  const writingAssignment = useRef(false);


  const reloadAll = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) throw new Error("当前无法连接系统，请刷新页面后重试。");

    const data = await getInitialWholesaleLogisticsData(supabase, queryFilters);
    setAssignments(data.logisticsAssignments);
    await reloadPage();
    setStoreOptions(data.logisticsStoreOptions);
  }, [queryFilters, reloadPage]);


  useEffect(() => {
    if (didRequestSourceRefresh.current) return;
    didRequestSourceRefresh.current = true;

    const refresh = async () => {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) return;

      setUpdatingSource(true);
      try {
        await requestWholesaleLogisticsRefresh(supabase);
        await reloadAll();
      } catch {
        // 自动更新失败时继续展示永久档案，避免短暂网络问题让整个物流页面不可用。
        setFeedback({
          message: sourceRefreshDeferred,
          scope: "page",
          tone: "error",
        });
      } finally {
        setUpdatingSource(false);
      }
    };

    void refresh();
  }, [reloadAll, sourceRefreshDeferred]);


  const runMutation = useCallback(
    async (key: string, successMessage: string, action: () => Promise<void>) => {
      // 先用同步锁拦住同一帧连击，避免在 React 禁用按钮前重复拆分归属区间。
      if (writingAssignment.current) return false;
      writingAssignment.current = true;
      setPendingKey(key);
      setFeedback(null);
      try {
        await action();
        await reloadAll();
        setFeedback({
          message: successMessage,
          scope: "assignment",
          tone: "success",
        });
        return true;
      } catch (error) {
        setFeedback({
          message: t(`assignmentFeedback.${readMutationError(error)}`),
          scope: "assignment",
          tone: "error",
        });
        return false;
      } finally {
        writingAssignment.current = false;
        setPendingKey(null);
      }
    },
    [reloadAll, t],
  );

  return {
    activateExactSearch: () => {
      if (!filters.searchText.trim()) return;
      setFilters((current) => ({
        ...current,
        searchMode: "exact_all_time",
        searchText: current.searchText.trim(),
      }));
    },
    applyDatePreset: (preset: Exclude<OrderDatePreset, "custom">) => {
      const range = getOrderDatePresetRange(preset);
      setFilters((current) => ({
        ...current,
        fromDate: range.fromDate,
        searchMode: "date_range",
        toDate: range.toDate,
      }));
    },
    assignments,
    feedback,
    filters,
    loadError: query.error,
    loading: query.loading,
    hasPage: Boolean(query.data),
    pagination: query.pagination,
    goToPage: query.loadPage,
    page,
    pendingKey,
    storeOptions,
    updatingSource,
    clearFilters: () => setFilters(initialFilters),
    dismissFeedback: () => setFeedback(null),
    exitExactSearch: () =>
      setFilters((current) => ({
        ...current,
        searchMode: "date_range",
        searchText: "",
      })),
    reloadPage,
    setFilters: (changes: Partial<WholesaleLogisticsFilters>) =>
      setFilters((current) => applyFilterChanges(current, changes)),
    assignStores: (
      storeNames: string[],
      salesUserId: string,
      customerId: string | null,
    ) =>
      runMutation("assign", t("assignmentFeedback.assigned"), async () => {
        const supabase = requireBrowserClient();
        await assignWholesaleLogisticsStores(supabase, {
          customerId,
          salesUserId,
          storeNames,
        });
      }),
    changeAssignment: (input: ChangeWholesaleLogisticsAssignmentInput) =>
      runMutation(`change:${input.assignment.id}`, t("assignmentFeedback.changed"), async () => {
        await changeWholesaleLogisticsAssignment(requireBrowserClient(), input);
      }),
    endAssignment: (assignmentId: string, effectiveTo: string) =>
      runMutation(`end:${assignmentId}`, t("assignmentFeedback.ended"), async () => {
        await endWholesaleLogisticsAssignment(
          requireBrowserClient(),
          assignmentId,
          effectiveTo,
        );
      }),
  };
}

function applyFilterChanges(
  current: WholesaleLogisticsFilters,
  changes: Partial<WholesaleLogisticsFilters>,
): WholesaleLogisticsFilters {
  const nextFromDate = changes.fromDate ?? current.fromDate;
  const nextToDate = changes.toDate ?? current.toDate;

  if (
    (changes.fromDate !== undefined && !isOrderDateValue(changes.fromDate)) ||
    (changes.toDate !== undefined && !isOrderDateValue(changes.toDate))
  ) {
    return current;
  }

  const next = {
    ...current,
    ...changes,
    searchMode: "date_range" as const,
  };

  if (changes.fromDate !== undefined && nextFromDate > nextToDate) {
    next.toDate = nextFromDate;
  }
  if (changes.toDate !== undefined && nextToDate < nextFromDate) {
    next.fromDate = nextToDate;
  }

  return next;
}

function requireBrowserClient() {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) throw new Error("当前无法连接系统，请刷新页面后重试。");
  return supabase;
}


function readMutationError(error: unknown) {
  // Supabase 可能返回普通对象；只映射已知错误，其余用统一业务提示。
  const message = error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "";
  if (message.includes("already_assigned")) return "alreadyAssigned";
  if (message.includes("split_outside_range")) return "dateOutside";
  if (message.includes("invalid_logistics_sales_user")) return "invalidSalesperson";
  if (message.includes("manage_denied")) return "forbidden";
  if (message.includes("logistics_assignment_unconfirmed")) return "unconfirmed";
  return "failed";
}
