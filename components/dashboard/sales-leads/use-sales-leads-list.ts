"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchSalesLeadPage, getSalesLeadErrorCode } from "@/lib/sales-leads";
import type { SalesLeadBoard, SalesLeadPageData } from "@/lib/sales-leads-types";
import { getBrowserSupabaseClient } from "@/lib/supabase";

export function useSalesLeadsList(initialData: SalesLeadPageData) {
  const [data, setData] = useState(initialData);
  const [board, setBoard] = useState<SalesLeadBoard>(initialData.board);
  const [search, setSearch] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestVersion = useRef(0);
  const { canManage, hasPermission } = initialData;

  const refresh = useCallback(async (nextBoard = board, nextOffset = 0) => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase || !hasPermission) return;
    // 明确翻页时取消待执行的搜索刷新，避免第一页覆盖用户选择的页。
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const nextData = await fetchSalesLeadPage(supabase, {
        board: nextBoard,
        canManage,
        search,
        assigneeUserId,
        offset: nextOffset,
      });
      if (version === requestVersion.current) setData(nextData);
    } catch (nextError) {
      if (version === requestVersion.current) setError(getSalesLeadErrorCode(nextError));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [assigneeUserId, board, canManage, hasPermission, search]);

  useEffect(() => {
    refreshTimer.current = setTimeout(() => void refresh(), 300);
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      // 较早的请求仍可能完成，但不能更新已经切换筛选或离开页面后的状态。
      requestVersion.current += 1;
    };
  }, [refresh]);

  return { assigneeUserId, board, data, error, loading, search, refresh, setAssigneeUserId, setBoard, setSearch };
}
