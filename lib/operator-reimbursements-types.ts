export const operatorReimbursementStatusValues = [
  "unreimbursed",
  "reimbursed",
] as const;

export type OperatorReimbursementStatus =
  (typeof operatorReimbursementStatusValues)[number];

export type OperatorReimbursementPeriod = {
  end: string;
  start: string;
};

export type OperatorReimbursementRow = {
  amount: number;
  content: string;
  created_at: string;
  id: string;
  operator_user_id: string;
  operator_name: string;
  reimbursed_at: string | null;
  reimbursed_by_user_id: string | null;
  reimbursement_period_end: string;
  reimbursement_period_start: string;
  spent_at: string;
  status: OperatorReimbursementStatus;
  updated_at: string;
};

export type OperatorReimbursementFormInput = {
  amount: number;
  content: string;
  spentAt: string;
};

// 页面数据由数据库一次读取：明细分页，汇总和周期选项按完整记录计算。
export type OperatorReimbursementSummary = { amount: number; count: number };
export type OperatorReimbursementsPageData = {
  currentPeriod: OperatorReimbursementPeriod;
  currentUserId: string;
  hasPermission: boolean;
  reimbursements: OperatorReimbursementRow[];
  operators: { id: string; name: string }[];
  periodOptions: OperatorReimbursementPeriod[];
  ownPendingPeriods: (OperatorReimbursementPeriod &
    OperatorReimbursementSummary)[];
  summaries: Record<
    "currentUnreimbursed" | "currentReimbursed" | "totalUnreimbursed",
    OperatorReimbursementSummary
  >;
  total: number;
  page: number;
  pageSize: number;
};
export type OperatorReimbursementFilters = {
  owner: string;
  period: string;
  status: OperatorReimbursementStatus | "all";
  search: string;
  page: number;
};
export const defaultOperatorReimbursementFilters: OperatorReimbursementFilters =
  {
    owner: "mine",
    period: "all",
    status: "all",
    search: "",
    page: 1,
  };

export type OperatorReimbursementBatchResult = {
  periodEnd: string;
  periodStart: string;
  reimbursedTotal: number;
  updatedCount: number;
};
