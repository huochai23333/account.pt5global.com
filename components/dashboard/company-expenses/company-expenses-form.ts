import type {
  CompanyExpenseCategory,
  CompanyExpenseFormInput,
  CompanyExpenseRow,
} from "@/lib/company-expenses";

// 表单字段和数据库输入的转换集中在这里，费用卡片只消费展示数据。
export type CompanyExpenseFormState = {
  amount: string;
  category: CompanyExpenseCategory;
  currencyCode: string;
  expenseDate: string;
  expenseMonth: string;
  note: string;
  payee: string;
  title: string;
};

type CompanyExpenseErrorCopy = {
  invalidAmount: string;
  invalidMonth: string;
  missingAmount: string;
  missingTitle: string;
  notFoundError: string;
  permissionError: string;
  unknownError: string;
};

export const companyExpenseCurrencyOptions = ["CNY", "USD", "THB"] as const;

export function createEmptyCompanyExpenseForm(): CompanyExpenseFormState {
  return {
    amount: "",
    category: "other",
    currencyCode: "CNY",
    expenseDate: "",
    expenseMonth: getCurrentMonthInputValue(),
    note: "",
    payee: "",
    title: "",
  };
}

export function createCompanyExpenseFormFromRow(
  row: CompanyExpenseRow,
): CompanyExpenseFormState {
  return {
    amount: String(row.amount),
    category: row.category,
    currencyCode: row.currency_code,
    expenseDate: row.expense_date ?? "",
    expenseMonth: row.expense_month.slice(0, 7),
    note: row.note ?? "",
    payee: row.payee ?? "",
    title: row.title,
  };
}

export function toCompanyExpenseInput(
  formState: CompanyExpenseFormState,
  copy: CompanyExpenseErrorCopy,
): CompanyExpenseFormInput {
  if (!formState.title.trim()) {
    throw new Error(copy.missingTitle);
  }

  if (!formState.expenseMonth.trim()) {
    throw new Error(copy.invalidMonth);
  }

  if (!formState.amount.trim()) {
    throw new Error(copy.missingAmount);
  }

  const amount = Number(formState.amount);

  // 数据库费用保留两位小数，提前拦截会被数据库舍入的金额。
  if (!Number.isFinite(amount) || amount <= 0 || amount !== Math.round(amount * 100) / 100) {
    throw new Error(copy.invalidAmount);
  }

  return {
    amount,
    category: formState.category,
    currencyCode: formState.currencyCode,
    expenseDate: formState.expenseDate,
    expenseMonth: formState.expenseMonth,
    note: formState.note,
    payee: formState.payee,
    title: formState.title,
  };
}

export function toCompanyExpenseErrorMessage(
  error: unknown,
  copy: CompanyExpenseErrorCopy,
) {
  const message = error instanceof Error ? error.message.trim() : "";
  const normalizedMessage = message.toLowerCase();

  if (
    message === copy.invalidAmount ||
    message === copy.invalidMonth ||
    message === copy.missingAmount ||
    message === copy.missingTitle
  ) {
    return message;
  }

  if (normalizedMessage.includes("company expense was not found")) {
    return copy.notFoundError;
  }

  if (
    normalizedMessage.includes("permission") ||
    normalizedMessage.includes("forbidden") ||
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("row-level security")
  ) {
    return copy.permissionError;
  }

  if (message.length > 0 && !looksLikeTechnicalCompanyExpenseError(normalizedMessage)) {
    return message;
  }

  return copy.unknownError;
}

function getCurrentMonthInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${now.getFullYear()}-${month}`;
}

function looksLikeTechnicalCompanyExpenseError(message: string) {
  return (
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("jwt") ||
    message.includes("relation") ||
    message.includes("column") ||
    message.includes("violates") ||
    message.includes("supabase") ||
    /\bhttp\s+\d{3}\b/.test(message) ||
    /\bstatus code\b/.test(message)
  );
}
