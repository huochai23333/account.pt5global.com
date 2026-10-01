"use client";

import { useCallback } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { useDashboardQueryPage } from "@/lib/use-dashboard-query-page";
import { getWholesaleOrderPage, type WholesaleOrderFilters, type WholesaleOrderPage } from "@/lib/wholesale-order-page";

/** 订单与附件始终对应当前页；公共查询状态负责筛选重置、越界和请求竞争。 */
export function useWholesaleOrderPage({ filters, initialPage }: {
  filters: WholesaleOrderFilters;
  initialPage: WholesaleOrderPage;
}) {
  const query = useDashboardQueryPage({
    initialData: initialPage,
    queryKey: JSON.stringify(filters),
    totalItems: (data) => data.totalCount,
    errorMessage: "批发订单暂时没有加载成功，请稍后重试。",
    queryPage: async (page) => {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("批发订单暂时没有加载成功，请刷新页面后重试。");
      return getWholesaleOrderPage(supabase, filters, page);
    },
  });

  const removeOrderListAttachment = (attachmentId: string) => {
    // 删除附件只更新当前页，保留已打开的弹窗，便于连续整理多份文件。
    query.setData((current) => current ? {
      ...current,
      orderListAttachments: current.orderListAttachments.filter((attachment) => attachment.id !== attachmentId),
    } : current);
  };
  const refreshQuery = query.refresh;
  const refreshPage = useCallback(async () => { await refreshQuery(); }, [refreshQuery]);

  return {
    loadError: query.error,
    appliedFilters: filters,
    loading: query.loading,
    page: query.data,
    pagination: query.pagination,
    goToPage: query.loadPage,
    removeOrderListAttachment,
    refreshPage,
  };
}
