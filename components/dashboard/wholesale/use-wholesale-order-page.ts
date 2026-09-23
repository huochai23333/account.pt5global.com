"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase";
import {
  getWholesaleOrderPage,
  type WholesaleOrderFilters,
  type WholesaleOrderPage,
} from "@/lib/wholesale-order-page";

export function useWholesaleOrderPage({
  filters,
  initialPage,
}: {
  filters: WholesaleOrderFilters;
  initialPage: WholesaleOrderPage;
}) {
  const [page, setPage] = useState<WholesaleOrderPage | null>(initialPage);
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const filterKey = JSON.stringify(filters);
  const previousFilterKey = useRef(filterKey);
  const requestVersion = useRef(0);

  const loadFirstPage = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();

    if (!supabase) {
      setLoadError("批发订单暂时没有加载成功，请刷新页面后重试。");
      return;
    }

    const version = ++requestVersion.current;
    setLoading(true);
    setLoadingMore(false);
    setLoadError(null);
    // 筛选变化后先清空旧批次，避免新条件加载期间继续展示不匹配的订单。
    setPage(null);

    try {
      const nextPage = await getWholesaleOrderPage(supabase, filters);

      if (version === requestVersion.current) {
        setPage(nextPage);
        setAppliedFilters(filters);
      }
    } catch (error) {
      if (version === requestVersion.current) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "批发订单暂时没有加载成功，请稍后重试。",
        );
      }
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    if (previousFilterKey.current === filterKey) {
      return;
    }

    previousFilterKey.current = filterKey;
    void loadFirstPage();
  }, [filterKey, loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!page?.nextCursor || loadingMore) {
      return;
    }

    const supabase = getBrowserSupabaseClient();

    if (!supabase) {
      setLoadError("更多订单暂时没有加载成功，请刷新页面后重试。");
      return;
    }

    // 翻页与首页共用版本号；切换筛选后，旧页不能再覆盖新条件的列表或汇总。
    const version = requestVersion.current;
    const cursor = page.nextCursor;
    setLoadingMore(true);
    setLoadError(null);

    try {
      const nextPage = await getWholesaleOrderPage(
        supabase,
        filters,
        cursor,
      );
      if (version === requestVersion.current) {
        setPage((current) =>
          current?.nextCursor === cursor
            ? mergeWholesaleOrderPages(current, nextPage)
            : current,
        );
      }
    } catch (error) {
      if (version === requestVersion.current) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "更多订单暂时没有加载成功，请稍后重试。",
        );
      }
    } finally {
      if (version === requestVersion.current) setLoadingMore(false);
    }
  }, [filters, loadingMore, page]);

  const removeOrderListAttachment = useCallback((attachmentId: string) => {
    // 附件删除成功后只更新当前页面中的附件数组，不清空订单表。
    // 这样管理弹窗会保持打开，内部人员可以连续删除多份附件。
    setPage((current) =>
      current
        ? {
            ...current,
            orderListAttachments: current.orderListAttachments.filter(
              (attachment) => attachment.id !== attachmentId,
            ),
          }
        : current,
    );
  }, []);

  return {
    loadError,
    appliedFilters,
    loading,
    loadingMore,
    loadMore,
    page,
    removeOrderListAttachment,
    refreshFirstPage: loadFirstPage,
  };
}

function mergeWholesaleOrderPages(
  current: WholesaleOrderPage,
  next: WholesaleOrderPage,
): WholesaleOrderPage {
  return {
    ...next,
    orderChangeLogs: mergeRows(current.orderChangeLogs, next.orderChangeLogs),
    orderListAttachments: mergeRows(
      current.orderListAttachments,
      next.orderListAttachments,
    ),
    orders: mergeRows(current.orders, next.orders),
    orderSettlements: mergeRows(
      current.orderSettlements,
      next.orderSettlements,
    ),
    purchaseOrders: mergeRows(current.purchaseOrders, next.purchaseOrders),
    warnings: Array.from(
      new Map(
        [...current.warnings, ...next.warnings].map((warning) => [
          `${warning.area}:${warning.message}`,
          warning,
        ]),
      ).values(),
    ),
  };
}

function mergeRows<Row extends { id: string }>(current: Row[], next: Row[]) {
  return Array.from(
    new Map([...current, ...next].map((row) => [row.id, row])).values(),
  );
}
