import type {
  AdminCommissionRow,
  CommissionSettlementStatus,
} from "@/lib/admin-commission";
import type { DashboardPaginationSlice } from "@/lib/dashboard-pagination";

// 表格共用状态色和详情行，让管理与个人看板对同一结算状态使用一致的表达。
export type CommissionPagination =
  DashboardPaginationSlice<AdminCommissionRow> & {
    goToNextPage: () => void;
    goToPreviousPage: () => void;
  };

export type AdminCommissionTableSectionProps = {
  onFocusOrderNumber: (orderNumber: string) => void;
  onMarkAsPaid: (commission: AdminCommissionRow) => void;
  pagination: CommissionPagination;
  rows: AdminCommissionRow[];
  settlingCommissionId: string | null;
};

export function CommissionDetailLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="leading-7 text-content-muted">
      <span className="text-xs text-content-subtle">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

export function getCommissionSettlementTone(
  status: CommissionSettlementStatus,
) {
  if (status === "paid") return "success";
  if (status === "pending" || status === "reversed") return "warning";
  return "info";
}
