"use client";

import { Button } from "@/components/ui/button";
import { getDashboardPaginationState } from "@/lib/dashboard-pagination";
import { DashboardPaginationFooter } from "../dashboard-collection-section";
import { OperatorReimbursementsListSection } from "./operator-reimbursements-list";
import { OperatorReimbursementsSummarySection } from "./operator-reimbursements-summary";
import type { createOperatorReimbursementsCopy } from "./operator-reimbursements-copy";
import type { useOperatorReimbursementsViewModel } from "./use-operator-reimbursements-view-model";

/** 汇总与列表一起切换，加载期间不显示上一名运营的金额。 */
export function OperatorReimbursementsResults({
  vm,
  copy,
  locale,
}: {
  vm: ReturnType<typeof useOperatorReimbursementsViewModel>;
  copy: ReturnType<typeof createOperatorReimbursementsCopy>;
  locale: string;
}) {
  if (vm.queryFailed)
    return (
      <div className="space-y-3" role="alert">
        <p>{copy.loadError}</p>
        <Button variant="outline" onClick={() => void vm.refresh()}>
          {copy.retry}
        </Button>
      </div>
    );
  if (vm.loading)
    return (
      <p role="status" className="text-sm text-content-muted">
        {copy.loading}
      </p>
    );
  const { data } = vm;
  const ownerName =
    vm.filters.owner === "all"
      ? copy.filters.allOperators
      : (data.operators.find(
          (operator) =>
            operator.id ===
            (vm.filters.owner === "mine"
              ? data.currentUserId
              : vm.filters.owner),
        )?.name ?? copy.filters.mine);
  const pagination = getDashboardPaginationState(
    data.total,
    data.page,
    data.pageSize,
  );
  return (
    <>
      <OperatorReimbursementsSummarySection
        copy={copy.summary}
        summaries={data.summaries}
        scopeLabel={copy.summary.scope(ownerName)}
        locale={locale}
      />
      <OperatorReimbursementsListSection
        copy={copy.list}
        locale={locale}
        currentUserId={data.currentUserId}
        ownView={vm.ownView}
        onDelete={(row) => void vm.actions.remove(row)}
        reimbursements={data.reimbursements}
        pendingAction={
          vm.actions.pendingId
            ? { id: vm.actions.pendingId, type: "delete" }
            : null
        }
      />
      <DashboardPaginationFooter
        {...pagination}
        onNextPage={() => vm.changeFilter("page", data.page + 1)}
        onPreviousPage={() => vm.changeFilter("page", data.page - 1)}
      />
    </>
  );
}
