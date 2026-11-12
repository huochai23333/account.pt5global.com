import type { CompanyExpenseCategory } from "@/lib/company-expenses";

// 把领域文案集中映射成各区块需要的词，页面只负责组装。
type TranslationValues = Record<string, string | number>;
type Translator = (key: string, values?: TranslationValues) => string;

export function createCompanyExpensesCopy(t: Translator) {
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
      createUnconfirmed: t("feedback.createUnconfirmed"),
      createDifferent: t("feedback.createDifferent"),
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
