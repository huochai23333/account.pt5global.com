"use client";

import { useState } from "react";
import type { OperatorReimbursementsPageData } from "@/lib/operator-reimbursements";
import {
  useOperatorReimbursementForm,
  type ReimbursementCopy,
  type ReimbursementFeedback,
} from "./use-operator-reimbursement-form";
import { useOperatorReimbursementActions } from "./use-operator-reimbursement-actions";
import { useOperatorReimbursementsQuery } from "./use-operator-reimbursements-query";

/** 页面状态只调度查询、筛选和子 hook；输入表单与写入过程分别维护。 */
export function useOperatorReimbursementsViewModel({
  copy,
  initialData,
}: {
  copy: ReimbursementCopy;
  initialData: OperatorReimbursementsPageData;
}) {
  const [feedback, setFeedback] = useState<ReimbursementFeedback>(null);
  const query = useOperatorReimbursementsQuery(initialData);
  const onSaved = async (message: string) => {
    const refreshed = await query.refresh();
    setFeedback({
      tone: refreshed ? "success" : "info",
      message: refreshed ? message : copy.savedRefreshError,
    });
  };
  const form = useOperatorReimbursementForm(copy, onSaved);
  const actions = useOperatorReimbursementActions(
    query.data,
    copy,
    onSaved,
    setFeedback,
  );
  // 全部运营属于查阅视图。只有“我的记录”和选择本人时显示写入入口。
  const ownView =
    query.filters.owner === "mine" ||
    query.filters.owner === query.data.currentUserId;
  return {
    data: query.data,
    filters: query.filters,
    changeFilter: query.changeFilter,
    resetFilters: query.resetFilters,
    refresh: query.refresh,
    queryFailed: query.queryFailed,
    feedback,
    form,
    actions,
    ownView,
    loading: query.loading,
  };
}
