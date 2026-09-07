"use client";

import { Select } from "@/components/ui/select";
import { FormDialog, DashboardFormField } from "../dashboard-form-dialog";
import type { OperatorReimbursementsPageData } from "@/lib/operator-reimbursements";
import type { useOperatorReimbursementActions } from "./use-operator-reimbursement-actions";
import type { createOperatorReimbursementsCopy } from "./operator-reimbursements-copy";
import {
  formatOperatorReimbursementAmount,
  formatOperatorReimbursementPeriod,
} from "./operator-reimbursements-display";

/** 确认弹窗使用本人的完整周期汇总，不使用列表当前页或搜索结果计算金额。 */
export function OperatorReimbursementConfirmDialog({
  actions,
  periods,
  copy,
  locale,
}: {
  actions: ReturnType<typeof useOperatorReimbursementActions>;
  periods: OperatorReimbursementsPageData["ownPendingPeriods"];
  copy: ReturnType<typeof createOperatorReimbursementsCopy>["confirm"];
  locale: string;
}) {
  return (
    <FormDialog
      open={actions.open}
      onOpenChange={actions.changeOpen}
      title={copy.title}
      description={copy.description}
      cancelLabel={copy.cancel}
      submitLabel={copy.submit}
      pending={actions.pending}
      submitDisabled={!actions.selected}
      feedback={actions.dialogFeedback}
      onSubmit={() => void actions.reimburse()}
    >
      <DashboardFormField label={copy.period}>
        <Select
          disabled={actions.pending}
          value={actions.period}
          onValueChange={actions.setPeriod}
          options={periods.map((period) => ({
            value: period.start,
            label: formatOperatorReimbursementPeriod(period, locale),
          }))}
        />
      </DashboardFormField>
      {actions.selected ? (
        <div
          className="grid min-w-0 gap-3 rounded-xl bg-surface-inset p-4"
          aria-live="polite"
        >
          <p className="break-words text-sm text-content-muted">
            {copy.count(actions.selected.count)}
          </p>
          <p className="break-words text-2xl font-bold text-content-strong">
            {formatOperatorReimbursementAmount(actions.selected.amount, locale)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-content-muted">{copy.empty}</p>
      )}
    </FormDialog>
  );
}
