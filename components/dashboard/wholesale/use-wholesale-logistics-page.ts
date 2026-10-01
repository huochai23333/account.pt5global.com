"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
    errorMessage: "物流记录暂时没有加载成功，请稍后重试。",
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
          message: "已显示现有物流记录，最新数据稍后会继续更新。",
          scope: "page",
          tone: "error",
        });
      } finally {
        setUpdatingSource(false);
      }
    };

    void refresh();
  }, [reloadAll]);


  const runMutation = useCallback(
    async (key: string, successMessage: string, action: () => Promise<void>) => {
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
          message: readMutationError(error),
          scope: "assignment",
          tone: "error",
        });
        return false;
      } finally {
        setPendingKey(null);
      }
    },
    [reloadAll],
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
      runMutation("assign", "店铺归属已保存。", async () => {
        const supabase = requireBrowserClient();
        await assignWholesaleLogisticsStores(supabase, {
          customerId,
          salesUserId,
          storeNames,
        });
      }),
    changeAssignment: (input: ChangeWholesaleLogisticsAssignmentInput) =>
      runMutation(`change:${input.assignmentId}`, "店铺归属已调整。", async () => {
        await changeWholesaleLogisticsAssignment(requireBrowserClient(), input);
      }),
    endAssignment: (assignmentId: string, effectiveTo: string) =>
      runMutation(`end:${assignmentId}`, "店铺归属已结束。", async () => {
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


function readError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function readMutationError(error: unknown) {
  const message = readError(error, "店铺归属暂时没有保存成功，请稍后重试。");
  if (message.includes("already_assigned")) return "所选店铺已经有归属记录。";
  if (message.includes("split_outside_range")) return "所选生效时间不在当前归属区间内。";
  if (message.includes("invalid_logistics_sales_user")) return "请选择正常使用中的业务员账号。";
  if (message.includes("manage_denied")) return "当前账号不能修改店铺归属。";
  return "店铺归属暂时没有保存成功，请稍后重试。";
}
