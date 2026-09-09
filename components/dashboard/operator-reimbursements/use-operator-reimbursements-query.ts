"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultOperatorReimbursementFilters,
  getOperatorReimbursementsPageData,
  type OperatorReimbursementFilters,
  type OperatorReimbursementsPageData,
} from "@/lib/operator-reimbursements";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { useWorkspaceSyncEffect } from "../workspace-session-provider";

const OPERATOR_REIMBURSEMENT_SEARCH_DELAY_MS = 300;

/**
 * 查询 hook 统一管理筛选、搜索等待、并发请求和加载状态。
 * 页面与写入 hook 只调用 refresh，不需要各自判断哪一组筛选仍然有效。
 */
export function useOperatorReimbursementsQuery(
  initialData: OperatorReimbursementsPageData,
) {
  const [data, setData] = useState(initialData);
  // filters 是输入框立即显示的值；queryFilters 是已经提交给数据库的值。
  const [filters, setFilters] = useState(defaultOperatorReimbursementFilters);
  const [queryFilters, setQueryFilters] = useState(
    defaultOperatorReimbursementFilters,
  );
  const [loadedFilterKey, setLoadedFilterKey] = useState(() =>
    getOperatorReimbursementFilterKey(defaultOperatorReimbursementFilters),
  );
  const [loading, setLoading] = useState(false);
  const [queryFailed, setQueryFailed] = useState(false);
  const mounted = useRef(true);
  const requestVersion = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQueryFilters = useRef(defaultOperatorReimbursementFilters);

  const commitQueryFilters = useCallback(
    (nextFilters: OperatorReimbursementFilters) => {
      // ref 必须先更新；保存完成的旧闭包也会因此读取到当前筛选，而不是旧筛选。
      latestQueryFilters.current = nextFilters;
      setQueryFailed(false);
      setQueryFilters(nextFilters);
    },
    [],
  );

  const refresh = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return false;

    const targetFilters = latestQueryFilters.current;
    const targetFilterKey = getOperatorReimbursementFilterKey(targetFilters);
    const version = ++requestVersion.current;
    setLoading(true);
    setQueryFailed(false);

    try {
      const result = await getOperatorReimbursementsPageData(
        supabase,
        targetFilters,
      );

      // 较早的请求可以结束，但只有最后一次、且仍对应当前筛选的请求可以更新页面。
      if (
        !mounted.current ||
        version !== requestVersion.current ||
        targetFilterKey !==
          getOperatorReimbursementFilterKey(latestQueryFilters.current)
      ) {
        return true;
      }

      setData(result);
      setLoadedFilterKey(targetFilterKey);
      return true;
    } catch {
      if (mounted.current && version === requestVersion.current) {
        setQueryFailed(true);
      }
      return false;
    } finally {
      if (mounted.current && version === requestVersion.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [queryFilters, refresh]);

  const sync = useCallback(async () => {
    await refresh();
  }, [refresh]);
  useWorkspaceSyncEffect(sync);

  useEffect(() => {
    // React 开发模式会重复执行 effect 的挂载与清理；每次挂载都要恢复可更新标记。
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestVersion.current += 1;
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const changeFilter = <Key extends keyof OperatorReimbursementFilters>(
    key: Key,
    value: OperatorReimbursementFilters[Key],
  ) => {
    const searchWasWaiting =
      filters.search !== latestQueryFilters.current.search;
    const nextFilters = {
      ...filters,
      [key]: value,
      page:
        key === "page" && !searchWasWaiting
          ? Number(value)
          : 1,
    };
    setFilters(nextFilters);

    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (key === "search") {
      // 输入时保留当前结果，停止输入 300ms 后再读取数据库，避免每个字符都触发 RPC。
      searchTimer.current = setTimeout(() => {
        if (!mounted.current) return;
        searchTimer.current = null;
        commitQueryFilters(nextFilters);
      }, OPERATOR_REIMBURSEMENT_SEARCH_DELAY_MS);
      return;
    }

    commitQueryFilters(nextFilters);
  };

  const resetFilters = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = null;
    setFilters(defaultOperatorReimbursementFilters);
    commitQueryFilters(defaultOperatorReimbursementFilters);
  };

  const currentFilterKey = getOperatorReimbursementFilterKey(queryFilters);

  return {
    data,
    filters,
    changeFilter,
    resetFilters,
    refresh,
    queryFailed,
    loading: loading || loadedFilterKey !== currentFilterKey,
  };
}

/** 用稳定字符串比较筛选内容，避免把对象引用变化误判成尚未加载。 */
function getOperatorReimbursementFilterKey(
  filters: OperatorReimbursementFilters,
) {
  return JSON.stringify([
    filters.owner,
    filters.period,
    filters.status,
    filters.search,
    filters.page,
  ]);
}
