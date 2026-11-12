/** 任务、团队与旅游协作资产：声明模块内的数据合同；类型帮助调用方理解字段，但不能替代运行时输入与权限校验。 */
import type { AdminTaskRow, AdminTasksFilters } from "@/lib/admin-tasks";
import type { DashboardPaginationSlice } from "@/lib/dashboard-pagination";

import type { FeedbackTone } from "../dashboard-shared-ui";

export type PageFeedbackValue = {
  tone: FeedbackTone;
  message: string;
};

export type PageFeedback = PageFeedbackValue | null;

export type AdminTasksPagination = DashboardPaginationSlice<AdminTaskRow>;

export const taskInputClassName =
  "h-12 w-full rounded-[18px] border border-border bg-white px-4 text-sm text-content-strong outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/30";
export const taskTextareaClassName =
  "min-h-[150px] w-full rounded-[22px] border border-border bg-white px-4 py-3 text-sm leading-7 text-content-strong outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/30";

export function areAdminTaskFiltersEqual(left: AdminTasksFilters, right: AdminTasksFilters) {
  return (
    left.searchText === right.searchText &&
    left.targetRole === right.targetRole &&
    left.status === right.status
  );
}
