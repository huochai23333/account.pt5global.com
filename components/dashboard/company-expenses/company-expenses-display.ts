import type { CompanyExpenseRow } from "@/lib/company-expenses";

export type CompanyExpenseSummary = {
  amount: number;
  count: number;
  currencyCode: string;
};

export function getCompanyExpenseSummaries(
  rows: readonly CompanyExpenseRow[],
): CompanyExpenseSummary[] {
  const summaryByCurrency = new Map<string, CompanyExpenseSummary>();

  rows.forEach((row) => {
    const currencyCode = row.currency_code;
    const current = summaryByCurrency.get(currencyCode) ?? {
      amount: 0,
      count: 0,
      currencyCode,
    };

    summaryByCurrency.set(currencyCode, {
      amount: current.amount + row.amount,
      count: current.count + 1,
      currencyCode,
    });
  });

  return Array.from(summaryByCurrency.values()).sort((left, right) =>
    left.currencyCode.localeCompare(right.currencyCode),
  );
}

export function getCompanyExpenseMonthValue(row: CompanyExpenseRow) {
  return row.expense_month.slice(0, 7);
}

export function formatCompanyExpenseAmount(
  amount: number,
  currencyCode: string,
  locale: string,
) {
  try {
    return new Intl.NumberFormat(locale, {
      currency: currencyCode,
      style: "currency",
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

export function formatCompanyExpenseMonth(value: string, locale: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 7)}-01T00:00:00+08:00`));
}

export function formatCompanyExpenseDate(value: string | null, locale: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Asia/Shanghai",
  }).format(new Date(`${value}T00:00:00+08:00`));
}
