import { normalizeSearchText } from "@/lib/value-normalizers";
import type {
  AdminCommissionRow,
  CommissionCategory,
  CommissionSettlementStatus,
} from "@/lib/admin-commission";
import type { AppRole, UserStatus } from "@/lib/user-self-service";

import {
  getCommissionCategoryLabel,
  getCommissionSettlementStatusLabel,
} from "./commission-display";

export type SettlementFilter = "all" | CommissionSettlementStatus;
export type CategoryFilter = "all" | CommissionCategory;

export type CommissionFilters = {
  beneficiaryUserId: string;
  category: CategoryFilter;
  orderNumber: string;
  searchText: string;
  settlementStatus: SettlementFilter;
};

export type CommissionFilterOption<Value extends string> = {
  label: string;
  value: Value;
};

export type BeneficiarySummaryRow = {
  email: string | null;
  label: string;
  lastCreatedAt: string | null;
  name: string | null;
  paidAmount: number;
  pendingAmount: number;
  recordCount: number;
  role: AppRole | null;
  status: UserStatus | null;
  totalAmount: number;
  userId: string;
};

export function summarizeByBeneficiary(commissions: AdminCommissionRow[]) {
  const summaryByUserId = new Map<string, BeneficiarySummaryRow>();

  commissions.forEach((commission) => {
    const userId = commission.beneficiary.userId;

    if (!userId) {
      return;
    }

    const existing = summaryByUserId.get(userId);

    if (existing) {
      existing.recordCount += 1;
      existing.totalAmount += commission.commissionAmountRmb;

      if (commission.settlementStatus === "pending") {
        existing.pendingAmount += commission.commissionAmountRmb;
      }

      if (commission.settlementStatus === "paid") {
        existing.paidAmount += commission.commissionAmountRmb;
      }

      existing.lastCreatedAt = pickLaterDate(
        existing.lastCreatedAt,
        commission.createdAt,
      );
      return;
    }

    summaryByUserId.set(userId, {
      email: commission.beneficiary.email,
      label: commission.beneficiary.label,
      lastCreatedAt: commission.createdAt,
      name: commission.beneficiary.name,
      paidAmount:
        commission.settlementStatus === "paid" ? commission.commissionAmountRmb : 0,
      pendingAmount:
        commission.settlementStatus === "pending"
          ? commission.commissionAmountRmb
          : 0,
      recordCount: 1,
      role: commission.beneficiary.role,
      status: commission.beneficiary.status,
      totalAmount: commission.commissionAmountRmb,
      userId,
    });
  });

  return Array.from(summaryByUserId.values()).sort((left, right) =>
    right.totalAmount !== left.totalAmount
      ? right.totalAmount - left.totalAmount
      : compareDateDesc(left.lastCreatedAt, right.lastCreatedAt),
  );
}

function pickLaterDate(current: string | null, next: string | null) {
  if (!current) {
    return next;
  }

  if (!next) {
    return current;
  }

  return new Date(next).getTime() > new Date(current).getTime() ? next : current;
}

function compareDateDesc(left: string | null, right: string | null) {
  return (right ? new Date(right).getTime() : 0) - (left ? new Date(left).getTime() : 0);
}

// 只筛选当前会话已加载的记录。类别与状态也使用页面当前语言的文案搜索。
export function filterAdminCommissions(
  commissions: AdminCommissionRow[],
  filters: CommissionFilters,
  t: (key: string) => string,
) {
  const searchValue = normalizeSearchText(filters.searchText);
  const orderValue = normalizeSearchText(filters.orderNumber);

  return commissions.filter((commission) => {
    if (
      filters.beneficiaryUserId &&
      commission.beneficiary.userId !== filters.beneficiaryUserId
    )
      return false;
    if (
      filters.settlementStatus !== "all" &&
      commission.settlementStatus !== filters.settlementStatus
    )
      return false;
    if (
      filters.category !== "all" &&
      commission.category !== filters.category
    )
      return false;
    if (
      orderValue &&
      !normalizeSearchText(commission.orderNumber).includes(orderValue)
    )
      return false;
    if (!searchValue) return true;

    return [
      commission.orderNumber,
      commission.beneficiary.label,
      commission.beneficiary.name,
      commission.beneficiary.email,
      commission.sourceCustomer?.label ?? "",
      commission.sourceCustomer?.name ?? "",
      commission.sourceCustomer?.email ?? "",
      commission.sourceSalesman?.label ?? "",
      commission.sourceSalesman?.name ?? "",
      commission.sourceSalesman?.email ?? "",
      getCommissionCategoryLabel(commission.category, t),
      getCommissionSettlementStatusLabel(commission.settlementStatus, t),
    ].some((value) => normalizeSearchText(value).includes(searchValue));
  });
}
