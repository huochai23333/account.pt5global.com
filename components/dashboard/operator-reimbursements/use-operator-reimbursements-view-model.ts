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
import {
  useOperatorReimbursementForm,
  type ReimbursementCopy,
  type ReimbursementFeedback,
} from "./use-operator-reimbursement-form";
import { useOperatorReimbursementActions } from "./use-operator-reimbursement-actions";

/** 页面状态只调度查询、筛选和子 hook；输入表单与写入过程分别维护。 */
export function useOperatorReimbursementsViewModel({
  copy,
  initialData,
}: {
  copy: ReimbursementCopy;
  initialData: OperatorReimbursementsPageData;
}) {
  const [data, setData] = useState(initialData);
  const [filters, setFilters] = useState(defaultOperatorReimbursementFilters);
  const [loadedFilters, setLoadedFilters] = useState(filters);
  const [loading, setLoading] = useState(false);
  const [queryFailed, setQueryFailed] = useState(false);
  const [feedback, setFeedback] = useState<ReimbursementFeedback>(null);
  const request = useRef(0);
  const mounted = useRef(true);
  const latestFilters = useRef(filters);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current += 1;
    };
  }, []);
  const refresh = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return false;
    const id = ++request.current;
    setLoading(true);
    try {
      const result = await getOperatorReimbursementsPageData(supabase, filters);
      // 连续切换运营或搜索时，只接收最后一次查询，避免把甲的金额显示在乙的名字下面。
      if (
        !mounted.current ||
        id !== request.current ||
        latestFilters.current !== filters
      )
        // 新查询已接管刷新，丢弃旧结果不属于保存失败。
        return true;
      setData(result);
      setLoadedFilters(filters);
      setQueryFailed(false);
      return true;
    } catch {
      if (mounted.current && id === request.current) setQueryFailed(true);
      return false;
    } finally {
      if (mounted.current && id === request.current) setLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const sync = useCallback(async () => {
    await refresh();
  }, [refresh]);
  useWorkspaceSyncEffect(sync);
  const changeFilter = <Key extends keyof OperatorReimbursementFilters>(
    key: Key,
    value: OperatorReimbursementFilters[Key],
  ) => {
    const next = {
      ...filters,
      [key]: value,
      page: key === "page" ? Number(value) : 1,
    };
    latestFilters.current = next;
    setFilters(next);
  };
  const resetFilters = () => {
    latestFilters.current = defaultOperatorReimbursementFilters;
    setFilters(defaultOperatorReimbursementFilters);
  };
  const onSaved = async (message: string) => {
    const refreshed = await refresh();
    setFeedback({
      tone: refreshed ? "success" : "info",
      message: refreshed ? message : copy.savedRefreshError,
    });
  };
  const form = useOperatorReimbursementForm(copy, onSaved);
  const actions = useOperatorReimbursementActions(
    data,
    copy,
    onSaved,
    setFeedback,
  );
  // 全部运营属于查阅视图。只有“我的记录”和选择本人时显示写入入口。
  const ownView =
    filters.owner === "mine" || filters.owner === data.currentUserId;
  return {
    data,
    filters,
    changeFilter,
    resetFilters,
    refresh,
    queryFailed,
    feedback,
    form,
    actions,
    ownView,
    loading: loading || loadedFilters !== filters,
  };
}
