"use client";

import type { ReactNode } from "react";

import { useDashboardPagination } from "@/lib/use-dashboard-pagination";
import { DashboardPaginationFooter } from "./dashboard-collection-section";

/**
 * 目录和明细已经完成权限裁剪、筛选及统计后，再共用这层显示分页。
 * 桌面表格和手机卡片都接收同一页，统计和筛选选项仍使用完整结果。
 */
export function DashboardPagedRecords<Row>({ items, queryKey = "", children }: {
  items: Row[];
  queryKey?: string;
  children: (rows: Row[]) => ReactNode;
}) {
  const pagination = useDashboardPagination(items, 20, queryKey);
  return <>
    {children(pagination.items)}
    <DashboardPaginationFooter {...pagination}
      onNextPage={pagination.goToNextPage}
      onPreviousPage={pagination.goToPreviousPage} />
  </>;
}
