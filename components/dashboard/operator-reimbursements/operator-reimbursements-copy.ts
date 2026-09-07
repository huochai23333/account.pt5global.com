import type { OperatorReimbursementStatus } from "@/lib/operator-reimbursements";

// 在显示边界集中准备文案，业务 hook 不依赖翻译键。
type TranslationValues = Record<string, string | number>;
type Translator = (key: string, values?: TranslationValues) => string;

export function createOperatorReimbursementsCopy(t: Translator) {
  const statusOptions: Record<OperatorReimbursementStatus, string> = {
    reimbursed: t("status.reimbursed"),
    unreimbursed: t("status.unreimbursed"),
  };

  return {
    confirm: {
      title: t("confirm.title"),
      description: t("confirm.description"),
      cancel: t("dialog.cancel"),
      submit: t("confirm.submit"),
      period: t("confirm.period"),
      empty: t("feedback.reimburseEmpty"),
      count: (count: number) => t("confirm.count", { count }),
    },
    loading: t("loading"),
    loadError: t("loadError"),
    retry: t("retry"),
    dialog: {
      amountLabel: t("dialog.amountLabel"),
      cancel: t("dialog.cancel"),
      contentLabel: t("dialog.contentLabel"),
      contentPlaceholder: t("dialog.contentPlaceholder"),
      createDescription: t("dialog.createDescription"),
      createSubmit: t("dialog.createSubmit"),
      createTitle: t("dialog.createTitle"),
      spentAtLabel: t("dialog.spentAtLabel"),
    },
    feedback: {
      savedRefreshError: t("feedback.savedRefreshError"),
      createSuccess: t("feedback.createSuccess"),
      deleteConfirm: (content: string) =>
        t("feedback.deleteConfirm", { content }),
      deleteLockedError: t("feedback.deleteLockedError"),
      deleteSuccess: t("feedback.deleteSuccess"),
      invalidAmount: t("feedback.invalidAmount"),
      invalidDate: t("feedback.invalidDate"),
      missingAmount: t("feedback.missingAmount"),
      missingContent: t("feedback.missingContent"),
      notFoundError: t("feedback.notFoundError"),
      permissionError: t("feedback.permissionError"),
      reimburseEmpty: t("feedback.reimburseEmpty"),
      reimburseSuccess: (count: number) =>
        t("feedback.reimburseSuccess", { count }),
      unknownError: t("feedback.unknownError"),
    },
    filters: {
      ownerLabel: t("filters.ownerLabel"),
      mine: t("filters.mine"),
      allOperators: t("filters.allOperators"),
      allPeriods: t("filters.allPeriods"),
      allStatuses: t("filters.allStatuses"),
      periodLabel: t("filters.periodLabel"),
      searchPlaceholder: t("filters.searchPlaceholder"),
      statusLabel: t("filters.statusLabel"),
      statusOptions,
    },
    header: {
      create: t("header.create"),
      currentPeriodLabel: t("header.currentPeriodLabel"),
      reimburse: t("header.reimburse"),
      title: t("header.title"),
    },
    list: {
      operator: t("list.operator"),
      amount: t("list.amount"),
      delete: t("list.delete"),
      emptyDescription: t("list.emptyDescription"),
      emptyTitle: t("list.emptyTitle"),
      period: t("list.period"),
      recordsTitle: t("list.recordsTitle"),
      reimbursedAt: t("list.reimbursedAt"),
      spentAt: t("list.spentAt"),
      status: t("list.status"),
      statusOptions,
      updatedAt: t("list.updatedAt"),
    },
    noPermissionDescription: t("noPermissionDescription"),
    noPermissionTitle: t("noPermissionTitle"),
    summary: {
      scope: (name: string) => t("summary.scope", { name }),
      count: (count: number) => t("summary.count", { count }),
      currentPeriod: t("summary.currentPeriod"),
      currentReimbursed: t("summary.currentReimbursed"),
      currentUnreimbursed: t("summary.currentUnreimbursed"),
      totalUnreimbursed: t("summary.totalUnreimbursed"),
    },
  };
}
