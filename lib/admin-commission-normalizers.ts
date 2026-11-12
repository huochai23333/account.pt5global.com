import type { OrderUserOption } from "./admin-orders";
import type { AppRole, UserStatus } from "./user-self-service";
import { normalizeNumericValue, normalizeOptionalString } from "./value-normalizers";

export type CommissionSettlementStatus = "pending" | "paid" | "cancelled" | "reversed";

export type CommissionCategory =
  | "salesman_purchase"
  | "salesman_service"
  | "referral_purchase"
  | "referral_service"
  | "referral_vip_first_year_bonus"
  | "manual_adjustment";

export type AdminCommissionActor = {
  userId: string | null;
  label: string;
  name: string | null;
  email: string | null;
  role: AppRole | null;
  status: UserStatus | null;
};

export type AdminCommissionRow = {
  id: string;
  orderOverviewId: string;
  orderNumber: string;
  orderStatus: string | null;
  orderDeletedAt: string | null;
  orderCompletedAt: string | null;
  isOrderDeleted: boolean;
  beneficiary: AdminCommissionActor;
  sourceCustomer: AdminCommissionActor | null;
  sourceSalesman: AdminCommissionActor | null;
  category: CommissionCategory;
  settlementStatus: CommissionSettlementStatus;
  orderAmountRmb: number;
  costAmountRmb: number | null;
  serviceFeeAmountRmb: number | null;
  commissionAmountRmb: number;
  settlementNote: string | null;
  settledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  calculationSnapshot: unknown;
};

export type CommissionRecordRow = {
  id: string;
  order_overview_id: string;
  beneficiary_user_id: string;
  commission_category: CommissionCategory;
  source_customer_user_id: string | null;
  source_salesman_user_id: string | null;
  order_amount_rmb_snapshot: number | string;
  cost_amount_rmb_snapshot: number | string | null;
  service_fee_amount_rmb_snapshot: number | string | null;
  commission_amount_rmb: number | string;
  calculation_snapshot: unknown;
  settlement_status: CommissionSettlementStatus;
  settled_at: string | null;
  settlement_note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CommissionOrderReferenceRecord = {
  id: string;
  order_number: string | null;
  order_status: string | null;
  deleted_at: string | null;
  completed_at: string | null;
};

// 按数据库中的编号拼接订单与人员资料，标签交给当前语言的页面生成。
export function normalizeCommissionRow(
  row: CommissionRecordRow,
  orderById: Map<string, CommissionOrderReferenceRecord>,
  userById: Map<string, OrderUserOption>,
): AdminCommissionRow {
  const order = orderById.get(row.order_overview_id);
  const orderNumber = normalizeOptionalString(order?.order_number) ?? row.order_overview_id;
  const orderStatus = normalizeOptionalString(order?.order_status);

  return {
    id: row.id,
    orderOverviewId: row.order_overview_id,
    orderNumber,
    orderStatus,
    orderDeletedAt: normalizeOptionalString(order?.deleted_at),
    orderCompletedAt: normalizeOptionalString(order?.completed_at),
    isOrderDeleted: Boolean(normalizeOptionalString(order?.deleted_at)),
    beneficiary: buildActor(row.beneficiary_user_id, userById),
    sourceCustomer: buildOptionalActor(row.source_customer_user_id, userById),
    sourceSalesman: buildOptionalActor(row.source_salesman_user_id, userById),
    category: row.commission_category,
    settlementStatus: row.settlement_status,
    orderAmountRmb: normalizeNumericValue(row.order_amount_rmb_snapshot) ?? 0,
    costAmountRmb: normalizeNumericValue(row.cost_amount_rmb_snapshot),
    serviceFeeAmountRmb: normalizeNumericValue(row.service_fee_amount_rmb_snapshot),
    commissionAmountRmb: normalizeNumericValue(row.commission_amount_rmb) ?? 0,
    settlementNote: normalizeOptionalString(row.settlement_note),
    settledAt: normalizeOptionalString(row.settled_at),
    createdAt: normalizeOptionalString(row.created_at),
    updatedAt: normalizeOptionalString(row.updated_at),
    calculationSnapshot: row.calculation_snapshot,
  };
}

function buildOptionalActor(userId: string | null, userById: Map<string, OrderUserOption>) {
  const normalizedUserId = normalizeOptionalString(userId);

  if (!normalizedUserId) {
    return null;
  }

  return buildActor(normalizedUserId, userById);
}

function buildActor(userId: string, userById: Map<string, OrderUserOption>): AdminCommissionActor {
  const profile = userById.get(userId);
  const name = normalizeOptionalString(profile?.name);
  const email = normalizeOptionalString(profile?.email);

  return {
    userId,
    label: name ?? email ?? `用户 ${userId.slice(0, 8)}`,
    name,
    email,
    role: profile?.role ?? null,
    status: profile?.status ?? null,
  };
}
