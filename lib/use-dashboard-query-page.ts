"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getDashboardPaginationState, normalizeDashboardPage } from "./dashboard-pagination";

/**
 * 只管理按页读取：翻页成功后才更新页码，筛选变化时从第一页重新读取。
 * 每次请求都有自己的编号，较慢的旧请求不能覆盖新筛选或新页的数据。
 */
export function useDashboardQueryPage<Data>({
  initialData,
  queryKey,
  queryPage,
  totalItems,
  errorMessage,
}: {
  initialData: Data;
  queryKey: string;
  queryPage: (page: number) => Promise<Data>;
  totalItems: (data: Data) => number;
  errorMessage: string;
}) {
  const [data, setData] = useState<Data | null>(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const previousQueryKey = useRef(queryKey);
  const currentPage = useRef(1);
  // 回调保存在 ref 中，页面重新渲染不会单独触发一次数据库读取。
  const queryRef = useRef(queryPage);
  const totalRef = useRef(totalItems);
  useEffect(() => {
    queryRef.current = queryPage;
    totalRef.current = totalItems;
  }, [queryPage, totalItems]);

  const loadPage = useCallback(async (requestedPage: number, clear = false) => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    if (clear) setData(null);
    try {
      const target = normalizeDashboardPage(requestedPage);
      let result = await queryRef.current(target);
      let validPage = getDashboardPaginationState(totalRef.current(result), target).page;
      // 删除末页最后一条记录后，按真实总数读取最后一个有效页，不能显示一个空的越界页。
      if (validPage !== target) result = await queryRef.current(validPage);
      if (version !== requestVersion.current) return false;
      validPage = getDashboardPaginationState(totalRef.current(result), validPage).page;
      currentPage.current = validPage;
      setPage(validPage);
      setData(result);
      return true;
    } catch {
      if (version === requestVersion.current) {
        // 数据库或网络错误可能包含内部信息，页面统一使用面向用户的重试提示。
        setError(errorMessage);
      }
      return false;
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (previousQueryKey.current === queryKey) return;
    previousQueryKey.current = queryKey;
    currentPage.current = 1;
    void loadPage(1, true);
  }, [loadPage, queryKey]);

  useEffect(() => () => { requestVersion.current += 1; }, []);

  const pagination = getDashboardPaginationState(data ? totalItems(data) : 0, page);
  const refresh = useCallback(() => loadPage(currentPage.current), [loadPage]);
  const reset = useCallback(() => loadPage(1, true), [loadPage]);

  return { data, setData, error, loading, pagination, loadPage, refresh, reset };
}
