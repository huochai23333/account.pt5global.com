import { queryCompleteDashboardRows } from "./dashboard-complete-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";
import {
  getCurrentSessionContext,
  type AppRole,
  type UserStatus,
} from "./user-self-service";

export const companyExpenseCategoryValues = [
  "rent",
  "office",
  "salary",
  "marketing",
  "logistics",
  "service",
  "tax",
  "other",
] as const;

export type CompanyExpenseCategory =
  (typeof companyExpenseCategoryValues)[number];

export type CompanyExpenseRow = {
  amount: number;
  category: CompanyExpenseCategory;
  created_at: string;
  created_by_user_id: string;
  currency_code: string;
  expense_date: string | null;
  expense_month: string;
  id: string;
  note: string | null;
  payee: string | null;
  title: string;
  updated_at: string;
};

export type CompanyExpenseFormInput = {
  amount: number;
  category: CompanyExpenseCategory;
  currencyCode: string;
  expenseDate: string;
  expenseMonth: string;
  note: string;
  payee: string;
  title: string;
};

export type CompanyExpensesPageData = {
  expenses: CompanyExpenseRow[];
  hasPermission: boolean;
};

type CompanyExpenseReaderContext = {
  role: AppRole | null;
  status: UserStatus | null;
};

type CompanyExpenseDatabaseRow = Omit<CompanyExpenseRow, "amount"> & {
  amount: number | string;
};

const COMPANY_EXPENSE_SELECT =
  "id,expense_month,expense_date,title,category,amount,currency_code,payee,note,created_by_user_id,created_at,updated_at";

export function canManageCompanyExpenses(
  role: AppRole | null,
  status: UserStatus | null,
) {
  return (
    status === "active" &&
    (role === "administrator" || role === "finance")
  );
}

export async function getCompanyExpensesPageData(
  supabase: SupabaseClient,
  context?: CompanyExpenseReaderContext,
): Promise<CompanyExpensesPageData> {
  const { role, status } =
    context ?? (await getCurrentSessionContext(supabase));

  if (!canManageCompanyExpenses(role, status)) {
    return {
      expenses: [],
      hasPermission: false,
    };
  }

  const { data, error } = await queryCompleteDashboardRows(
    supabase
      .from("company_expenses")
      .select(COMPANY_EXPENSE_SELECT)
      .order("expense_month", { ascending: false })
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .returns<CompanyExpenseDatabaseRow[]>(),
  );

  if (error) {
    throw error;
  }

  return {
    expenses: normalizeCompanyExpenseRows(data ?? []),
    hasPermission: true,
  };
}

export async function createCompanyExpense(
  supabase: SupabaseClient,
  draft: { id: string; actorId: string },
  input: CompanyExpenseFormInput,
) {
  const payload = toCompanyExpensePayload(input);
  // 同一草稿沿用同一主键。上次提交已完成时，主键冲突也不会生成第二条费用。
  const { data, error, status } = await withRequestTimeout(
    supabase
      .from("company_expenses")
      .insert({ id: draft.id, ...payload })
      .select("id")
      .maybeSingle<{ id: string }>(),
  ).catch(() => ({ data: null, error: null, status: 0 }));

  const code = error?.code ?? "";
  const rejected = /^(22\d{3}|23\d{3}|42501|PGRST30[12])$/.test(code) && code !== "23505";
  if (status >= 400 && status < 500 && rejected) {
    // 只把数据库明确拒绝的错误当作未写入。代理超时或未知响应仍然需要核对。
    throw new CompanyExpenseCreateRejected(code === "42501" ? "permission denied" : "");
  }

  // 成功响应、断线和重复主键都要读同一记录。创建人由数据库以当前会话填写。
  const receipt = await withRequestTimeout(
    supabase.from("company_expenses")
      .select(COMPANY_EXPENSE_SELECT)
      .eq("id", draft.id)
      .eq("created_by_user_id", draft.actorId)
      .maybeSingle<CompanyExpenseDatabaseRow>(),
  ).catch(() => null);
  const row = receipt?.data;
  if (receipt?.error || !row || row.id !== draft.id || (data && data.id !== row.id)) {
    throw new Error(companyExpenseCreateUnconfirmed);
  }
  const matches = Object.entries(payload).every(([key, value]) => (
    key === "amount" ? Number(row.amount) === value : row[key as keyof typeof payload] === value
  ));
  if (!matches) throw new Error(companyExpenseCreateDifferent);

  return normalizeCompanyExpenseRow(row);
}

export const companyExpenseCreateUnconfirmed = "company_expense_create_unconfirmed";
export const companyExpenseCreateDifferent = "company_expense_create_different";
export class CompanyExpenseCreateRejected extends Error {}

export function getCompanyExpenseDraftKey(input: CompanyExpenseFormInput) {
  return JSON.stringify(toCompanyExpensePayload(input));
}

export async function updateCompanyExpense(
  supabase: SupabaseClient,
  expenseId: string,
  input: CompanyExpenseFormInput,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("company_expenses")
      .update(toCompanyExpensePayload(input))
      .eq("id", expenseId)
      .select(COMPANY_EXPENSE_SELECT)
      .maybeSingle<CompanyExpenseDatabaseRow>(),
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Company expense was not found.");
  }

  return normalizeCompanyExpenseRow(data);
}

export async function deleteCompanyExpense(
  supabase: SupabaseClient,
  expenseId: string,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("company_expenses")
      .delete()
      .eq("id", expenseId)
      .select("id")
      .maybeSingle<{ id: string }>(),
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Company expense was not found.");
  }

  return data;
}

export function sortCompanyExpenses(rows: readonly CompanyExpenseRow[]) {
  return [...rows].sort((left, right) => {
    const leftKey = `${left.expense_month}-${left.updated_at}`;
    const rightKey = `${right.expense_month}-${right.updated_at}`;

    return rightKey.localeCompare(leftKey);
  });
}

function normalizeCompanyExpenseRows(
  rows: readonly CompanyExpenseDatabaseRow[],
) {
  return rows.map(normalizeCompanyExpenseRow);
}

function normalizeCompanyExpenseRow(
  row: CompanyExpenseDatabaseRow,
): CompanyExpenseRow {
  return {
    ...row,
    amount: Number(row.amount),
    category: normalizeCompanyExpenseCategory(row.category),
    currency_code: row.currency_code.toUpperCase(),
  };
}

function normalizeCompanyExpenseCategory(
  value: string,
): CompanyExpenseCategory {
  return companyExpenseCategoryValues.includes(value as CompanyExpenseCategory)
    ? (value as CompanyExpenseCategory)
    : "other";
}

function toCompanyExpensePayload(input: CompanyExpenseFormInput) {
  return {
    amount: input.amount,
    category: input.category,
    currency_code: input.currencyCode.trim().toUpperCase(),
    expense_date: input.expenseDate.trim() || null,
    expense_month: normalizeExpenseMonth(input.expenseMonth),
    note: input.note.trim() || null,
    payee: input.payee.trim() || null,
    title: input.title.trim(),
  };
}

function normalizeExpenseMonth(value: string) {
  const trimmedValue = value.trim();
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(trimmedValue);

  if (!match) {
    throw new Error("Company expense month is invalid.");
  }

  const monthNumber = Number(match[2]);

  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error("Company expense month is invalid.");
  }

  return `${match[1]}-${match[2]}-01`;
}
