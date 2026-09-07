"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "@/components/i18n/locale-provider";
import type { OperatorReimbursementsPageData } from "@/lib/operator-reimbursements";
import { DashboardPageShell } from "../dashboard-page-shell";
import { OperatorReimbursementFormDialog } from "./operator-reimbursement-form-dialog";
import { OperatorReimbursementConfirmDialog } from "./operator-reimbursement-confirm-dialog";
import {
  OperatorReimbursementsFilterSection,
  OperatorReimbursementsHeaderSection,
} from "./operator-reimbursements-sections";
import { OperatorReimbursementsResults } from "./operator-reimbursements-results";
import { createOperatorReimbursementsCopy } from "./operator-reimbursements-copy";
import { useOperatorReimbursementsViewModel } from "./use-operator-reimbursements-view-model";

/** Client 只组装页面与弹窗，查询、写入、输入状态和文案映射各有独立模块。 */
export function OperatorReimbursementsClient({
  initialData,
}: {
  initialData: OperatorReimbursementsPageData;
}) {
  const t = useTranslations("OperatorReimbursements");
  const { locale } = useLocale();
  const copy = useMemo(() => createOperatorReimbursementsCopy(t), [t]);
  const vm = useOperatorReimbursementsViewModel({
    copy: copy.feedback,
    initialData,
  });
  return (
    <>
      <DashboardPageShell
        feedback={vm.feedback}
        header={
          <OperatorReimbursementsHeaderSection
            copy={copy.header}
            currentPeriod={vm.data.currentPeriod}
            unreimbursedCount={vm.data.ownPendingPeriods.length}
            locale={locale}
            ownView={vm.ownView}
            loading={vm.loading || vm.queryFailed}
            onCreate={vm.form.openCreate}
            onReimburse={vm.actions.openReimburse}
            reimbursePending={vm.actions.pending}
          />
        }
      >
        <OperatorReimbursementsFilterSection
          copy={copy.filters}
          locale={locale}
          owner={vm.filters.owner}
          operators={vm.data.operators}
          onOwnerChange={(value) => vm.changeFilter("owner", value)}
          onPeriodFilterChange={(value) => vm.changeFilter("period", value)}
          onReset={vm.resetFilters}
          onSearchQueryChange={(value) => vm.changeFilter("search", value)}
          onStatusFilterChange={(value) => vm.changeFilter("status", value)}
          periodFilter={vm.filters.period}
          periodOptions={vm.data.periodOptions}
          searchQuery={vm.filters.search}
          statusFilter={vm.filters.status}
        />
        <OperatorReimbursementsResults vm={vm} copy={copy} locale={locale} />
      </DashboardPageShell>
      <OperatorReimbursementFormDialog
        copy={copy.dialog}
        feedback={vm.form.feedback}
        formState={vm.form.form}
        onOpenChange={vm.form.changeOpen}
        onSubmit={() => void vm.form.submit()}
        onUpdateField={vm.form.updateField}
        open={vm.form.open}
        pending={vm.form.pending}
      />
      <OperatorReimbursementConfirmDialog
        actions={vm.actions}
        periods={vm.data.ownPendingPeriods}
        copy={copy.confirm}
        locale={locale}
      />
    </>
  );
}
