"use client";

import { useMemo } from "react";

import { useTranslations } from "next-intl";

import { useLocale } from "@/components/i18n/locale-provider";
import type {
  CompanyExpenseCategory,
  CompanyExpensesPageData,
} from "@/lib/company-expenses";

import {
  DashboardAccessState,
  DashboardPageShell,
} from "../dashboard-page-shell";
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

type TranslationValues = Record<string, string | number>;
type Translator = (key: string, values?: TranslationValues) => string;

function createCompanyExpensesCopy(t: Translator) {
  const categoryOptions: Record<CompanyExpenseCategory, string> = {
    logistics: t("categories.logistics"),
    marketing: t("categories.marketing"),
    office: t("categories.office"),
    other: t("categories.other"),
    rent: t("categories.rent"),
    salary: t("categories.salary"),
    service: t("categories.service"),
    tax: t("categories.tax"),
  };

  return {
    dialog: {
      amountLabel: t("dialog.amountLabel"),
      cancel: t("dialog.cancel"),
      categoryLabel: t("dialog.categoryLabel"),
      categoryOptions,
      createDescription: t("dialog.createDescription"),
      createSubmit: t("dialog.createSubmit"),
      createTitle: t("dialog.createTitle"),
      currencyLabel: t("dialog.currencyLabel"),
      editDescription: t("dialog.editDescription"),
      editSubmit: t("dialog.editSubmit"),
      editTitle: t("dialog.editTitle"),
      expenseDateLabel: t("dialog.expenseDateLabel"),
      expenseMonthLabel: t("dialog.expenseMonthLabel"),
      noteLabel: t("dialog.noteLabel"),
      notePlaceholder: t("dialog.notePlaceholder"),
      payeeLabel: t("dialog.payeeLabel"),
      payeePlaceholder: t("dialog.payeePlaceholder"),
      titleLabel: t("dialog.titleLabel"),
      titlePlaceholder: t("dialog.titlePlaceholder"),
    },
    feedback: {
      createSuccess: t("feedback.createSuccess"),
      deleteConfirm: (title: string) => t("feedback.deleteConfirm", { title }),
      deleteSuccess: t("feedback.deleteSuccess"),
      invalidAmount: t("feedback.invalidAmount"),
      invalidMonth: t("feedback.invalidMonth"),
      missingAmount: t("feedback.missingAmount"),
      missingTitle: t("feedback.missingTitle"),
      notFoundError: t("feedback.notFoundError"),
      permissionError: t("feedback.permissionError"),
      unknownError: t("feedback.unknownError"),
      updateSuccess: t("feedback.updateSuccess"),
    },
    filters: {
      allCategories: t("filters.allCategories"),
      allCurrencies: t("filters.allCurrencies"),
      allMonths: t("filters.allMonths"),
      categoryLabel: t("filters.categoryLabel"),
      categoryOptions,
      currencyLabel: t("filters.currencyLabel"),
      monthLabel: t("filters.monthLabel"),
      searchPlaceholder: t("filters.searchPlaceholder"),
    },
    header: {
      create: t("header.create"),
      title: t("header.title"),
    },
    list: {
      amount: t("list.amount"),
      categoryOptions,
      delete: t("list.delete"),
      edit: t("list.edit"),
      emptyDescription: t("list.emptyDescription"),
      emptyTitle: t("list.emptyTitle"),
      month: t("list.month"),
      note: t("list.note"),
      paidAt: t("list.paidAt"),
      payee: t("list.payee"),
      recordsTitle: t("list.recordsTitle"),
      updatedAt: t("list.updatedAt"),
    },
    noPermissionDescription: t("noPermissionDescription"),
    noPermissionTitle: t("noPermissionTitle"),
    summary: {
      count: (count: number) => t("summary.count", { count }),
      empty: t("summary.empty"),
      title: t("summary.title"),
    },
  };
}
