"use client";

import { useMemo } from "react";

import { useTranslations } from "next-intl";

import { useLocale } from "@/components/i18n/locale-provider";
import type {
  CompanyExpensesPageData,
} from "@/lib/company-expenses";

import {
  DashboardAccessState,
  DashboardPageShell,
} from "../dashboard-page-shell";
import { createCompanyExpensesCopy } from "./company-expenses-copy";
import { CompanyExpenseFormDialog } from "./company-expense-form-dialog";
import {
  CompanyExpensesFilterSection,
  CompanyExpensesHeaderSection,
  CompanyExpensesListSection,
  CompanyExpensesSummarySection,
} from "./company-expenses-sections";
import { useCompanyExpensesViewModel } from "./use-company-expenses-view-model";

type CompanyExpensesClientProps = {
  initialData: CompanyExpensesPageData;
};

export function CompanyExpensesClient({
  initialData,
}: CompanyExpensesClientProps) {
  const t = useTranslations("CompanyExpenses");
  const { locale } = useLocale();
  const copy = useMemo(() => createCompanyExpensesCopy(t), [t]);
  const viewModel = useCompanyExpensesViewModel({
    copy: copy.feedback,
    initialData,
  });

  if (!viewModel.hasPermission) {
    return (
      <DashboardPageShell className="gap-6">
        <DashboardAccessState
          description={copy.noPermissionDescription}
          kind="permission"
          title={copy.noPermissionTitle}
        />
      </DashboardPageShell>
    );
  }

  return (
    <>
      <DashboardPageShell
        feedback={viewModel.pageFeedback}
        header={
          <CompanyExpensesHeaderSection
            copy={copy.header}
            onCreate={viewModel.openCreateDialog}
          />
        }
      >
        <CompanyExpensesFilterSection
          categoryFilter={viewModel.categoryFilter}
          copy={copy.filters}
          currencyFilter={viewModel.currencyFilter}
          currencyOptions={viewModel.currencyOptions}
          monthFilter={viewModel.monthFilter}
          monthOptions={viewModel.monthOptions}
          onCategoryFilterChange={viewModel.setCategoryFilter}
          onCurrencyFilterChange={viewModel.setCurrencyFilter}
          onMonthFilterChange={viewModel.setMonthFilter}
          onReset={viewModel.resetFilters}
          onSearchQueryChange={viewModel.setSearchQuery}
          searchQuery={viewModel.searchQuery}
        />
        <CompanyExpensesSummarySection
          copy={copy.summary}
          expenses={viewModel.filteredExpenses}
          locale={locale}
        />
        <CompanyExpensesListSection
          paginationKey={JSON.stringify([viewModel.monthFilter, viewModel.categoryFilter, viewModel.currencyFilter, viewModel.searchQuery])}
          copy={copy.list}
          expenses={viewModel.filteredExpenses}
          locale={locale}
          onDelete={viewModel.handleDelete}
          onEdit={viewModel.openEditDialog}
          pendingAction={viewModel.pendingAction}
        />
      </DashboardPageShell>

      <CompanyExpenseFormDialog
        copy={copy.dialog}
        editingExpense={viewModel.editingExpense}
        feedback={viewModel.dialogFeedback}
        formState={viewModel.formState}
        onOpenChange={viewModel.handleDialogOpenChange}
        onSubmit={() => void viewModel.handleSubmit()}
        onUpdateField={viewModel.updateFormField}
        open={viewModel.dialogOpen}
        pending={viewModel.submitPending}
      />
    </>
  );
}
