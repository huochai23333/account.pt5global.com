"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { useDashboardQueryPage } from "@/lib/use-dashboard-query-page";
import { getWholesaleOrderPage, type WholesaleOrderFilters, type WholesaleOrderPage } from "@/lib/wholesale-order-page";

/** 订单与附件始终对应当前页；公共查询状态负责筛选重置、越界和请求竞争。 */
export function useWholesaleOrderPage({ filters, initialPage }: {
  filters: WholesaleOrderFilters;
  initialPage: WholesaleOrderPage;
}) {
  const t = useTranslations("WholesaleBusiness.ordersUi");
  const readError = t("loadError");
  const query = useDashboardQueryPage({
    initialData: initialPage,
    queryKey: JSON.stringify(filters),
    totalItems: (data) => data.totalCount,
    errorMessage: readError,
    queryPage: async (page) => {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error(readError);
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
  const refreshAfterWrite = useCallback(async () => {
    // 公共分页用 false 表示读取失败或被新查询替代。写入执行器需要据此区分保存和列表更新。
    if (!(await refreshQuery())) throw new Error(readError);
  }, [readError, refreshQuery]);

  return {
    loadError: query.error,
    appliedFilters: filters,
    loading: query.loading,
    page: query.data,
    pagination: query.pagination,
    goToPage: query.loadPage,
    removeOrderListAttachment,
    refreshAfterWrite,
    refreshPage: refreshQuery,
  };
}
